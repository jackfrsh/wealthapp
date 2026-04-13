"""
Tests for dashboard history filtering when the user changes base currency.

Covers:
- history_currency_changed flag is True when old snapshots exist in a different currency
  and no comparable snapshots exist in the selected range
- history_currency_changed is False when all snapshots match the current base currency
- Series only contains snapshots matching base_currency (cross-currency snapshots excluded)
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone

import pytest

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_dashboard.db")
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret-at-least-32-chars-long-padding")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")


@pytest.fixture(scope="module")
def test_app():
    from sqlmodel import SQLModel, Session, create_engine
    from fastapi.testclient import TestClient

    engine = create_engine(
        "sqlite:///./test_dashboard_int.db",
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
        _os.unlink("./test_dashboard_int.db")
    except FileNotFoundError:
        pass


@pytest.fixture()
def db_session(test_app):
    from sqlmodel import Session
    _, engine = test_app
    with Session(engine) as s:
        yield s


def _seed_user(session, uid: str, base_currency: str = "GBP"):
    from backend.app.models import User, Settings
    from sqlmodel import select

    existing = session.exec(select(User).where(User.supabase_user_id == uid)).first()
    if existing:
        return existing

    user = User(username=f"user-{uid}", supabase_user_id=uid)
    session.add(user)
    session.commit()
    session.refresh(user)
    session.add(Settings(user_id=user.id, base_currency=base_currency))
    session.commit()
    return user


def _add_snapshot(session, user_id: int, base_currency: str, total: float, hours_ago: int = 1):
    import json
    from backend.app.models import Snapshot

    snap = Snapshot(
        user_id=user_id,
        base_currency=base_currency,
        total_base=total,
        fx_as_of="2026-01-01",
        excluded_accounts=0,
        breakdown_json=json.dumps([]),
        created_at=datetime.now(timezone.utc) - timedelta(hours=hours_ago),
    )
    session.add(snap)
    session.commit()
    return snap


class TestDashboardCurrencyFiltering:

    def test_history_currency_changed_true_when_old_snaps_are_different_currency(
        self, test_app, db_session
    ):
        """
        User was on USD, switched to GBP. Old USD snapshots should not pollute the
        GBP series, and history_currency_changed should be True (with no GBP range series).
        """
        from backend.app.auth import get_current_user
        from backend.app.main import app as fastapi_app
        from unittest.mock import AsyncMock, patch

        client, _ = test_app
        user = _seed_user(db_session, uid="dash-currency-changed", base_currency="GBP")

        # Old snapshots in USD (before currency change)
        _add_snapshot(db_session, user.id, base_currency="USD", total=10_000, hours_ago=48)
        _add_snapshot(db_session, user.id, base_currency="USD", total=11_000, hours_ago=36)
        # No GBP snapshots yet

        async def _auth_override():
            return user

        fastapi_app.dependency_overrides[get_current_user] = _auth_override

        with patch("backend.app.routers.dashboard.get_fx_cache") as mock_fx:
            mock_cache = AsyncMock()
            mock_cache.get_rates.return_value = {}
            mock_cache.cache_date = "2026-01-01"
            mock_fx.return_value = mock_cache

            try:
                resp = client.get("/api/dashboard?range=1M")
                assert resp.status_code == 200
                data = resp.json()
                # Series should be empty (no GBP snapshots)
                assert data["series"] == []
                # Flag should be set because old USD snapshots exist
                assert data["history_currency_changed"] is True
            finally:
                del fastapi_app.dependency_overrides[get_current_user]

    def test_history_currency_changed_false_when_all_snaps_match(
        self, test_app, db_session
    ):
        """All snapshots in GBP — history_currency_changed should be False."""
        from backend.app.auth import get_current_user
        from backend.app.main import app as fastapi_app
        from unittest.mock import AsyncMock, patch

        client, _ = test_app
        user = _seed_user(db_session, uid="dash-all-gbp", base_currency="GBP")

        _add_snapshot(db_session, user.id, base_currency="GBP", total=15_000, hours_ago=48)
        _add_snapshot(db_session, user.id, base_currency="GBP", total=16_000, hours_ago=12)

        async def _auth_override():
            return user

        fastapi_app.dependency_overrides[get_current_user] = _auth_override

        with patch("backend.app.routers.dashboard.get_fx_cache") as mock_fx:
            mock_cache = AsyncMock()
            mock_cache.get_rates.return_value = {}
            mock_cache.cache_date = "2026-01-01"
            mock_fx.return_value = mock_cache

            try:
                resp = client.get("/api/dashboard?range=1M")
                assert resp.status_code == 200
                data = resp.json()
                assert data["history_currency_changed"] is False
                # Both GBP snapshots are in range
                assert len(data["series"]) == 2
            finally:
                del fastapi_app.dependency_overrides[get_current_user]

    def test_cross_currency_snapshots_excluded_from_series(
        self, test_app, db_session
    ):
        """USD snapshots must not appear in the GBP series."""
        from backend.app.auth import get_current_user
        from backend.app.main import app as fastapi_app
        from unittest.mock import AsyncMock, patch

        client, _ = test_app
        user = _seed_user(db_session, uid="dash-mixed-currency", base_currency="GBP")

        _add_snapshot(db_session, user.id, base_currency="USD", total=9_000, hours_ago=72)
        _add_snapshot(db_session, user.id, base_currency="GBP", total=10_000, hours_ago=24)

        async def _auth_override():
            return user

        fastapi_app.dependency_overrides[get_current_user] = _auth_override

        with patch("backend.app.routers.dashboard.get_fx_cache") as mock_fx:
            mock_cache = AsyncMock()
            mock_cache.get_rates.return_value = {}
            mock_cache.cache_date = "2026-01-01"
            mock_fx.return_value = mock_cache

            try:
                resp = client.get("/api/dashboard?range=1M")
                assert resp.status_code == 200
                data = resp.json()
                # Only the GBP snapshot appears in series
                assert len(data["series"]) == 1
                assert data["series"][0]["v"] == pytest.approx(10_000.0)
            finally:
                del fastapi_app.dependency_overrides[get_current_user]

    def test_history_currency_changed_false_when_no_snapshots(
        self, test_app, db_session
    ):
        """New user with no snapshots — flag should be False (no currency mismatch)."""
        from backend.app.auth import get_current_user
        from backend.app.main import app as fastapi_app
        from unittest.mock import AsyncMock, patch

        client, _ = test_app
        user = _seed_user(db_session, uid="dash-no-snaps", base_currency="GBP")

        async def _auth_override():
            return user

        fastapi_app.dependency_overrides[get_current_user] = _auth_override

        with patch("backend.app.routers.dashboard.get_fx_cache") as mock_fx:
            mock_cache = AsyncMock()
            mock_cache.get_rates.return_value = {}
            mock_cache.cache_date = "2026-01-01"
            mock_fx.return_value = mock_cache

            try:
                resp = client.get("/api/dashboard?range=1M")
                assert resp.status_code == 200
                data = resp.json()
                assert data["history_currency_changed"] is False
                assert data["series"] == []
            finally:
                del fastapi_app.dependency_overrides[get_current_user]
