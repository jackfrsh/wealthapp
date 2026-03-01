"""
Lightweight in-memory rate limiter + security headers.

Design goals:
- Works without Redis (single-instance Railway/local).
- Protects auth/billing/write endpoints from abuse.
- Avoids breaking UX by NOT rate-limiting normal GET/HEAD reads.
- Never rate-limits CORS preflight (OPTIONS).

Usage in main.py:
    from .middleware import add_middleware
    add_middleware(app)  # call AFTER CORS
"""

from __future__ import annotations

import logging
import time
from collections import defaultdict
from typing import Callable, Tuple

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

logger = logging.getLogger("wealth.middleware")


# ─────────────────────────────────────────────────────────────────────────────
# Rate limiter
# ─────────────────────────────────────────────────────────────────────────────

# Limits are per-IP per route *prefix*.
# We apply rate limiting primarily to "write" operations, and a few sensitive endpoints.

# Per-route limits: (max_requests, window_seconds)
ROUTE_LIMITS: dict[str, Tuple[int, int]] = {
    # Billing: prevent Stripe session spam
    "/api/billing/create-checkout": (6, 60),
    "/api/billing/checkout-session": (6, 60),
    "/api/billing/portal": (10, 60),
    "/api/billing/sync": (10, 60),

    # Auth: rate-limit login/register attempts
    "/api/auth/login": (10, 60),
    "/api/auth/register": (6, 60),

    # Writes: allow normal use, prevent abuse
    "/api/accounts": (120, 60),   # creates/updates can happen in bursts during setup
    "/api/goals": (120, 60),      # includes PATCH to goal assumptions
    "/api/settings": (60, 60),    # theme/currency changes shouldn't trip
    "/api/snapshots": (120, 60),
    "/api/events": (180, 60),
}

# Global fallback for write requests to any other /api/* route
GLOBAL_WRITE_LIMIT = (240, 60)  # per IP


class _SlidingWindow:
    """Sliding window counter. Good enough for a single-process deployment."""

    __slots__ = ("_buckets",)

    def __init__(self):
        # Key: "ip:prefix" -> list[timestamps]
        self._buckets: dict[str, list[float]] = defaultdict(list)

    def is_allowed(self, key: str, max_requests: int, window: int) -> bool:
        now = time.monotonic()
        cutoff = now - window
        timestamps = self._buckets[key]

        # Prune occasionally (bounded growth)
        if len(timestamps) > max_requests * 2:
            self._buckets[key] = timestamps = [t for t in timestamps if t > cutoff]

        # Count recent requests
        recent = 0
        for t in timestamps:
            if t > cutoff:
                recent += 1

        if recent >= max_requests:
            return False

        timestamps.append(now)
        return True

    def cleanup(self) -> None:
        """Periodic cleanup of stale keys (keeps memory bounded)."""
        now = time.monotonic()
        stale_keys = []
        # Keep a little longer than the largest window (we use 60s) to be safe
        cutoff = now - 180

        for key, timestamps in list(self._buckets.items()):
            kept = [t for t in timestamps if t > cutoff]
            if kept:
                self._buckets[key] = kept
            else:
                stale_keys.append(key)

        for key in stale_keys:
            self._buckets.pop(key, None)


_window = _SlidingWindow()
_cleanup_counter = 0


def _get_client_ip(request: Request) -> str:
    """Extract client IP, respecting X-Forwarded-For from Railway/proxies."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def _match_route_limit(path: str) -> Tuple[str, int, int]:
    """Return (prefix, max_requests, window_seconds) for a given path."""
    for prefix, (max_req, window) in ROUTE_LIMITS.items():
        if path.startswith(prefix):
            return prefix, max_req, window
    return "/api/", GLOBAL_WRITE_LIMIT[0], GLOBAL_WRITE_LIMIT[1]


def _is_write_method(method: str) -> bool:
    return method.upper() in ("POST", "PUT", "PATCH", "DELETE")


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        global _cleanup_counter

        # Never rate-limit CORS preflight
        if request.method == "OPTIONS":
            return await call_next(request)

        path = request.url.path
        method = request.method.upper()

        # Only consider API routes
        if not path.startswith("/api/"):
            return await call_next(request)

        # Do NOT rate-limit normal reads — avoids breaking dashboard/forecast polling and charts
        if method in ("GET", "HEAD"):
            return await call_next(request)

        # Health is not under /api in your app, but keep this guard anyway
        if path == "/health":
            return await call_next(request)

        # Determine limits
        prefix, max_req, window = _match_route_limit(path)

        # If max_req is 0, treat as unlimited (not used here but future-proof)
        if max_req <= 0:
            return await call_next(request)

        ip = _get_client_ip(request)
        key = f"{ip}:{prefix}"

        if not _window.is_allowed(key, max_req, window):
            logger.warning("Rate limited: %s %s from %s (bucket=%s)", method, path, ip, prefix)
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please try again shortly."},
                # Retry-After in seconds
                headers={"Retry-After": str(window)},
            )

        # Periodic cleanup
        _cleanup_counter += 1
        if _cleanup_counter % 200 == 0:
            _window.cleanup()

        return await call_next(request)


# ─────────────────────────────────────────────────────────────────────────────
# Security headers
# ─────────────────────────────────────────────────────────────────────────────

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add standard security headers to every response."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)

        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"

        # HSTS (only effective over HTTPS).
        # NOTE: preload/includeSubDomains are hard to roll back once preloaded.
        response.headers["Strict-Transport-Security"] = (
            "max-age=63072000; includeSubDomains; preload"
        )

        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=(self)"

        return response


# ─────────────────────────────────────────────────────────────────────────────
# Registration
# ─────────────────────────────────────────────────────────────────────────────

def add_middleware(app) -> None:
    """Register all custom middleware. Call from main.py AFTER CORS."""
    # Starlette/FastAPI: last added runs first (outermost).
    # Make SecurityHeaders outermost so even 429s carry headers.
    app.add_middleware(RateLimitMiddleware)
    app.add_middleware(SecurityHeadersMiddleware)