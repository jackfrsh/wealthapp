"""
Background session helper.

Provides a standalone Session for fire-and-forget async tasks
that can't use the request-scoped FastAPI dependency.
"""
from __future__ import annotations

from contextlib import contextmanager

from sqlmodel import Session

from .database import engine


@contextmanager
def get_bg_session():
    """Yield a short-lived session for background work."""
    with Session(engine) as session:
        yield session
