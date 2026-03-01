from logging.config import fileConfig
from alembic import context
from sqlalchemy import engine_from_config, pool
from sqlmodel import SQLModel

import os
from urllib.parse import quote_plus

# Alembic Config object
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# --------------------------------------------------
# Build DATABASE_URL safely (Railway compatible)
# --------------------------------------------------

def build_db_url() -> str:
    # 1️⃣ Prefer explicit DATABASE_URL
    url = (os.getenv("DATABASE_URL") or "").strip()
    if url:
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        return url

    # 2️⃣ Otherwise build from PG* vars
    host = (os.getenv("PGHOST") or "").strip()
    port = (os.getenv("PGPORT") or "5432").strip()
    db = (os.getenv("PGDATABASE") or "").strip()
    user = (os.getenv("PGUSER") or "").strip()
    pw = (os.getenv("PGPASSWORD") or "").strip()

    if not all([host, db, user, pw]):
        raise RuntimeError(
            "DATABASE_URL or PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD must be set."
        )

    return f"postgresql://{quote_plus(user)}:{quote_plus(pw)}@{host}:{port}/{db}"


DATABASE_URL = build_db_url()

# IMPORTANT: import models so metadata is populated
import app.models  # noqa: F401

target_metadata = SQLModel.metadata


# --------------------------------------------------
# Offline migrations
# --------------------------------------------------

def run_migrations_offline():
    context.configure(
        url=DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


# --------------------------------------------------
# Online migrations
# --------------------------------------------------

def run_migrations_online():
    connectable = engine_from_config(
        {"sqlalchemy.url": DATABASE_URL},
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
