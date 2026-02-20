"""
Auth router: /auth/register, /auth/login, /auth/me

register and login are deprecated (return 410 Gone) — auth now flows
through Supabase on the frontend.  /auth/me remains for session
validation.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session
from typing import Optional

from ..auth import get_current_user
from ..database import get_session
from ..models import User

router = APIRouter(prefix="/auth", tags=["auth"])


# ─── Response schemas ─────────────────────────────────────────────────────────

class UserResponse(BaseModel):
    id: int
    username: str
    supabase_user_id: Optional[str] = None


# ─── Deprecated endpoints ────────────────────────────────────────────────────

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


# ─── Active endpoints ────────────────────────────────────────────────────────

@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        supabase_user_id=current_user.supabase_user_id,
    )
