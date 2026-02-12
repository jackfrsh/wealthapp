"""
Auth router: /auth/register, /auth/login, /auth/me
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from ..auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from ..database import get_session
from ..models import User, Settings

router = APIRouter(prefix="/auth", tags=["auth"])


# ─── Request / Response schemas ───────────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    username: str


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/register", response_model=UserResponse, status_code=201)
def register(body: RegisterRequest, session: Session = Depends(get_session)):
    if len(body.username.strip()) < 2:
        raise HTTPException(400, "Username must be at least 2 characters")
    if len(body.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")

    existing = session.exec(
        select(User).where(User.username == body.username.strip())
    ).first()
    if existing:
        raise HTTPException(409, "Username already taken")

    user = User(
        username=body.username.strip(),
        password_hash=hash_password(body.password),
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    # Create default settings for new user
    settings = Settings(user_id=user.id, base_currency="GBP", goal=0.0)
    session.add(settings)
    session.commit()

    return UserResponse(id=user.id, username=user.username)


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, session: Session = Depends(get_session)):
    user = session.exec(
        select(User).where(User.username == body.username.strip())
    ).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    token = create_access_token(subject=user.username)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return UserResponse(id=current_user.id, username=current_user.username)
