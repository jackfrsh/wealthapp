import os
import logging
import stripe
from typing import Optional, Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session, select

from pydantic import BaseModel

from ..auth import get_current_user
from ..database import get_session
from ..models import User, Settings, StripeEvent

logger = logging.getLogger("wealth.billing")

router = APIRouter(prefix="/billing", tags=["billing"])


def _require_env(name: str) -> str:
    val = os.getenv(name)
    if not val:
        raise HTTPException(status_code=500, detail=f"Missing server env var: {name}")
    return val

def _frontend_base() -> str:
    # Railway / prod should set this explicitly
    v = (os.getenv("FRONTEND_URL") or "").strip().rstrip("/")
    if v:
        return v
    # local fallback
    return "http://localhost:5173"


def _stripe_init() -> None:
    stripe.api_key = _require_env("STRIPE_SECRET_KEY")


def _get_or_create_settings(db: Session, user_id: int) -> Settings:
    s = db.exec(select(Settings).where(Settings.user_id == user_id)).first()
    if s:
        return s
    s = Settings(
        user_id=user_id,
        base_currency="GBP",
        goal=0.0,
        theme_preference="system",
        is_pro=False,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


class CheckoutBody(BaseModel):
    plan: Literal["monthly", "annual"] = "monthly"


def _set_pro_for_user(
    db: Session,
    user: User,
    pro: bool,
    customer: Optional[str] = None,
    subscription_id: Optional[str] = None,
    sub_status: Optional[str] = None,
    trial_end_ts: Optional[int] = None,
):
    settings = _get_or_create_settings(db, user.id)
    settings.is_pro = bool(pro)

    # Cache subscription metadata so GET /settings never hits Stripe
    if sub_status is not None:
        settings.subscription_status = sub_status
    if trial_end_ts and sub_status == "trialing":
        from datetime import datetime, timezone
        settings.trial_end_iso = datetime.fromtimestamp(trial_end_ts, tz=timezone.utc).isoformat()
    elif sub_status and sub_status != "trialing":
        settings.trial_end_iso = None

    if customer is not None:
        user.stripe_customer_id = customer
    if subscription_id is not None:
        user.stripe_subscription_id = subscription_id

    db.add(user)
    db.add(settings)
    db.commit()


# ─────────────────────────────────────────────
# Create Checkout Session
# ─────────────────────────────────────────────

@router.post("/create-checkout")
def create_checkout(
    body: CheckoutBody = CheckoutBody(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    _stripe_init()

    plan = (body.plan or "monthly").strip().lower()

    if plan == "annual":
        price_id = _require_env("STRIPE_PRICE_ID_ANNUAL")
    else:
        price_id = _require_env("STRIPE_PRICE_ID_MONTHLY")

    # Include CHECKOUT_SESSION_ID so frontend can verify instantly
    success_url = _frontend_base() + "/upgrade?success=true&session_id={CHECKOUT_SESSION_ID}"
    cancel_url = _frontend_base() + "/upgrade?cancel=true"

    customer_id = getattr(current_user, "stripe_customer_id", None)

    metadata = {"user_id": str(current_user.id)}

    subscription_data = {"metadata": metadata}

    # 7-day trial ONLY for annual, only if user hasn't had a subscription id stored
    if plan == "annual" and not getattr(current_user, "stripe_subscription_id", None):
        subscription_data["trial_period_days"] = 1

    params = {
        "mode": "subscription",
        "line_items": [{"price": price_id, "quantity": 1}],
        "success_url": success_url,
        "cancel_url": cancel_url,
        "client_reference_id": str(current_user.id),
        "metadata": metadata,
        "subscription_data": subscription_data,
        "allow_promotion_codes": True,
    }

    if customer_id:
        params["customer"] = customer_id
    else:
        # Optional: prefill email if you have it on the user object
        if getattr(current_user, "email", None):
            params["customer_email"] = current_user.email

    logger.info("Creating checkout session | user=%s | plan=%s | price=%s", current_user.id, plan, price_id)

    try:
        session = stripe.checkout.Session.create(**params)
    except Exception as e:
        logger.exception("Stripe checkout creation failed")
        raise HTTPException(status_code=500, detail=str(e))

    return {"url": session.url}


@router.post("/checkout-session")
def checkout_session_alias(
    body: CheckoutBody = CheckoutBody(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    return create_checkout(body=body, current_user=current_user, db=db)


# ─────────────────────────────────────────────
# Customer Portal (Manage Billing)
# ─────────────────────────────────────────────

@router.post("/portal")
def create_portal(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    _stripe_init()

    customer_id = getattr(current_user, "stripe_customer_id", None)
    if not customer_id:
        raise HTTPException(status_code=400, detail="No Stripe customer for user")

    portal = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=_frontend_base() + "/settings?billing=1",
    )
    return {"url": portal.url}


# ─────────────────────────────────────────────
# Checkout Status Verification (Instant Unlock)
# ─────────────────────────────────────────────

@router.get("/checkout-status")
def checkout_status(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    _stripe_init()

    try:
        s = stripe.checkout.Session.retrieve(session_id, expand=["subscription"])
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid session")

    meta_user_id = (s.get("metadata") or {}).get("user_id")
    if not meta_user_id or int(meta_user_id) != int(current_user.id):
        raise HTTPException(status_code=403, detail="Session does not belong to user")

    # Trials can be "no_payment_required" but still complete successfully.
    payment_status = s.get("payment_status")
    status = s.get("status")

    paid_or_ok = (status == "complete") or (payment_status in ("paid", "no_payment_required"))

    if paid_or_ok:
        customer = s.get("customer")
        subscription = s.get("subscription")
        subscription_id: Optional[str] = None

        if isinstance(subscription, dict):
            subscription_id = subscription.get("id")
        elif isinstance(subscription, str):
            subscription_id = subscription

        if customer and not getattr(current_user, "stripe_customer_id", None):
            current_user.stripe_customer_id = customer
        if subscription_id and not getattr(current_user, "stripe_subscription_id", None):
            current_user.stripe_subscription_id = subscription_id

        _set_pro_for_user(
            db,
            current_user,
            True,
            customer=getattr(current_user, "stripe_customer_id", None),
            subscription_id=getattr(current_user, "stripe_subscription_id", None),
        )

    return {"paid": bool(paid_or_ok)}

@router.get("/health")
def billing_health(current_user: User = Depends(get_current_user)):
    # Don’t leak secrets. Just confirm presence.
    return {
        "stripe_key_set": bool(os.getenv("STRIPE_SECRET_KEY")),
        "webhook_secret_set": bool(os.getenv("STRIPE_WEBHOOK_SECRET")),
        "price_monthly_set": bool(os.getenv("STRIPE_PRICE_ID_MONTHLY")),
        "price_annual_set": bool(os.getenv("STRIPE_PRICE_ID_ANNUAL")),
        "frontend_url_set": bool(os.getenv("FRONTEND_URL")),
        "has_customer": bool(getattr(current_user, "stripe_customer_id", None)),
        "has_subscription": bool(getattr(current_user, "stripe_subscription_id", None)),
    }


# ─────────────────────────────────────────────
# Sync (Self-heal entitlement on boot)
# ─────────────────────────────────────────────

@router.post("/sync")
def sync_billing(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    _stripe_init()

    settings = _get_or_create_settings(db, current_user.id)

    cust = getattr(current_user, "stripe_customer_id", None)
    sub_id = getattr(current_user, "stripe_subscription_id", None)

    if not cust and not sub_id:
        if settings.is_pro:
            settings.is_pro = False
            db.add(settings)
            db.commit()
        return {"is_pro": False, "status": None}

    status = None
    trial_end_ts = None
    try:
        if sub_id:
            sub = stripe.Subscription.retrieve(sub_id)
            status = sub.get("status")
            trial_end_ts = sub.get("trial_end")
        else:
            subs = stripe.Subscription.list(customer=cust, limit=1)
            data = (subs or {}).get("data") or []
            if data:
                status = data[0].get("status")
                trial_end_ts = data[0].get("trial_end")
                current_user.stripe_subscription_id = data[0].get("id")
                db.add(current_user)
                db.commit()
    except Exception as e:
        logger.warning("billing sync failed: %s", str(e))
        return {"is_pro": bool(settings.is_pro), "status": "unknown"}

    # Grace: past_due still Pro (Stripe retries often resolve)
    pro_active = status in ("active", "trialing", "past_due")

    # Always update cache (even if is_pro unchanged, status/trial may have changed)
    settings.subscription_status = status
    if trial_end_ts and status == "trialing":
        from datetime import datetime, timezone
        settings.trial_end_iso = datetime.fromtimestamp(trial_end_ts, tz=timezone.utc).isoformat()
    else:
        settings.trial_end_iso = None

    settings.is_pro = bool(pro_active)
    db.add(settings)
    db.commit()

    return {"is_pro": bool(pro_active), "status": status}


# ─────────────────────────────────────────────
# Stripe Webhook (CRITICAL)
# ─────────────────────────────────────────────

@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_session)):
    _stripe_init()

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    if not sig_header:
        logger.warning("stripe_webhook: missing stripe-signature header")
        raise HTTPException(status_code=400, detail="Missing Stripe signature")

    endpoint_secret = _require_env("STRIPE_WEBHOOK_SECRET")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)
    except Exception as e:
        logger.warning("stripe_webhook: invalid signature: %s", str(e))
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    event_id = event.get("id")
    event_type = event.get("type")
    obj = event.get("data", {}).get("object", {}) or {}

    logger.info(
        "stripe_webhook: type=%s id=%s livemode=%s",
        event_type,
        event_id,
        event.get("livemode"),
    )

    # Idempotency: ignore duplicates
    if event_id:
        existing = db.get(StripeEvent, event_id)
        if existing:
            return {"status": "duplicate_ignored"}
        db.add(StripeEvent(id=event_id))
        db.commit()

    # 1) Checkout completed: attach customer/subscription and set pro
    if event_type == "checkout.session.completed":
        user_id = (obj.get("metadata") or {}).get("user_id")
        customer = obj.get("customer")
        subscription_id = obj.get("subscription")

        if user_id:
            user = db.get(User, int(user_id))
            if user:
                _set_pro_for_user(
                    db,
                    user,
                    True,
                    customer=customer,
                    subscription_id=subscription_id,
                )
        return {"status": "ok"}

    # 2) Subscription lifecycle updates: source of truth
    if event_type in ("customer.subscription.updated", "customer.subscription.created"):
        status = obj.get("status")
        customer = obj.get("customer")
        subscription_id = obj.get("id")
        trial_end_ts = obj.get("trial_end")

        pro_active = status in ("active", "trialing", "past_due")

        if customer:
            user = db.exec(select(User).where(User.stripe_customer_id == customer)).first()
            if user:
                _set_pro_for_user(
                    db, user, pro_active,
                    subscription_id=subscription_id,
                    sub_status=status,
                    trial_end_ts=trial_end_ts,
                )

        return {"status": "ok"}

    # 3) Subscription deleted: downgrade
    # IMPORTANT: do NOT clear stripe_subscription_id, so trials can’t be repeated.
    if event_type == "customer.subscription.deleted":
        customer = obj.get("customer")
        if customer:
            user = db.exec(select(User).where(User.stripe_customer_id == customer)).first()
            if user:
                _set_pro_for_user(db, user, False, sub_status="canceled")
        return {"status": "ok"}

    # IMPORTANT: do NOT hard-downgrade on payment_failed (retries happen).
    if event_type in ("invoice.payment_failed", "invoice.payment_succeeded", "invoice.paid"):
        return {"status": "ok"}

    return {"status": "ignored"}