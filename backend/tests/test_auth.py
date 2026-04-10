"""
Tests for auth endpoints — /auth/me, DELETE /auth/account.
"""

from __future__ import annotations

import os
import sys

import pytest

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_auth.db")
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret-at-least-32-chars-long-padding")


@pytest.fixture(scope="module")
def test_app():
    from sqlmodel import SQLModel, Session, create_engine
    from fastapi.testclient import TestClient

    test_engine = create_engine(
        "sqlite:///./test_auth_integration.db",
        connect_args={"check_same_thread": False},
    )

    import backend.app.database as db_module
    original_engine = db_module.engine
    db_module.engine = test_engine

    import backend.app.models  # noqa: F401
    SQLModel.metadata.create_all(test_engine)

    from sqlalchemy import text
    with test_engine.begin() as conn:
        for col, col_type in [
            ("subscription_status", "TEXT"),
            ("trial_end_iso", "TEXT"),
            ("apple_subscription_status", "TEXT"),
        ]:
            try:
                with conn.begin():
                    conn.execute(text(f'ALTER TABLE settings ADD COLUMN "{col}" {col_type}'))
            except Exception:
                pass
        try:
            with conn.begin():
                conn.execute(text('ALTER TABLE users ADD COLUMN "apple_original_transaction_id" TEXT'))
        except Exception:
            pass

    def override_session():
        with Session(test_engine) as session:
            yield session

    from backend.app.main import app as fastapi_app
    from backend.app.database import get_session
    fastapi_app.dependency_overrides[get_session] = override_session

    client = TestClient(fastapi_app, raise_server_exceptions=True)
    yield client, test_engine

    db_module.engine = original_engine
    fastapi_app.dependency_overrides.clear()

    import os as _os
    try:
        _os.unlink("./test_auth_integration.db")
    except FileNotFoundError:
        pass


@pytest.fixture()
def db_session(test_app):
    from sqlmodel import Session
    _, engine = test_app
    with Session(engine) as session:
        yield session


def _create_user(db_session, uid: str):
    from backend.app.models import User, Settings, Account, Goal
    from sqlmodel import select

    existing = db_session.exec(select(User).where(User.supabase_user_id == uid)).first()
    if existing:
        return existing

    user = User(username=f"user-{uid}", supabase_user_id=uid)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    db_session.add(Settings(user_id=user.id))
    db_session.add(Account(user_id=user.id, name="Test Account"))
    db_session.add(Goal(user_id=user.id, name="Retirement"))
    db_session.commit()

    return user


def _override_auth_by_uid(supabase_uid: str):
    from fastapi import Depends
    from sqlmodel import Session, select
    from backend.app.models import User
    from backend.app.database import get_session

    def _dep(db: Session = Depends(get_session)):
        return db.exec(select(User).where(User.supabase_user_id == supabase_uid)).first()
    return _dep


class TestDeleteAccount:
    def test_delete_removes_user_and_related_rows(self, test_app, db_session):
        client, _ = test_app
        uid = "del-uid-001"
        user = _create_user(db_session, uid)
        user_id = user.id

        from backend.app.main import app
        from backend.app.auth import get_current_user
        app.dependency_overrides[get_current_user] = _override_auth_by_uid(uid)

        resp = client.delete("/api/auth/account")
        assert resp.status_code == 200
        assert resp.json()["status"] == "deleted"

        db_session.expire_all()
        from backend.app.models import User, Settings, Account, Goal
        from sqlmodel import select

        assert db_session.exec(select(User).where(User.id == user_id)).first() is None
        assert db_session.exec(select(Settings).where(Settings.user_id == user_id)).first() is None
        assert db_session.exec(select(Account).where(Account.user_id == user_id)).first() is None
        assert db_session.exec(select(Goal).where(Goal.user_id == user_id)).first() is None

    def test_delete_requires_auth(self, test_app, db_session):
        client, _ = test_app

        from backend.app.main import app
        from backend.app.auth import get_current_user
        # Remove override so real auth runs (no Bearer token → 401/403)
        app.dependency_overrides.pop(get_current_user, None)

        resp = client.delete("/api/auth/account")
        assert resp.status_code in (401, 403)
