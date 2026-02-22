from __future__ import annotations

import os
import logging
from urllib.parse import quote_plus

from sqlmodel import Session, create_engine

logger = logging.getLogger("wealth.database")


def build_db_url() -> str:
    # 1️⃣ Prefer explicit DATABASE_URL if provided
    url = (os.getenv("DATABASE_URL") or "").strip()
    if url:
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        return url

    # 2️⃣ Otherwise build from PG* vars (Railway-safe)
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

engine = create_engine(
    DATABASE_URL,
    echo=bool(os.getenv("SQL_ECHO", "")),
    pool_pre_ping=True,
)


def get_session():
    with Session(engine) as session:
        yield session
