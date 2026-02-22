import os
import stripe

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session, select

from ..auth import get_current_user
from app.database import get_session
from app.models import User

router = APIRouter(prefix="/billing", tags=["billing"])


def _require_env(name: str) -> str:
    val = os.getenv(name)
    if not val:
        raise HTTPException(status_code=500, detail=f"Missing server env var: {name}")
    return val


def _frontend_base() -> str:
    # Ensure no trailing slash
    return _require_env("FRONTEND_URL").rstrip("/")


def _stripe_init():
    stripe.api_key = _require_env("STRIPE_SECRET_KEY")


# ─────────────────────────────────────────────
# Create Checkout Session
# ─────────────────────────────────────────────

@router.post("/create-checkout")
def create_checkout(current_user: User = Depends(get_current_user)):
    _stripe_init()

    price_id = _require_env("STRIPE_PRICE_ID")
    success_url = _frontend_base() + "/upgrade?success=true"
    cancel_url = _frontend_base() + "/upgrade?cancel=true"

    # If we already have a Stripe customer ID, reuse it so subscriptions attach cleanly
    customer_id = getattr(current_user, "stripe_customer_id", None) or None

    session = stripe.checkout.Session.create(
        mode="subscription",
        payment_method_types=["card"],
        customer=customer_id,  # optional
        customer_email=None if customer_id else current_user.email,
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={"user_id": str(current_user.id)},
    )

    return {"url": session.url}


# ─────────────────────────────────────────────
# Stripe Webhook (CRITICAL)
# ─────────────────────────────────────────────

@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_session)):
    _stripe_init()

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    endpoint_secret = _require_env("STRIPE_WEBHOOK_SECRET")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)
    except Exception as e:
        print("stripe_webhook: invalid signature:", str(e))
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    event_type = event.get("type")
    obj = event.get("data", {}).get("object", {})

    # Minimal log (Railway-friendly)
    print("stripe_webhook:", event_type)

    # 1) Checkout completed -> mark Pro + store customer/subscription IDs
    if event_type == "checkout.session.completed":
        # NOTE: For subscription mode, checkout session includes:
        # - customer
        # - subscription
        # - metadata.user_id (we set it)
        user_id = (obj.get("metadata") or {}).get("user_id")
        customer = obj.get("customer")
        subscription_id = obj.get("subscription")

        print(
            "checkout.session.completed",
            {"user_id": user_id, "customer": customer, "subscription": subscription_id},
        )

        if user_id:
            user = db.get(User, int(user_id))
            if user:
                user.is_pro = True

                # These fields must exist on your User model for this to persist.
                # If they don't exist yet, add them (nullable) and run a migration.
                if hasattr(user, "stripe_customer_id"):
                    user.stripe_customer_id = customer
                if hasattr(user, "stripe_subscription_id"):
                    user.stripe_subscription_id = subscription_id

                db.add(user)
                db.commit()

        return {"status": "ok"}

    # 2) Subscription deleted -> downgrade (lookup by stored customer id)
    if event_type == "customer.subscription.deleted":
        customer = obj.get("customer")
        subscription_id = obj.get("id")

        print(
            "customer.subscription.deleted",
            {"customer": customer, "subscription": subscription_id},
        )

        if customer and hasattr(User, "stripe_customer_id"):
            user = db.exec(select(User).where(User.stripe_customer_id == customer)).first()
            if user:
                user.is_pro = False
                if hasattr(user, "stripe_subscription_id"):
                    user.stripe_subscription_id = None
                db.add(user)
                db.commit()

        return {"status": "ok"}

    # 3) Subscription updated -> optionally downgrade if unpaid/past_due
    if event_type == "customer.subscription.updated":
        customer = obj.get("customer")
        status = obj.get("status")

        print("customer.subscription.updated", {"customer": customer, "status": status})

        # Consider pro active only when status is active or trialing
        pro_active = status in ("active", "trialing")

        if customer and hasattr(User, "stripe_customer_id"):
            user = db.exec(select(User).where(User.stripe_customer_id == customer)).first()
            if user:
                user.is_pro = bool(pro_active)
                db.add(user)
                db.commit()

        return {"status": "ok"}

    # Ignore other events for now
    return {"status": "ignored"}
