import os
import logging
import stripe

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session, select

from ..auth import get_current_user
from ..database import get_session
from ..models import User, Settings

logger = logging.getLogger("wealth.billing")

router = APIRouter(prefix="/billing", tags=["billing"])


def _require_env(name: str) -> str:
    val = os.getenv(name)
    if not val:
        raise HTTPException(status_code=500, detail=f"Missing server env var: {name}")
    return val


def _frontend_base() -> str:
    return _require_env("FRONTEND_URL").rstrip("/")


def _stripe_init() -> None:
    stripe.api_key = _require_env("STRIPE_SECRET_KEY")


def _get_or_create_settings(db: Session, user_id: int) -> Settings:
    s = db.exec(select(Settings).where(Settings.user_id == user_id)).first()
    if s:
        return s
    s = Settings(user_id=user_id, base_currency="GBP", goal=0.0, theme_preference="system", is_pro=False)
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


## ─────────────────────────────────────────────
# Create Checkout Session
# ─────────────────────────────────────────────

@router.post("/create-checkout")
def create_checkout(current_user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    _stripe_init()

    price_id = _require_env("STRIPE_PRICE_ID")
    success_url = _frontend_base() + "/upgrade?success=true"
    cancel_url = _frontend_base() + "/upgrade?cancel=true"

    customer_id = getattr(current_user, "stripe_customer_id", None) or None

    metadata = {"user_id": str(current_user.id)}
    if getattr(current_user, "supabase_user_id", None):
        metadata["supabase_user_id"] = str(current_user.supabase_user_id)

    params = dict(
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
        client_reference_id=str(current_user.id),
        # Optional but recommended: ensures subscription events also carry user_id
        subscription_data={"metadata": metadata},
    )

    if customer_id:
        params["customer"] = customer_id
    else:
        # For subscription Checkout, Stripe will create a Customer automatically.
        # Provide email to prefill and to tie the customer to the user.
        if getattr(current_user, "email", None):
            params["customer_email"] = current_user.email

    session = stripe.checkout.Session.create(**params)
    return {"url": session.url}


# Backwards/forwards compatible alias
@router.post("/checkout-session")
def checkout_session_alias(current_user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    return create_checkout(current_user=current_user, db=db)

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
        logger.warning("stripe_webhook: invalid signature: %s", str(e))
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    event_type = event.get("type")
    obj = event.get("data", {}).get("object", {}) or {}

    logger.info("stripe_webhook: %s", event_type)

    # ── Helper: set pro flag safely ─────────────────────────────────────────
    def set_pro_for_user(user: User, pro: bool, customer: str | None = None, subscription_id: str | None = None):
        settings = _get_or_create_settings(db, user.id)
        settings.is_pro = bool(pro)

        # Persist Stripe ids on User (nullable fields exist + migrated)
        if customer is not None:
            user.stripe_customer_id = customer
        if subscription_id is not None:
            user.stripe_subscription_id = subscription_id

        db.add(user)
        db.add(settings)
        db.commit()

    # 1) Checkout completed -> attach customer/subscription and set pro true
    if event_type == "checkout.session.completed":
        user_id = (obj.get("metadata") or {}).get("user_id")
        customer = obj.get("customer")
        subscription_id = obj.get("subscription")

        if user_id:
            user = db.get(User, int(user_id))
            if user:
                set_pro_for_user(user, True, customer=customer, subscription_id=subscription_id)

        return {"status": "ok"}

    # 2) Subscription deleted -> downgrade
    if event_type == "customer.subscription.deleted":
        customer = obj.get("customer")
        subscription_id = obj.get("id")

        if customer:
            user = db.exec(select(User).where(User.stripe_customer_id == customer)).first()
            if user:
                set_pro_for_user(user, False, subscription_id=None)
                # optional: keep stripe_customer_id for re-upgrades, so don't clear it

        return {"status": "ok"}

    # 3) Subscription updated -> pro only when active/trialing
    if event_type == "customer.subscription.updated":
        customer = obj.get("customer")
        status = obj.get("status")
        pro_active = status in ("active", "trialing")

        if customer:
            user = db.exec(select(User).where(User.stripe_customer_id == customer)).first()
            if user:
                set_pro_for_user(user, pro_active)

        return {"status": "ok"}

    # Optional but useful: payment succeeded/failed
    if event_type == "invoice.payment_succeeded":
        customer = obj.get("customer")
        if customer:
            user = db.exec(select(User).where(User.stripe_customer_id == customer)).first()
            if user:
                set_pro_for_user(user, True)
        return {"status": "ok"}

    if event_type == "invoice.payment_failed":
        customer = obj.get("customer")
        if customer:
            user = db.exec(select(User).where(User.stripe_customer_id == customer)).first()
            if user:
                set_pro_for_user(user, False)
        return {"status": "ok"}

    return {"status": "ignored"}