from __future__ import annotations

import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool
from sqlmodel import SQLModel
from backend.app import models  # noqa: F401

# Alembic Config object
config = context.config

# Logging setup
if config.config_file_name is not None:
    fileConfig(config.config_file_name)


def _get_database_url() -> str:
    """
    Priority:
      1) DATABASE_URL env var (Railway Postgres)
      2) SQLite fallback for local dev
    """
    url = os.getenv("DATABASE_URL", "").strip()

    # Railway sometimes provides postgres:// which SQLAlchemy wants as postgresql://
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)

    if not url:
        # Local fallback — keep this simple and stable
        url = "sqlite:///./wealth.db"

    return url


# IMPORTANT: import your models so SQLModel.metadata is populated
# Adjust these imports if your paths differ.
# e.g. if your models are in backend/app/models.py:
from backend.app import models  # noqa: F401

# If you have multiple model modules, import them here as well:
# from backend.app.models_accounts import *  # noqa
# from backend.app.models_fx import *        # noqa

target_metadata = SQLModel.metadata


def run_migrations_offline() -> None:
    """Run migrations in offline mode."""
    url = _get_database_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,  # helps detect type changes
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in online mode."""
    # Override sqlalchemy.url from env, regardless of what's in alembic.ini
    configuration = config.get_section(config.config_ini_section) or {}
    configuration["sqlalchemy.url"] = _get_database_url()

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,  # ok for migrations
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()
