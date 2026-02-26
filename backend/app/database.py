from __future__ import annotations

import os
import logging

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
    """
    Lightweight schema ensure (no Alembic).
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