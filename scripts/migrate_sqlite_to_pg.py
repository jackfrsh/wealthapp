#!/usr/bin/env python3
"""Migrate data from local SQLite to a Postgres database.

Usage:
    DATABASE_URL=postgresql://user:pass@host:5432/dbname python scripts/migrate_sqlite_to_pg.py

Reads from the local wealth.db (SQLite) and inserts all rows into the
Postgres database specified by DATABASE_URL.

Prerequisites:
    - Postgres database must have tables already created (run alembic upgrade head first)
    - pip install sqlmodel psycopg2-binary
"""
import json
import os
import sys

from sqlalchemy import text
from sqlmodel import Session, create_engine

SQLITE_PATH = os.getenv("SQLITE_PATH", "./wealth.db")
PG_URL = os.getenv("DATABASE_URL", "")

if not PG_URL:
    print("ERROR: Set DATABASE_URL to your Postgres connection string.", file=sys.stderr)
    sys.exit(1)

if PG_URL.startswith("postgres://"):
    PG_URL = PG_URL.replace("postgres://", "postgresql://", 1)

sqlite_engine = create_engine(f"sqlite:///{SQLITE_PATH}", connect_args={"check_same_thread": False})
pg_engine = create_engine(PG_URL)

# Tables in dependency order
TABLES = ["users", "settings", "accounts", "fx_rate_cache", "snapshots"]


def migrate():
    with Session(sqlite_engine) as src, Session(pg_engine) as dst:
        for table in TABLES:
            print(f"  Migrating {table}...")
            rows = src.exec(text(f"SELECT * FROM {table}")).all()
            if not rows:
                print(f"    (empty)")
                continue

            # Get column names
            cols_result = src.exec(text(f"PRAGMA table_info({table})"))
            col_names = [r[1] for r in cols_result.all()]

            for row in rows:
                values = dict(zip(col_names, row))
                placeholders = ", ".join(f":{c}" for c in col_names)
                columns = ", ".join(col_names)

                # Use ON CONFLICT DO NOTHING to skip duplicates
                stmt = text(
                    f"INSERT INTO {table} ({columns}) VALUES ({placeholders}) "
                    f"ON CONFLICT DO NOTHING"
                )
                dst.exec(stmt, values)

            dst.commit()
            print(f"    ✓ {len(rows)} rows")

    # Reset Postgres sequences to max(id)+1
    with Session(pg_engine) as dst:
        for table in TABLES:
            try:
                max_id = dst.exec(text(f"SELECT COALESCE(MAX(id), 0) FROM {table}")).one()[0]
                dst.exec(text(f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), :val, true)"), {"val": max(max_id, 1)})
                dst.commit()
            except Exception:
                dst.rollback()

    print("\n✅ Migration complete!")


if __name__ == "__main__":
    print(f"SQLite source: {SQLITE_PATH}")
    print(f"Postgres target: {PG_URL[:PG_URL.find('@') + 1]}...")
    print()
    migrate()
