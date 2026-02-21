from __future__ import annotations

import os
from typing import Optional, Dict, Any

import requests
from cachetools import TTLCache
from jose import jwt
from jose.exceptions import JWTError

# Env: SUPABASE_URL="https://xxxx.supabase.co"
SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
if not SUPABASE_URL:
    raise RuntimeError("SUPABASE_URL env var is required (e.g. https://<ref>.supabase.co)")

JWKS_URL = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
ISSUER = f"{SUPABASE_URL}/auth/v1"

# Cache JWKS for 6 hours
_jwks_cache: TTLCache = TTLCache(maxsize=2, ttl=6 * 60 * 60)


def _get_jwks() -> Dict[str, Any]:
    jwks = _jwks_cache.get("jwks")
    if jwks:
        return jwks
    resp = requests.get(JWKS_URL, timeout=8)
    resp.raise_for_status()
    jwks = resp.json()
    _jwks_cache["jwks"] = jwks
    return jwks


def verify_supabase_jwt(token: str) -> Dict[str, Any]:
    """
    Verifies Supabase access token signature + issuer.
    Returns decoded claims if valid, raises ValueError if invalid.
    """
    try:
        jwks = _get_jwks()
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        if not kid:
            raise ValueError("Missing kid in token header")

        key = None
        for k in jwks.get("keys", []):
            if k.get("kid") == kid:
                key = k
                break
        if not key:
            raise ValueError("Unknown kid; JWKS may be stale")

        claims = jwt.decode(
            token,
            key,
            algorithms=[header.get("alg", "RS256")],
            issuer=ISSUER,
            options={
                "verify_aud": False,  # Supabase JWTs commonly use aud="authenticated"; we can enforce manually if you want
            },
        )

        # Optional: enforce aud if present
        aud = claims.get("aud")
        if aud and aud not in ("authenticated", "anon"):
            raise ValueError("Invalid aud")

        return claims
    except (JWTError, requests.RequestException) as e:
        raise ValueError("Invalid or expired token") from e