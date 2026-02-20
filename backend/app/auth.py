"""
Core auth module — Supabase JWT verification with local user mapping.

Verifies Supabase-issued JWTs server-side, then maps the Supabase `sub`
(UUID) to a local User row via `users.supabase_user_id`. All downstream
code continues to use `current_user.id` (int).

Environment variables:
  SUPABASE_URL            — e.g. https://<ref>.supabase.co  (required for JWKS)
  SUPABASE_JWKS_URL       — override for JWKS endpoint (optional)
  SUPABASE_JWT_ISSUER     — override expected issuer (optional)
  SUPABASE_JWT_AUDIENCE   — override expected audience (optional, default "authenticated")
  SUPABASE_JWT_SECRET     — fallback for legacy HS256 projects (optional)

Legacy helpers (hash_password, verify_password, create_access_token) are
retained so existing imports don't break, but they are no longer used for
API auth.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import jwt as pyjwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient, PyJWKClientError
from passlib.context import CryptContext
from sqlmodel import Session, select

from .database import get_session
from .models import User

logger = logging.getLogger("wealth.auth")

# Always load backend/.env regardless of where uvicorn is started from
ENV_PATH = Path(__file__).resolve().parents[1] / ".env"  # backend/.env
load_dotenv(dotenv_path=ENV_PATH)

# ─── Legacy local-auth helpers (kept for import compatibility) ──────────────

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-unused")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(subject: str) -> str:
    """Legacy helper — not used for Supabase auth."""
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return pyjwt.encode({"sub": subject, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


# ─── Supabase JWT configuration ────────────────────────────────────────────

SUPABASE_URL: str = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_JWT_SECRET: str = os.getenv("SUPABASE_JWT_SECRET", "").strip()

# Expected issuer/audience (strict defaults match Supabase tokens)
EXPECTED_ISSUER: Optional[str] = os.getenv("SUPABASE_JWT_ISSUER", "").strip() or None
if not EXPECTED_ISSUER and SUPABASE_URL:
    EXPECTED_ISSUER = f"{SUPABASE_URL}/auth/v1"

EXPECTED_AUDIENCE: str = os.getenv("SUPABASE_JWT_AUDIENCE", "").strip() or "authenticated"

# JWKS URL (IMPORTANT: Supabase publishes keys at /.well-known/jwks.json)
JWKS_URL: str = os.getenv("SUPABASE_JWKS_URL", "").strip()
if not JWKS_URL and SUPABASE_URL:
    JWKS_URL = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"

_jwks_client: Optional[PyJWKClient] = None
if JWKS_URL:
    try:
        _jwks_client = PyJWKClient(JWKS_URL, cache_keys=True, lifespan=3600)
    except TypeError:
        _jwks_client = PyJWKClient(JWKS_URL, cache_keys=True)
    logger.info("Supabase JWKS client configured: %s", JWKS_URL)
elif SUPABASE_JWT_SECRET:
    logger.info("Supabase auth: using HS256 fallback (SUPABASE_JWT_SECRET)")
else:
    logger.warning("No SUPABASE_URL/JWKS or SUPABASE_JWT_SECRET set — auth will reject all tokens")

security = HTTPBearer(auto_error=True)


def _ensure_default_settings(session: Session, user_id: int) -> None:
    """Create default Settings row if none exists. Race-safe."""
    from sqlalchemy.exc import IntegrityError
    from .models import Settings

    existing = session.exec(select(Settings).where(Settings.user_id == user_id)).first()
    if existing:
        return
    try:
        settings = Settings(user_id=user_id, base_currency="GBP", goal=0.0)
        session.add(settings)
        session.commit()
    except IntegrityError:
        session.rollback()
        # Already exists — fine


def _verify_supabase_jwt(token: str) -> dict:
    """Verify a Supabase JWT and return the decoded payload."""
    try:
        header = pyjwt.get_unverified_header(token)
    except pyjwt.DecodeError as exc:
        raise pyjwt.InvalidTokenError(f"Malformed token header: {exc}") from exc

    alg = (header.get("alg") or "").upper()

    # HS256 fallback (legacy projects)
    if alg == "HS256":
        if not SUPABASE_JWT_SECRET:
            raise pyjwt.InvalidTokenError("HS256 token but SUPABASE_JWT_SECRET is not set")

        return pyjwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience=EXPECTED_AUDIENCE,
            issuer=EXPECTED_ISSUER if EXPECTED_ISSUER else None,
            options={
                "require": ["exp", "sub"],
                "verify_signature": True,
                "verify_exp": True,
                "verify_aud": True,
                "verify_iss": bool(EXPECTED_ISSUER),
            },
        )

    # JWKS verification (ES256/RS256)
    if alg not in ("ES256", "RS256"):
        raise pyjwt.InvalidTokenError(f"Unsupported JWT alg: {alg}")

    if _jwks_client is None:
        raise pyjwt.InvalidTokenError("JWKS client not configured (missing SUPABASE_URL/SUPABASE_JWKS_URL)")

    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(token).key
    except PyJWKClientError as exc:
        raise pyjwt.InvalidTokenError(f"JWKS lookup failed: {exc}") from exc

    return pyjwt.decode(
        token,
        signing_key,
        algorithms=["ES256", "RS256"],
        audience=EXPECTED_AUDIENCE,
        issuer=EXPECTED_ISSUER if EXPECTED_ISSUER else None,
        options={
            "require": ["exp", "sub"],
            "verify_signature": True,
            "verify_exp": True,
            "verify_aud": True,
            "verify_iss": bool(EXPECTED_ISSUER),
        },
    )


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(security),
    session: Session = Depends(get_session),
) -> User:
    token = creds.credentials

    try:
        payload = _verify_supabase_jwt(token)
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    except pyjwt.InvalidTokenError as exc:
        logger.info("JWT verification failed: %s", exc)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    sub: str | None = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing sub claim")

    email: str = payload.get("email") or sub

    from sqlalchemy.exc import IntegrityError

    user = session.exec(select(User).where(User.supabase_user_id == sub)).first()

    if user is None:
        existing = session.exec(select(User).where(User.username == email)).first()

        if existing and not existing.supabase_user_id:
            existing.supabase_user_id = sub
            session.add(existing)
            try:
                session.commit()
                session.refresh(existing)
            except IntegrityError:
                session.rollback()
                existing = session.exec(select(User).where(User.username == email)).first()
            user = existing
        elif existing and existing.supabase_user_id:
            if existing.supabase_user_id == sub:
                user = existing
            else:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Username already linked to a different Supabase account",
                )
        else:
            # Race-safe creation: try insert, catch duplicate, re-fetch
            try:
                user = User(username=email, password_hash="", supabase_user_id=sub)
                session.add(user)
                session.commit()
                session.refresh(user)
            except IntegrityError:
                session.rollback()
                user = session.exec(select(User).where(User.username == email)).first()
                if user is None:
                    raise HTTPException(status_code=500, detail="User creation failed unexpectedly")
                # If existing row has no supabase_user_id, link it
                if not user.supabase_user_id:
                    user.supabase_user_id = sub
                    session.add(user)
                    session.commit()
                    session.refresh(user)
                elif user.supabase_user_id != sub:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Username already linked to a different Supabase account",
                    )

            # Race-safe default settings creation
            _ensure_default_settings(session, user.id)

    # Always ensure settings exist (covers linked-existing-user paths too)
    _ensure_default_settings(session, user.id)

    return user
