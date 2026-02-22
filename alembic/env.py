import os
from urllib.parse import quote_plus

def build_db_url() -> str:
    url = (os.getenv("DATABASE_URL") or "").strip()
    if url:
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        return url

    host = (os.getenv("PGHOST") or "").strip()
    port = (os.getenv("PGPORT") or "5432").strip()
    db = (os.getenv("PGDATABASE") or "").strip()
    user = (os.getenv("PGUSER") or "").strip()
    pw = (os.getenv("PGPASSWORD") or "").strip()

    if not all([host, db, user, pw]):
        raise RuntimeError("DATABASE_URL or PG* vars are required for migrations.")

    return f"postgresql://{quote_plus(user)}:{quote_plus(pw)}@{host}:{port}/{db}"

DATABASE_URL = build_db_url()


def run_migrations_offline():
    context.configure(
        url=DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


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
