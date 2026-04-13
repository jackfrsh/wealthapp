"""
Tests for POST /snapshots/ensure — freshness-based auto-snapshot endpoint.

Covers:
- Returns existing snapshot when one exists within 24h (written=False)
- Writes a new snapshot when last one is older than 24h
- Returns {written: False, snapshot: None} when user has no accounts
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_snapshots.db")
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret-at-least-32-chars-long-padding")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")


@pytest.fixture(scope="module")
def test_app():
    from sqlmodel import SQLModel, Session, create_engine
    from fastapi.testclient import TestClient

    engine = create_engine(
        "sqlite:///./test_snapshots_int.db",
        connect_args={"check_same_thread": False},
    )

    import backend.app.database as db_module
    original_engine = db_module.engine
    db_module.engine = engine

    import backend.app.models  # noqa: F401
    SQLModel.metadata.create_all(engine)

    def override_session():
        with Session(engine) as session:
            yield session

    from backend.app.main import app as fastapi_app
    from backend.app.database import get_session
    fastapi_app.dependency_overrides[get_session] = override_session

    client = TestClient(fastapi_app, raise_server_exceptions=True)
    yield client, engine

    db_module.engine = original_engine
    fastapi_app.dependency_overrides.clear()
    import os as _os
    try:
        _os.unlink("./test_snapshots_int.db")
    except FileNotFoundError:
        pass


@pytest.fixture()
def db_session(test_app):
    from sqlmodel import Session
    _, engine = test_app
    with Session(engine) as s:
        yield s


def _seed_user(session, uid: str, with_account: bool = True):
    from backend.app.models import User, Settings, Account
    from sqlmodel import select

    existing = session.exec(select(User).where(User.supabase_user_id == uid)).first()
    if existing:
        return existing

    user = User(username=f"user-{uid}", supabase_user_id=uid)
    session.add(user)
    session.commit()
    session.refresh(user)
    session.add(Settings(user_id=user.id, base_currency="GBP"))
    if with_account:
        session.add(Account(
            user_id=user.id,
            name="ISA",
            currency="GBP",
            balance=10_000.0,
            include_in_net_worth=True,
        ))
    session.commit()
    return user


def _make_auth_override(user):
    from backend.app.auth import get_current_user

    async def _override():
        return user

    return get_current_user, _override


def _mock_write_snapshot_result(user, session):
    """Return a Snapshot-like object for patching write_snapshot."""
    from backend.app.models import Snapshot
    import json

    snap = Snapshot(
        user_id=user.id,
        base_currency="GBP",
        total_base=10_000.0,
        fx_as_of="2026-01-01",
        excluded_accounts=0,
        breakdown_json=json.dumps([]),
        created_at=datetime.now(timezone.utc),
    )
    session.add(snap)
    session.commit()
    session.refresh(snap)
    return snap


# ─── Tests ───────────────────────────────────────────────────────────────────

class TestEnsureSnapshot:

    def test_returns_existing_when_fresh(self, test_app, db_session):
        """If a snapshot exists within 24h, /ensure returns it without writing."""
        from backend.app.models import Snapshot
        from backend.app.auth import get_current_user
        from backend.app.main import app as fastapi_app
        import json

        client, _ = test_app
        user = _seed_user(db_session, uid="snap-fresh-user")

        # Seed a recent snapshot
        snap = Snapshot(
            user_id=user.id,
            base_currency="GBP",
            total_base=12_000.0,
            fx_as_of="2026-01-01",
            excluded_accounts=0,
            breakdown_json=json.dumps([]),
            created_at=datetime.now(timezone.utc),
        )
        db_session.add(snap)
        db_session.commit()

        async def _auth_override():
            return user

        fastapi_app.dependency_overrides[get_current_user] = _auth_override

        try:
            resp = client.post("/api/snapshots/ensure")
            assert resp.status_code == 200
            data = resp.json()
            assert data["written"] is False
            assert data["snapshot"] is not None
            assert data["snapshot"]["total_base"] == pytest.approx(12_000.0)
        finally:
            del fastapi_app.dependency_overrides[get_current_user]

    def test_writes_new_snapshot_when_stale(self, test_app, db_session):
        """If the last snapshot is >24h old, /ensure writes a new one."""
        from backend.app.models import Snapshot
        from backend.app.auth import get_current_user
        from backend.app.main import app as fastapi_app
        import json

        client, _ = test_app
        user = _seed_user(db_session, uid="snap-stale-user")

        # Only seed an old snapshot (25 hours ago) — no fresh one
        old_snap = Snapshot(
            user_id=user.id,
            base_currency="GBP",
            total_base=5_000.0,
            fx_as_of="2026-01-01",
            excluded_accounts=0,
            breakdown_json=json.dumps([]),
            created_at=datetime.now(timezone.utc) - timedelta(hours=25),
        )
        db_session.add(old_snap)
        db_session.commit()

        # Build a mock return value without persisting it (write_snapshot is patched away)
        new_snap = Snapshot(
            id=9999,
            user_id=user.id,
            base_currency="GBP",
            total_base=10_000.0,
            fx_as_of="2026-01-01",
            excluded_accounts=0,
            breakdown_json=json.dumps([]),
            created_at=datetime.now(timezone.utc),
        )

        async def _auth_override():
            return user

        fastapi_app.dependency_overrides[get_current_user] = _auth_override

        with patch("backend.app.routers.snapshots.write_snapshot", new_callable=AsyncMock) as mock_write:
            mock_write.return_value = new_snap
            try:
                resp = client.post("/api/snapshots/ensure")
                assert resp.status_code == 200
                data = resp.json()
                assert data["written"] is True
                mock_write.assert_awaited_once()
            finally:
                del fastapi_app.dependency_overrides[get_current_user]

    def test_no_snapshot_when_no_accounts(self, test_app, db_session):
        """User with no accounts gets {written: False, snapshot: None}."""
        from backend.app.auth import get_current_user
        from backend.app.main import app as fastapi_app

        client, _ = test_app
        user = _seed_user(db_session, uid="snap-no-accounts-user", with_account=False)

        async def _auth_override():
            return user

        fastapi_app.dependency_overrides[get_current_user] = _auth_override

        try:
            resp = client.post("/api/snapshots/ensure")
            assert resp.status_code == 200
            data = resp.json()
            assert data["written"] is False
            assert data["snapshot"] is None
        finally:
            del fastapi_app.dependency_overrides[get_current_user]

    def test_freshness_threshold_is_24h(self, test_app, db_session):
        """A snapshot at exactly 23h old should still be considered fresh (no write)."""
        from backend.app.models import Snapshot
        from backend.app.auth import get_current_user
        from backend.app.main import app as fastapi_app
        import json

        client, _ = test_app
        user = _seed_user(db_session, uid="snap-23h-user")

        snap = Snapshot(
            user_id=user.id,
            base_currency="GBP",
            total_base=8_000.0,
            fx_as_of="2026-01-01",
            excluded_accounts=0,
            breakdown_json=json.dumps([]),
            created_at=datetime.now(timezone.utc) - timedelta(hours=23),
        )
        db_session.add(snap)
        db_session.commit()

        async def _auth_override():
            return user

        fastapi_app.dependency_overrides[get_current_user] = _auth_override

        try:
            resp = client.post("/api/snapshots/ensure")
            assert resp.status_code == 200
            data = resp.json()
            assert data["written"] is False
        finally:
            del fastapi_app.dependency_overrides[get_current_user]
