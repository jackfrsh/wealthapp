from __future__ import annotations

import logging
import os

from sqlalchemy import text
from sqlmodel import Session, SQLModel, create_engine

logger = logging.getLogger("wealth.database")

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is required (Postgres only).")

# Railway sometimes provides postgres://; SQLAlchemy expects postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(
    DATABASE_URL,
    echo=bool(os.getenv("SQL_ECHO", "")),
    pool_pre_ping=True,
)


def ensure_schema() -> None:
    """Create any tables not yet covered by Alembic migrations.

    Alembic (run via `alembic upgrade head` in the Dockerfile) is the canonical
    migration path. This function only calls SQLModel.metadata.create_all() as a
    safety net for tables that don't yet have an Alembic migration (e.g. newly
    added tables before a migration is written). It never mutates existing columns.

    IMPORTANT: must import models so all tables are registered in SQLModel.metadata.
    """
    try:
        from . import models  # noqa: F401

        SQLModel.metadata.create_all(engine)
        logger.info("Schema ensured (create_all)")

    except Exception as e:
        logger.exception("ensure_schema failed: %s", str(e))
        raise


def get_session():
    """FastAPI dependency providing a DB session with proper cleanup."""
    with Session(engine) as session:
        yield session