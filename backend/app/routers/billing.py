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
        logger.error("Missing required env var: %s", name)
        raise HTTPException(status_code=500, detail="Billing service is temporarily unavailable")
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

    # Compute is_pro from both Stripe and Apple so neither source clobbers the other.
    # When Stripe says False (e.g. subscription deleted), Apple may still be active.
    apple_active = getattr(settings, "apple_subscription_status", None) in (
        "active", "grace", "trialing"
    )
    settings.is_pro = bool(pro or apple_active)

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

    frontend_base = _frontend_base()

    # Stripe live mode rejects HTTP and localhost success_url — fail fast with a
    # clear server-side log before wasting a Stripe API round-trip.
    stripe_key = os.getenv("STRIPE_SECRET_KEY", "")
    if stripe_key.startswith("sk_live_") and (
        "localhost" in frontend_base or not frontend_base.startswith("https://")
    ):
        logger.error(
            "create_checkout: FRONTEND_URL=%r is not a valid HTTPS URL but "
            "STRIPE_SECRET_KEY is live-mode. Stripe will reject the success_url. "
            "Set FRONTEND_URL=https://app.getpaddock.com on Railway.",
            frontend_base,
        )
        raise HTTPException(
            status_code=503,
            detail="Checkout is temporarily unavailable — server configuration error.",
        )

    # Include CHECKOUT_SESSION_ID so frontend can verify instantly
    success_url = frontend_base + "/upgrade?success=true&session_id={CHECKOUT_SESSION_ID}"
    cancel_url = frontend_base + "/upgrade?cancel=true"

    customer_id = getattr(current_user, "stripe_customer_id", None)

    metadata = {"user_id": str(current_user.id)}

    subscription_data = {"metadata": metadata}

    # 7-day trial ONLY for annual, only if user hasn't had a subscription id stored
    if plan == "annual" and not getattr(current_user, "stripe_subscription_id", None):
        subscription_data["trial_period_days"] = 30

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
        if getattr(current_user, "email", None):
            params["customer_email"] = current_user.email

    logger.info(
        "Creating checkout session | user=%s | plan=%s | price=%s | success_url=%s",
        current_user.id, plan, price_id, success_url,
    )

    try:
        session = stripe.checkout.Session.create(**params)
    except stripe.error.StripeError as e:
        logger.error(
            "Stripe checkout creation failed | user=%s | plan=%s | "
            "error_type=%s | code=%s | message=%s",
            current_user.id, plan,
            type(e).__name__,
            getattr(e, "code", None),
            str(e),
        )
        raise HTTPException(status_code=503, detail="Checkout is temporarily unavailable. Please try again.")
    except Exception:
        logger.exception(
            "Stripe checkout unexpected error | user=%s | plan=%s",
            current_user.id, plan,
        )
        raise HTTPException(status_code=500, detail="Could not start checkout. Please try again.")

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
    key = os.getenv("STRIPE_SECRET_KEY") or ""
    frontend_url = (os.getenv("FRONTEND_URL") or "").strip().rstrip("/")

    # Expose key mode (live/test) without revealing the secret itself.
    if key.startswith("sk_live_"):
        key_mode = "live"
    elif key.startswith("sk_test_"):
        key_mode = "test"
    else:
        key_mode = None

    # Expose URL scheme so FRONTEND_URL misconfiguration is diagnosable.
    if "://" in frontend_url:
        url_scheme = frontend_url.split("://")[0]
        url_host = frontend_url.split("://", 1)[1].split("/")[0]
    else:
        url_scheme = None
        url_host = None

    return {
        "stripe_key_set": bool(key),
        "stripe_key_mode": key_mode,
        "webhook_secret_set": bool(os.getenv("STRIPE_WEBHOOK_SECRET")),
        "price_monthly_set": bool(os.getenv("STRIPE_PRICE_ID_MONTHLY")),
        "price_annual_set": bool(os.getenv("STRIPE_PRICE_ID_ANNUAL")),
        "frontend_url_set": bool(frontend_url),
        "frontend_url_scheme": url_scheme,
        "frontend_url_host": url_host,
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
        # No Stripe identifiers — cannot verify with Stripe.
        # Do NOT touch is_pro: the user may be Pro via Apple IAP, or their
        # customer ID may be missing due to a past webhook failure. Changing
        # is_pro here would silently downgrade legitimate paid users.
        logger.info(
            "billing sync: no Stripe IDs for user=%s — preserving is_pro=%s",
            current_user.id, settings.is_pro,
        )
        return {"is_pro": bool(settings.is_pro), "status": None}

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

    # Respect Apple IAP: do not clobber Apple-active Pro with a Stripe-only decision.
    apple_active = getattr(settings, "apple_subscription_status", None) in (
        "active", "grace", "trialing"
    )
    settings.is_pro = bool(pro_active or apple_active)

    logger.info(
        "billing sync: user=%s stripe_status=%s pro_active=%s apple_active=%s is_pro=%s",
        current_user.id, status, pro_active, apple_active, settings.is_pro,
    )

    db.add(settings)
    db.commit()

    return {"is_pro": bool(settings.is_pro), "status": status}


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
                # Verify customer mapping: either first purchase (no existing customer)
                # or the existing customer matches the webhook payload.
                existing_cust = getattr(user, "stripe_customer_id", None)
                if existing_cust and customer and existing_cust != customer:
                    logger.warning(
                        "checkout.session.completed: customer mismatch for user=%s "
                        "(existing=%s, webhook=%s) — skipping entitlement",
                        user_id, existing_cust, customer,
                    )
                else:
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