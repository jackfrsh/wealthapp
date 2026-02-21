"""Database engine + session factory for Wealth App.

Supports:
- PostgreSQL via DATABASE_URL env var (Railway / production)
- SQLite as local fallback when DATABASE_URL is not set

NOTE:
- SQLModel.metadata.create_all() does NOT add missing columns to existing SQLite tables.
- For local dev we run a lightweight "ensure_schema" step to add new columns safely.
"""

from __future__ import annotations

import os
import logging
from pathlib import Path
from typing import Any

from sqlmodel import SQLModel, Session, create_engine, text

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

_connect_args: dict[str, Any] = {}
if _is_sqlite:
    _connect_args["check_same_thread"] = False

engine = create_engine(
    DATABASE_URL,
    connect_args=_connect_args,
    echo=bool(os.getenv("SQL_ECHO", "")),
    pool_pre_ping=not _is_sqlite,
)


def _sqlite_table_info(session: Session, table: str) -> list[tuple]:
    # PRAGMA table_info returns: (cid, name, type, notnull, dflt_value, pk)
    return list(session.exec(text(f"PRAGMA table_info({table})")).all())


def _sqlite_has_column(session: Session, table: str, column: str) -> bool:
    try:
        rows = _sqlite_table_info(session, table)
    except Exception:
        return False
    return any(r[1] == column for r in rows)


def _ensure_sqlite_schema() -> None:
    """Best-effort local schema upgrades for SQLite only.

    Safe operations only: ADD COLUMN with DEFAULT (so NOT NULL works).
    """
    if not _is_sqlite:
        return

    with Session(engine) as session:
        # If snapshots table doesn't exist yet, create_all will handle it.
        # This ensure step is for when table exists but columns are missing.
        try:
            # base_currency on snapshots
            if _sqlite_has_column(session, "snapshots", "id") and not _sqlite_has_column(
                session, "snapshots", "base_currency"
            ):
                logger.warning("ensure_schema: adding snapshots.base_currency (SQLite)")
                session.exec(
                    text(
                        "ALTER TABLE snapshots "
                        "ADD COLUMN base_currency TEXT NOT NULL DEFAULT 'GBP'"
                    )
                )

            # supabase_user_id on users (Supabase auth mapping)
            if _sqlite_has_column(session, "users", "id") and not _sqlite_has_column(
                session, "users", "supabase_user_id"
            ):
                logger.warning("ensure_schema: adding users.supabase_user_id (SQLite)")
                session.exec(
                    text("ALTER TABLE users ADD COLUMN supabase_user_id TEXT")
                )
                # Create index for fast lookups
                session.exec(
                    text(
                        "CREATE INDEX IF NOT EXISTS ix_users_supabase_user_id "
                        "ON users (supabase_user_id)"
                    )
                )

            # If you ever add more columns later, add more guards here.

                        # stripe_customer_id + stripe_subscription_id on users (Stripe billing mapping)
            if _sqlite_has_column(session, "users", "id") and not _sqlite_has_column(
                session, "users", "stripe_customer_id"
            ):
                logger.warning("ensure_schema: adding users.stripe_customer_id (SQLite)")
                session.exec(text("ALTER TABLE users ADD COLUMN stripe_customer_id TEXT"))
                session.exec(
                    text(
                        "CREATE INDEX IF NOT EXISTS ix_users_stripe_customer_id "
                        "ON users (stripe_customer_id)"
                    )
                )

            if _sqlite_has_column(session, "users", "id") and not _sqlite_has_column(
                session, "users", "stripe_subscription_id"
            ):
                logger.warning("ensure_schema: adding users.stripe_subscription_id (SQLite)")
                session.exec(text("ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT"))
                session.exec(
                    text(
                        "CREATE INDEX IF NOT EXISTS ix_users_stripe_subscription_id "
                        "ON users (stripe_subscription_id)"
                    )
                )

            # Ensure unique index on settings.user_id
            try:
                session.exec(
                    text(
                        "CREATE UNIQUE INDEX IF NOT EXISTS uq_settings_user_id "
                        "ON settings (user_id)"
                    )
                )
            except Exception:
                pass  # Index may already exist or table not yet created

            session.commit()
        except Exception as e:
            session.rollback()
            logger.warning("ensure_schema: SQLite ensure step failed: %s", e)


def create_db_and_tables() -> None:
    """Create all declared tables.

    For production with Postgres, prefer running migrations.
    For local SQLite, also run a lightweight ensure_schema step for new columns.
    """
    logger.info(
        "create_db_and_tables: using %s (%s)",
        "SQLite" if _is_sqlite else "PostgreSQL",
        DATABASE_URL,
    )

    # Create missing tables
    SQLModel.metadata.create_all(engine)

    # Ensure missing columns on SQLite
    _ensure_sqlite_schema()


def get_session():
    """FastAPI dependency providing a DB session with proper cleanup."""
    with Session(engine) as session:
        yield session
