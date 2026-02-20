"""Alembic env.py for Wealth App.

Reads DATABASE_URL from the environment (same as the app).
Falls back to a deterministic SQLite path at the repo root for local dev.
"""
from __future__ import annotations

import os
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool
from sqlmodel import SQLModel

# Ensure repo root is on sys.path so `backend.*` imports work
REPO_ROOT = Path(__file__).resolve().parents[1]  # alembic/.. -> repo root
sys.path.insert(0, str(REPO_ROOT))

# Import models so SQLModel.metadata knows about all tables
from backend.app.models import User, Settings, Account, FxRateCache, Snapshot  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = SQLModel.metadata


def get_database_url() -> str:
    url = os.getenv("DATABASE_URL", "").strip()

    # Railway sometimes provides postgres://
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)

    if not url:
        db_path = REPO_ROOT / "wealth.db"
        url = f"sqlite:///{db_path}"

    return url

print("ALEMBIC sqlalchemy.url =", config.get_main_option("sqlalchemy.url"))

# Set the sqlalchemy.url for Alembic
url = os.getenv("DATABASE_URL", "").strip()
if url.startswith("postgres://"):
    url = url.replace("postgres://", "postgresql://", 1)

if not url:
    REPO_ROOT = Path(__file__).resolve().parents[1]
    url = f"sqlite:///{REPO_ROOT / 'wealth.db'}"

config.set_main_option("sqlalchemy.url", url)
print("ALEMBIC sqlalchemy.url =", url)

def run_migrations_offline() -> None:
    """Run migrations in offline mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in online mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
