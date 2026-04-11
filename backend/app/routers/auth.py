from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Optional

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from ..auth import SUPABASE_URL, get_current_user
from ..database import get_session
from ..models import (
    Account,
    AnalyticsEvent,
    AppleTransaction,
    Goal,
    ProjectionScenario,
    Settings,
    Snapshot,
    User,
)

_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(dotenv_path=_ENV_PATH)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

# Read once at import time.
_SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()


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
async def delete_account(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Permanently delete a user account and all associated data."""
    print("[delete_account] current_user.id =", current_user.id)
    print("[delete_account] current_user.username =", current_user.username)
    print("[delete_account] current_user.supabase_user_id =", current_user.supabase_user_id)
    print("[delete_account] service role present =", bool(_SUPABASE_SERVICE_ROLE_KEY))
    print("[delete_account] supabase url =", SUPABASE_URL)

    supabase_uid = current_user.supabase_user_id
    if not supabase_uid:
        logger.error(
            "delete_account: user id=%s has no supabase_user_id",
            current_user.id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Account deletion is unavailable for this account. Please contact support.",
        )

    # Step 1: delete the Supabase Auth user first.
    await _delete_supabase_auth_user(supabase_uid)

    # Step 2: delete app-owned rows in dependency order.
    uid = current_user.id

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

    settings_row = session.exec(select(Settings).where(Settings.user_id == uid)).first()
    if settings_row:
        session.delete(settings_row)

    session.delete(current_user)
    session.commit()

    print("[delete_account] local app data deleted for user id =", uid)
    return {"status": "deleted"}


async def _delete_supabase_auth_user(supabase_uid: str) -> None:
    """Delete the user from Supabase Auth via the Admin API."""
    if not _SUPABASE_SERVICE_ROLE_KEY:
        logger.error(
            "SUPABASE_SERVICE_ROLE_KEY is not set — cannot delete Supabase Auth user %s",
            supabase_uid,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server misconfiguration: account deletion unavailable.",
        )

    if not SUPABASE_URL:
        logger.error("SUPABASE_URL is not set — cannot call Supabase Admin API")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server misconfiguration: account deletion unavailable.",
        )

    url = f"{SUPABASE_URL}/auth/v1/admin/users/{supabase_uid}"
    headers = {
        "Authorization": f"Bearer {_SUPABASE_SERVICE_ROLE_KEY}",
        "apikey": _SUPABASE_SERVICE_ROLE_KEY,
    }

    print("[delete_account] deleting supabase auth user:", supabase_uid)
    print("[delete_account] admin delete URL:", url)

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.delete(url, headers=headers)
    except httpx.RequestError as exc:
        logger.error("Supabase Admin API network error deleting %s: %s", supabase_uid, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not reach Supabase to complete account deletion. Please try again.",
        )

    print("[delete_account] supabase delete status:", response.status_code)
    print("[delete_account] supabase delete body:", response.text)

    if response.status_code == 404:
        logger.info("Supabase auth user %s already deleted (404)", supabase_uid)
        return

    if response.status_code not in (200, 204):
        logger.error(
            "Supabase Admin API returned %s deleting user %s: %s",
            response.status_code,
            supabase_uid,
            response.text,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Account deletion failed. Please try again or contact support.",
        )

    logger.info("Supabase auth user %s deleted successfully", supabase_uid)