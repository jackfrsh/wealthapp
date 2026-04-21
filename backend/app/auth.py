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
"""

from __future__ import annotations

import json
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
from sqlmodel import Session, select

from .database import get_session
from .models import User, AnalyticsEvent

logger = logging.getLogger("wealth.auth")


def _log_event(session: Session, user_id: int, name: str, meta: dict | None = None) -> None:
    """Best-effort analytics logging. Never blocks auth."""
    try:
        session.add(
            AnalyticsEvent(
                user_id=user_id,
                name=name,
                meta_json=json.dumps(meta or {}),
            )
        )
        session.commit()
    except Exception:
        session.rollback()

# Always load backend/.env regardless of where uvicorn is started from
ENV_PATH = Path(__file__).resolve().parents[1] / ".env"  # backend/.env
load_dotenv(dotenv_path=ENV_PATH)

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
                # A valid Supabase JWT arrived for this email but with a different UUID.
                # This happens when users re-register after account deletion, or authenticate
                # via a second provider that Supabase did not auto-link. Returning 409 here
                # breaks every protected route for the user with no recovery path on the
                # client side. Return 401 so the client re-authenticates and support can
                # investigate the sub mismatch (old=%s, new=%s).
                logger.warning(
                    "Supabase sub mismatch for email %s: stored=%s incoming=%s",
                    email,
                    existing.supabase_user_id,
                    sub,
                )
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Account authentication state is inconsistent. Please sign out and sign in again.",
                )
        else:
            # Race-safe creation: try insert, catch duplicate, re-fetch
            try:
                user = User(username=email, supabase_user_id=sub)
                session.add(user)
                session.commit()
                session.refresh(user)

                # Ensure settings exist
                _ensure_default_settings(session, user.id)

                # Server-grade signup event (fires once: user row creation)
                _log_event(session, user.id, "signup")

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
                    logger.warning(
                        "Supabase sub mismatch (race path) for email %s: stored=%s incoming=%s",
                        email,
                        user.supabase_user_id,
                        sub,
                    )
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Account authentication state is inconsistent. Please sign out and sign in again.",
                    )

                # Ensure settings exist (covers duplicate/create-race path too)
                _ensure_default_settings(session, user.id)

    # Always ensure settings exist (covers linked-existing-user paths too)
    _ensure_default_settings(session, user.id)

    return user