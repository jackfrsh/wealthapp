# backend/app/routers/auth.py

"""
Auth router: /auth/register, /auth/login, /auth/me, /auth/account

register and login are deprecated (return 410 Gone) — auth now flows
through Supabase on the frontend. /auth/me remains for session validation.
DELETE /auth/account permanently deletes the user's data (App Review requirement).
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from ..auth import get_current_user
from ..database import get_session
from ..models import (
    Account,
    AnalyticsEvent,
    AppleNotification,
    AppleTransaction,
    Goal,
    ProjectionScenario,
    Settings,
    Snapshot,
    User,
)

router = APIRouter(prefix="/auth", tags=["auth"])


class UserResponse(BaseModel):
    id: int
    username: str
    supabase_user_id: Optional[str] = None


@router.post("/register", status_code=410)
def register():
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="Registration is now handled by Supabase. Please use the app to sign up.",
    )


@router.post("/login", status_code=410)
def login():
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="Login is now handled by Supabase. Please use the app to sign in.",
    )


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        supabase_user_id=current_user.supabase_user_id,
    )


@router.delete("/account", status_code=200)
def delete_account(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Permanently delete a user account and all associated data.

    Required by App Store Review guidelines (2.5.7 / 5.1.1(v)).
    Deletes in dependency order to avoid FK constraint errors.
    The caller (iOS) must sign out locally after this call.
    """
    uid = current_user.id

    # Delete user-scoped rows in dependency order
    for row in session.exec(select(AnalyticsEvent).where(AnalyticsEvent.user_id == uid)).all():
        session.delete(row)
    for row in session.exec(select(AppleTransaction).where(AppleTransaction.user_id == uid)).all():
        session.delete(row)
    for row in session.exec(select(Account).where(Account.user_id == uid)).all():
        session.delete(row)
    for row in session.exec(select(Goal).where(Goal.user_id == uid)).all():
        session.delete(row)
    for row in session.exec(select(ProjectionScenario).where(ProjectionScenario.user_id == uid)).all():
        session.delete(row)
    for row in session.exec(select(Snapshot).where(Snapshot.user_id == uid)).all():
        session.delete(row)

    settings = session.exec(select(Settings).where(Settings.user_id == uid)).first()
    if settings:
        session.delete(settings)

    # AppleNotifications are keyed by original_transaction_id, not user_id — leave them
    # as an audit log; they contain no PII beyond the original_transaction_id.

    session.delete(current_user)
    session.commit()

    return {"status": "deleted"}