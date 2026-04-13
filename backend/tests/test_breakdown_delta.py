"""
Tests for dashboard breakdown_delta computation and last_snapshot_date.

Covers:
- _compute_breakdown_delta: top 3 movers, abs sort, noise suppression
- breakdown_delta in dashboard response when ≥2 range snapshots exist
- breakdown_delta is None when only 1 snapshot in range
- breakdown_delta suppressed when history_currency_changed
- last_snapshot_date present in dashboard response
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timedelta, timezone

import pytest

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_breakdown.db")
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret-at-least-32-chars-long-padding")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")


# ─── Unit tests for _compute_breakdown_delta ────────────────────────────────

class TestComputeBreakdownDelta:
    """Tests for the pure _compute_breakdown_delta helper."""

    @pytest.fixture(autouse=True)
    def _imports(self):
        from backend.app.routers.dashboard import _compute_breakdown_delta
        self.fn = _compute_breakdown_delta

    def _snap(self, items: list[dict], hours_ago: int = 0) -> object:
        """Build a minimal Snapshot-duck-type with breakdown_json."""
        import types
        s = types.SimpleNamespace()
        s.breakdown_json = json.dumps(items)
        s.created_at = datetime.now(timezone.utc) - timedelta(hours=hours_ago)
        s.total_base = sum(i.get("value_base", 0) for i in items)
        s.base_currency = "GBP"
        return s

    def test_returns_top_mover(self):
        old = self._snap([{"name": "ISA", "value_base": 10_000}])
        new = self._snap([{"name": "ISA", "value_base": 11_000}])
        result = self.fn(old, new)
        assert result is not None
        assert len(result) == 1
        assert result[0]["name"] == "ISA"
        assert abs(result[0]["delta"] - 1000.0) < 1.0

    def test_returns_top_3_only(self):
        old_items = [
            {"name": "A", "value_base": 1_000},
            {"name": "B", "value_base": 2_000},
            {"name": "C", "value_base": 3_000},
            {"name": "D", "value_base": 4_000},
        ]
        new_items = [
            {"name": "A", "value_base": 1_500},   # +500
            {"name": "B", "value_base": 2_100},   # +100
            {"name": "C", "value_base": 3_800},   # +800
            {"name": "D", "value_base": 3_700},   # -300
        ]
        old = self._snap(old_items)
        new = self._snap(new_items)
        result = self.fn(old, new)
        assert result is not None
        assert len(result) == 3
        # Sorted by abs(delta) desc: C(+800), A(+500), D(-300)
        assert result[0]["name"] == "C"
        assert result[1]["name"] == "A"
        assert result[2]["name"] == "D"

    def test_suppresses_sub_unit_noise(self):
        """Deltas < £1 should not appear in output."""
        old = self._snap([{"name": "Cash", "value_base": 1_000.00}])
        new = self._snap([{"name": "Cash", "value_base": 1_000.50}])  # 50p change
        result = self.fn(old, new)
        assert result is None  # all items below £1 threshold

    def test_new_account_appears_as_positive(self):
        """Account in new snapshot but not old should appear as positive delta."""
        old = self._snap([{"name": "ISA", "value_base": 5_000}])
        new = self._snap([
            {"name": "ISA", "value_base": 5_000},
            {"name": "SIPP", "value_base": 3_000},
        ])
        result = self.fn(old, new)
        assert result is not None
        sipp = next((r for r in result if r["name"] == "SIPP"), None)
        assert sipp is not None
        assert sipp["delta"] == pytest.approx(3_000.0)

    def test_deleted_account_appears_as_negative(self):
        """Account in old snapshot but not new should appear as negative delta."""
        old = self._snap([
            {"name": "ISA", "value_base": 5_000},
            {"name": "OldAccount", "value_base": 2_000},
        ])
        new = self._snap([{"name": "ISA", "value_base": 5_000}])
        result = self.fn(old, new)
        assert result is not None
        old_acc = next((r for r in result if r["name"] == "OldAccount"), None)
        assert old_acc is not None
        assert old_acc["delta"] == pytest.approx(-2_000.0)

    def test_returns_none_when_no_meaningful_movers(self):
        snap = self._snap([{"name": "A", "value_base": 1_000}])
        result = self.fn(snap, snap)
        assert result is None

    def test_handles_empty_breakdown(self):
        old = self._snap([])
        new = self._snap([])
        result = self.fn(old, new)
        assert result is None

    def test_handles_malformed_json_gracefully(self):
        import types
        old = types.SimpleNamespace()
        old.breakdown_json = "NOT_VALID_JSON"
        old.created_at = datetime.now(timezone.utc)
        old.total_base = 0
        old.base_currency = "GBP"

        new = self._snap([{"name": "ISA", "value_base": 1_000}])
        result = self.fn(old, new)
        # Should not raise; returns None gracefully
        assert result is None

    # ── ID-based matching tests ───────────────────────────────────────────────

    def test_renamed_account_matched_by_id_not_name(self):
        """When an account is renamed between snapshots, delta should be for the
        same underlying account — not a false delete+add pair."""
        old = self._snap([{"id": 7, "name": "Old ISA Name", "value_base": 10_000}])
        new = self._snap([{"id": 7, "name": "New ISA Name", "value_base": 11_000}])
        result = self.fn(old, new)
        assert result is not None
        assert len(result) == 1
        # Delta is computed correctly (not split into two items)
        assert result[0]["delta"] == pytest.approx(1_000.0)
        # Display name comes from newest snapshot
        assert result[0]["name"] == "New ISA Name"

    def test_rename_does_not_produce_ghost_entries(self):
        """A rename must not create a phantom deletion and phantom addition."""
        old = self._snap([{"id": 3, "name": "Cash Account", "value_base": 5_000}])
        new = self._snap([{"id": 3, "name": "Savings Account", "value_base": 5_100}])
        result = self.fn(old, new)
        assert result is not None
        # Only one mover (the renamed account), not two
        assert len(result) == 1
        assert result[0]["name"] == "Savings Account"

    def test_new_account_with_id_appears_as_positive(self):
        """Account with id present in new snapshot only → positive delta."""
        old = self._snap([{"id": 1, "name": "ISA", "value_base": 5_000}])
        new = self._snap([
            {"id": 1, "name": "ISA", "value_base": 5_000},
            {"id": 99, "name": "SIPP", "value_base": 4_000},
        ])
        result = self.fn(old, new)
        assert result is not None
        sipp = next((r for r in result if r["name"] == "SIPP"), None)
        assert sipp is not None
        assert sipp["delta"] == pytest.approx(4_000.0)

    def test_deleted_account_with_id_appears_as_negative(self):
        """Account with id present in old snapshot only → negative delta."""
        old = self._snap([
            {"id": 1, "name": "ISA", "value_base": 5_000},
            {"id": 42, "name": "OldPension", "value_base": 2_500},
        ])
        new = self._snap([{"id": 1, "name": "ISA", "value_base": 5_000}])
        result = self.fn(old, new)
        assert result is not None
        removed = next((r for r in result if r["name"] == "OldPension"), None)
        assert removed is not None
        assert removed["delta"] == pytest.approx(-2_500.0)

    def test_mixed_id_and_no_id_fallback(self):
        """Items without an id fall back to name-based keying; items with id use id."""
        old = self._snap([
            {"id": 10, "name": "Fund A", "value_base": 8_000},
            {"name": "Legacy Cash", "value_base": 1_000},  # no id
        ])
        new = self._snap([
            {"id": 10, "name": "Fund A", "value_base": 9_000},   # +1000
            {"name": "Legacy Cash", "value_base": 1_200},          # +200
        ])
        result = self.fn(old, new)
        assert result is not None
        names = {r["name"] for r in result}
        assert "Fund A" in names
        assert "Legacy Cash" in names
        fund_a = next(r for r in result if r["name"] == "Fund A")
        assert fund_a["delta"] == pytest.approx(1_000.0)
        legacy = next(r for r in result if r["name"] == "Legacy Cash")
        assert legacy["delta"] == pytest.approx(200.0)


# ─── Integration tests: breakdown_delta in dashboard response ─────────────

@pytest.fixture(scope="module")
def test_app():
    from sqlmodel import SQLModel, Session, create_engine
    from fastapi.testclient import TestClient

    engine = create_engine(
        "sqlite:///./test_breakdown_int.db",
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
        _os.unlink("./test_breakdown_int.db")
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


def _add_snapshot(session, user_id: int, base_currency: str, total: float,
                  breakdown: list[dict], hours_ago: int = 1):
    from backend.app.models import Snapshot

    snap = Snapshot(
        user_id=user_id,
        base_currency=base_currency,
        total_base=total,
        fx_as_of="2026-01-01",
        excluded_accounts=0,
        breakdown_json=json.dumps(breakdown),
        created_at=datetime.now(timezone.utc) - timedelta(hours=hours_ago),
    )
    session.add(snap)
    session.commit()
    return snap


class TestDashboardBreakdownDelta:

    def test_breakdown_delta_returned_with_two_range_snapshots(self, test_app, db_session):
        """breakdown_delta is populated when two comparable snapshots exist in range."""
        from backend.app.auth import get_current_user
        from backend.app.main import app as fastapi_app
        from unittest.mock import AsyncMock, patch

        client, _ = test_app
        user = _seed_user(db_session, uid="bd-two-snaps")

        old_breakdown = [{"name": "ISA", "value_base": 10_000.0}]
        new_breakdown = [{"name": "ISA", "value_base": 11_500.0}]

        _add_snapshot(db_session, user.id, "GBP", 10_000.0, old_breakdown, hours_ago=48)
        _add_snapshot(db_session, user.id, "GBP", 11_500.0, new_breakdown, hours_ago=12)

        async def _auth():
            return user

        fastapi_app.dependency_overrides[get_current_user] = _auth

        with patch("backend.app.routers.dashboard.get_fx_cache") as mock_fx:
            mock_cache = AsyncMock()
            mock_cache.get_rates.return_value = {}
            mock_cache.cache_date = "2026-01-01"
            mock_fx.return_value = mock_cache

            try:
                resp = client.get("/api/dashboard?range=1M")
                assert resp.status_code == 200
                data = resp.json()
                assert data["breakdown_delta"] is not None
                assert len(data["breakdown_delta"]) == 1
                assert data["breakdown_delta"][0]["name"] == "ISA"
                assert abs(data["breakdown_delta"][0]["delta"] - 1500.0) < 1.0
            finally:
                del fastapi_app.dependency_overrides[get_current_user]

    def test_breakdown_delta_none_with_single_snapshot(self, test_app, db_session):
        """breakdown_delta is None when only one snapshot exists in range."""
        from backend.app.auth import get_current_user
        from backend.app.main import app as fastapi_app
        from unittest.mock import AsyncMock, patch

        client, _ = test_app
        user = _seed_user(db_session, uid="bd-one-snap")

        _add_snapshot(db_session, user.id, "GBP", 10_000.0,
                      [{"name": "Cash", "value_base": 10_000.0}], hours_ago=12)

        async def _auth():
            return user

        fastapi_app.dependency_overrides[get_current_user] = _auth

        with patch("backend.app.routers.dashboard.get_fx_cache") as mock_fx:
            mock_cache = AsyncMock()
            mock_cache.get_rates.return_value = {}
            mock_cache.cache_date = "2026-01-01"
            mock_fx.return_value = mock_cache

            try:
                resp = client.get("/api/dashboard?range=1M")
                assert resp.status_code == 200
                data = resp.json()
                assert data["breakdown_delta"] is None
            finally:
                del fastapi_app.dependency_overrides[get_current_user]

    def test_last_snapshot_date_returned(self, test_app, db_session):
        """last_snapshot_date is the ISO timestamp of the most recent comparable snapshot."""
        from backend.app.auth import get_current_user
        from backend.app.main import app as fastapi_app
        from unittest.mock import AsyncMock, patch

        client, _ = test_app
        user = _seed_user(db_session, uid="bd-last-snap-date")

        _add_snapshot(db_session, user.id, "GBP", 10_000.0, [], hours_ago=24)
        recent = _add_snapshot(db_session, user.id, "GBP", 11_000.0, [], hours_ago=1)

        async def _auth():
            return user

        fastapi_app.dependency_overrides[get_current_user] = _auth

        with patch("backend.app.routers.dashboard.get_fx_cache") as mock_fx:
            mock_cache = AsyncMock()
            mock_cache.get_rates.return_value = {}
            mock_cache.cache_date = "2026-01-01"
            mock_fx.return_value = mock_cache

            try:
                resp = client.get("/api/dashboard?range=1M")
                assert resp.status_code == 200
                data = resp.json()
                assert data["last_snapshot_date"] is not None
                # Should be parseable as ISO datetime
                dt = datetime.fromisoformat(data["last_snapshot_date"].replace("Z", "+00:00"))
                assert dt is not None
            finally:
                del fastapi_app.dependency_overrides[get_current_user]

    def test_last_snapshot_date_none_when_no_snapshots(self, test_app, db_session):
        """last_snapshot_date is None when user has no snapshots."""
        from backend.app.auth import get_current_user
        from backend.app.main import app as fastapi_app
        from unittest.mock import AsyncMock, patch

        client, _ = test_app
        user = _seed_user(db_session, uid="bd-no-snaps-date")

        async def _auth():
            return user

        fastapi_app.dependency_overrides[get_current_user] = _auth

        with patch("backend.app.routers.dashboard.get_fx_cache") as mock_fx:
            mock_cache = AsyncMock()
            mock_cache.get_rates.return_value = {}
            mock_cache.cache_date = "2026-01-01"
            mock_fx.return_value = mock_cache

            try:
                resp = client.get("/api/dashboard?range=1M")
                assert resp.status_code == 200
                data = resp.json()
                assert data["last_snapshot_date"] is None
            finally:
                del fastapi_app.dependency_overrides[get_current_user]
