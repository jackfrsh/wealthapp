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
    """
    Lightweight schema ensure (no Alembic).
    IMPORTANT: must import models so all tables are registered in SQLModel.metadata.
    """
    try:
        from . import models  # noqa: F401

        SQLModel.metadata.create_all(engine)
        logger.info("Schema ensured (create_all)")

        # create_all() will not add new columns to existing tables,
        # so run lightweight idempotent column migrations afterwards.
        with engine.begin() as conn:
            _migrate_columns(conn)

    except Exception as e:
        logger.exception("ensure_schema failed: %s", str(e))
        raise


def _migrate_columns(conn) -> None:
    """Add missing columns to existing tables. Safe to run repeatedly."""
    _add_column_if_missing(conn, "settings", "subscription_status", "TEXT")
    _add_column_if_missing(conn, "settings", "trial_end_iso", "TEXT")
    _add_column_if_missing(conn, "settings", "apple_subscription_status", "TEXT")
    _add_column_if_missing(conn, "users", "apple_original_transaction_id", "TEXT")


def _add_column_if_missing(conn, table: str, column: str, col_type: str) -> None:
    """Safely add a column to an existing table."""
    try:
        result = conn.execute(
            text(
                """
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = :table
                  AND column_name = :column
                """
            ),
            {"table": table, "column": column},
        )

        if result.fetchone() is not None:
            return

        logger.info("Adding missing column %s.%s (%s)", table, column, col_type)
        conn.execute(
            text(f'ALTER TABLE "{table}" ADD COLUMN "{column}" {col_type}')
        )

    except Exception as e:
        # In production we fail fast: schema drift causes random 500s later.
        is_prod = (
            os.getenv("RAILWAY_ENVIRONMENT") == "production"
            or os.getenv("ENV") == "production"
        )
        if is_prod:
            raise RuntimeError(
                f"Column migration failed for {table}.{column}: {e}"
            ) from e

        logger.warning("Column migration %s.%s skipped: %s", table, column, e)


def get_session():
    """FastAPI dependency providing a DB session with proper cleanup."""
    with Session(engine) as session:
        yield session