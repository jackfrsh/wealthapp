"""
Settings router: GET/PUT per-user settings (base currency, goal, theme, pro).
Note: `is_pro` is server-controlled (billing/webhooks), not user-editable.
"""

from fastapi import APIRouter, Depends
from typing import Optional
from pydantic import BaseModel
from sqlmodel import Session, select
from sqlalchemy.exc import IntegrityError

from ..auth import get_current_user
from ..database import get_session
from ..models import Settings, User

router = APIRouter(prefix="/settings", tags=["settings"])


# ─── Schemas ────────────────────────────────────────────────────────────────

class SettingsResponse(BaseModel):
    base_currency: str
    goal: float
    theme_preference: str
    is_pro: bool
    subscription_status: Optional[str] = None
    trial_end: Optional[str] = None


class SettingsUpdate(BaseModel):
    base_currency: Optional[str] = None
    goal: Optional[float] = None
    theme_preference: Optional[str] = None
    # IMPORTANT: is_pro intentionally omitted (server-controlled)


class EntitlementResponse(BaseModel):
    tier: str
    trial_active: bool
    subscription_status: Optional[str] = None
    trial_end: Optional[str] = None


# ─── Helpers ────────────────────────────────────────────────────────────────

def _get_or_create_settings(user_id: int, session: Session) -> Settings:
    settings = session.exec(select(Settings).where(Settings.user_id == user_id)).first()

    if not settings:
        try:
            settings = Settings(
                user_id=user_id,
                base_currency="GBP",
                goal=0.0,
                theme_preference="system",
                is_pro=False,
            )
            session.add(settings)
            session.commit()
            session.refresh(settings)
        except IntegrityError:
            session.rollback()
            settings = session.exec(select(Settings).where(Settings.user_id == user_id)).first()

    return settings


# ─── Endpoints ──────────────────────────────────────────────────────────────

@router.get("", response_model=SettingsResponse)
def get_settings(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Fast read — returns cached subscription data, never calls Stripe."""
    settings = _get_or_create_settings(current_user.id, session)

    return SettingsResponse(
        base_currency=settings.base_currency,
        goal=settings.goal,
        theme_preference=settings.theme_preference or "system",
        is_pro=bool(getattr(settings, "is_pro", False)),
        subscription_status=getattr(settings, "subscription_status", None),
        trial_end=getattr(settings, "trial_end_iso", None),
    )


@router.get("/entitlement", response_model=EntitlementResponse)
def get_entitlement(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """
    Fast cached entitlement read for native/mobile clients.
    Never calls Stripe or Apple directly — reads from local cache only.

    Tier values
    ───────────
    "free"  – no active subscription
    "pro"   – active subscription (Stripe or Apple)
    "grace" – Apple billing grace period; user retains access while payment retries

    trial_active is True only when the user is within a verified intro trial period.
    Stripe past_due is treated as "pro" (Stripe retries; we do not surface it as grace).
    Apple billing failure with grace semantics is surfaced as "grace".
    """
    from .billing_apple import compute_tier

    settings = _get_or_create_settings(current_user.id, session)
    tier, trial_active = compute_tier(settings)

    return EntitlementResponse(
        tier=tier,
        trial_active=trial_active,
        subscription_status=getattr(settings, "subscription_status", None),
        trial_end=getattr(settings, "trial_end_iso", None),
    )


@router.put("", response_model=SettingsResponse)
def update_settings(
    body: SettingsUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    settings = _get_or_create_settings(current_user.id, session)
    data = body.model_dump(exclude_unset=True)

    if "base_currency" in data and data["base_currency"]:
        settings.base_currency = str(data["base_currency"]).upper()

    if "goal" in data:
        settings.goal = data["goal"]

    if "theme_preference" in data and data["theme_preference"] is not None:
        pref = data["theme_preference"]
        if pref in ("system", "dark", "light"):
            settings.theme_preference = pref

    session.add(settings)
    session.commit()
    session.refresh(settings)

    return SettingsResponse(
        base_currency=settings.base_currency,
        goal=settings.goal,
        theme_preference=settings.theme_preference or "system",
        is_pro=bool(settings.is_pro),
        subscription_status=getattr(settings, "subscription_status", None),
        trial_end=getattr(settings, "trial_end_iso", None),
    )


@router.patch("", response_model=SettingsResponse)
def patch_settings(
    body: SettingsUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    return update_settings(body, current_user=current_user, session=session)
