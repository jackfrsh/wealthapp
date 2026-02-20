"""
Settings router: GET/PUT per-user settings (base currency, goal, theme, pro).
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


class SettingsUpdate(BaseModel):
    base_currency: Optional[str] = None
    goal: Optional[float] = None
    theme_preference: Optional[str] = None
    is_pro: Optional[bool] = None


# ─── Helpers ────────────────────────────────────────────────────────────────

def _get_or_create_settings(user_id: int, session: Session) -> Settings:
    settings = session.exec(
        select(Settings).where(Settings.user_id == user_id)
    ).first()

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
            settings = session.exec(
                select(Settings).where(Settings.user_id == user_id)
            ).first()

    return settings


# ─── Endpoints ──────────────────────────────────────────────────────────────

@router.get("", response_model=SettingsResponse)
def get_settings(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    settings = _get_or_create_settings(current_user.id, session)

    return SettingsResponse(
        base_currency=settings.base_currency,
        goal=settings.goal,
        theme_preference=settings.theme_preference or "system",
        is_pro=bool(getattr(settings, "is_pro", False)),
    )


@router.put("", response_model=SettingsResponse)
def update_settings(
    body: SettingsUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    settings = _get_or_create_settings(current_user.id, session)

    data = body.dict(exclude_unset=True)

    if "base_currency" in data and data["base_currency"]:
        settings.base_currency = str(data["base_currency"]).upper()

    if "goal" in data:
        settings.goal = data["goal"]

    if "theme_preference" in data:
        pref = data["theme_preference"]
        if pref in ("system", "dark", "light"):
            settings.theme_preference = pref

    if "is_pro" in data:
        settings.is_pro = bool(data["is_pro"])

    session.add(settings)
    session.commit()
    session.refresh(settings)

    return SettingsResponse(
        base_currency=settings.base_currency,
        goal=settings.goal,
        theme_preference=settings.theme_preference or "system",
        is_pro=bool(settings.is_pro),
    )
