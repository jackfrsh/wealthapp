"""Database engine + session factory for Wealth App.

Supports:
- PostgreSQL via DATABASE_URL env var (Railway / production)
- SQLite as local fallback when DATABASE_URL is not set
"""
from __future__ import annotations

import os
import logging
from pathlib import Path

from sqlmodel import SQLModel, Session, create_engine

logger = logging.getLogger("wealth.database")


DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

# Railway provides postgres:// but SQLAlchemy requires postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

ROOT = Path(__file__).resolve().parents[2]  # backend/app/.. -> repo root
DB_PATH = ROOT / "wealth.db"

_is_sqlite = False
if not DATABASE_URL:
    DATABASE_URL = f"sqlite:///{DB_PATH}"
    _is_sqlite = True

_connect_args: dict = {}
if _is_sqlite:
    _connect_args["check_same_thread"] = False

engine = create_engine(
    DATABASE_URL,
    connect_args=_connect_args,
    echo=bool(os.getenv("SQL_ECHO", "")),
    pool_pre_ping=not _is_sqlite,
)


def create_db_and_tables() -> None:
    """Create all declared tables.

    For production with Postgres, prefer running Alembic migrations.
    This fallback ensures the app still boots on first run / local dev.
    """
    logger.info("create_db_and_tables: using %s", "SQLite" if _is_sqlite else "PostgreSQL")
    SQLModel.metadata.create_all(engine)


def get_session():
    """FastAPI dependency providing a DB session with proper cleanup."""
    with Session(engine) as session:
        yield session
