"""
Settings router: GET/PUT per-user settings (base currency, goal, theme).
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from ..auth import get_current_user
from ..database import get_session
from ..models import Settings, User

router = APIRouter(prefix="/settings", tags=["settings"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class SettingsResponse(BaseModel):
    base_currency: str
    goal: float
    theme_preference: str


class SettingsUpdate(BaseModel):
    base_currency: str = "GBP"
    goal: float = 0.0
    theme_preference: str = "system"


# ─── Endpoints ───────────────────────────────────────────────────────────────

def _get_or_create_settings(user_id: int, session: Session) -> Settings:
    settings = session.exec(
        select(Settings).where(Settings.user_id == user_id)
    ).first()
    if not settings:
        settings = Settings(user_id=user_id, base_currency="GBP", goal=0.0, theme_preference="system")
        session.add(settings)
        session.commit()
        session.refresh(settings)
    return settings


@router.get("", response_model=SettingsResponse)
def get_settings(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    settings = _get_or_create_settings(current_user.id, session)
    return SettingsResponse(
        base_currency=settings.base_currency,
        goal=settings.goal,
        theme_preference=getattr(settings, 'theme_preference', 'system') or 'system',
    )


@router.put("", response_model=SettingsResponse)
def update_settings(
    body: SettingsUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    settings = _get_or_create_settings(current_user.id, session)
    settings.base_currency = body.base_currency.upper()
    settings.goal = body.goal
    # Validate theme
    if body.theme_preference in ("system", "dark", "light"):
        settings.theme_preference = body.theme_preference
    session.add(settings)
    session.commit()
    session.refresh(settings)
    return SettingsResponse(
        base_currency=settings.base_currency,
        goal=settings.goal,
        theme_preference=getattr(settings, 'theme_preference', 'system') or 'system',
    )
