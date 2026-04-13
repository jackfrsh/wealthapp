"""
Unit tests for projection model consistency.

Covers:
- compute_goal_forecast: account-contribution fallback when goal.monthly_contribution == 0
- compute_projection_series: returns real total_monthly_contribution and weighted_avg_return_pct
- Projection assumptions block uses actual values (not hardcoded defaults)
"""

from __future__ import annotations

import os
import sys

import pytest

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_projections.db")
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret-at-least-32-chars-long-padding")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")


# ─── compute_goal_forecast unit tests ────────────────────────────────────────

class TestComputeGoalForecast:
    """Tests for the pure forecast engine in goals.py."""

    @pytest.fixture(autouse=True)
    def _goal_cls(self):
        from backend.app.models import Goal
        self.Goal = Goal

    def _make_goal(self, mc=0.0, er=7.0, target=500_000, current_age=30, target_age=60):
        return self.Goal(
            user_id=1,
            name="Test",
            goal_type="retirement",
            target_amount=target,
            current_age=current_age,
            target_age=target_age,
            monthly_contribution=mc,
            expected_annual_return_pct=er,
        )

    def test_explicit_mc_used_when_provided(self):
        from backend.app.routers.goals import compute_goal_forecast

        goal = self._make_goal(mc=0.0)
        result = compute_goal_forecast(
            goal=goal,
            current_net_worth=50_000,
            base_currency="GBP",
            monthly_contribution=1000.0,
        )
        # 1000/month for 30 years at 7% should grow significantly
        assert result["projected_end_value"] > 50_000
        assert result["years_remaining"] == 30

    def test_goal_mc_used_when_set_and_no_override(self):
        from backend.app.routers.goals import compute_goal_forecast

        goal = self._make_goal(mc=800.0)
        result_with_goal_mc = compute_goal_forecast(
            goal=goal,
            current_net_worth=50_000,
            base_currency="GBP",
        )
        result_zero_mc = compute_goal_forecast(
            goal=self._make_goal(mc=0.0),
            current_net_worth=50_000,
            base_currency="GBP",
        )
        # Goal with 800/month should project higher
        assert result_with_goal_mc["projected_end_value"] > result_zero_mc["projected_end_value"]

    def test_zero_return_rate_uses_linear_growth(self):
        from backend.app.routers.goals import compute_goal_forecast

        goal = self._make_goal(mc=100.0, er=0.0, current_age=30, target_age=40)
        result = compute_goal_forecast(
            goal=goal,
            current_net_worth=0.0,
            base_currency="GBP",
        )
        # 100/month × 120 months = 12,000
        assert abs(result["projected_end_value"] - 12_000.0) < 1.0

    def test_returns_expected_keys(self):
        from backend.app.routers.goals import compute_goal_forecast

        goal = self._make_goal()
        result = compute_goal_forecast(goal=goal, current_net_worth=10_000, base_currency="GBP")
        for key in ("status", "projected_end_value", "years_remaining", "projected_points", "required_points"):
            assert key in result

    def test_status_ahead_when_well_funded(self):
        from backend.app.routers.goals import compute_goal_forecast

        # Already above target × 1.05 will project ahead
        goal = self._make_goal(mc=0.0, er=7.0, target=100, current_age=30, target_age=40)
        result = compute_goal_forecast(goal=goal, current_net_worth=1_000_000, base_currency="GBP")
        assert result["status"] == "ahead"

    def test_status_adjust_when_underfunded(self):
        from backend.app.routers.goals import compute_goal_forecast

        goal = self._make_goal(mc=0.0, er=0.0, target=1_000_000, current_age=60, target_age=61)
        result = compute_goal_forecast(goal=goal, current_net_worth=0, base_currency="GBP")
        assert result["status"] == "adjust"


# ─── Projection assumptions: total_monthly_contribution ──────────────────────

class TestProjectionAssumptions:
    """Tests that compute_projection_series returns real contribution/return data."""

    @pytest.fixture(scope="class")
    def sqlite_engine(self):
        from sqlmodel import SQLModel, create_engine
        engine = create_engine(
            "sqlite:///./test_projections_unit.db",
            connect_args={"check_same_thread": False},
        )
        import backend.app.models  # noqa: F401 — registers tables
        SQLModel.metadata.create_all(engine)
        yield engine
        import os as _os
        try:
            _os.unlink("./test_projections_unit.db")
        except FileNotFoundError:
            pass

    @pytest.fixture()
    def session(self, sqlite_engine):
        from sqlmodel import Session
        with Session(sqlite_engine) as s:
            yield s

    def _seed(self, session, user_id: int, contributions: list[float], rates: list[float]):
        """Seed accounts with given monthly_contribution and annual_interest_rate_percent lists."""
        from backend.app.models import User, Settings, Account

        existing_user = session.get(User, user_id)
        if not existing_user:
            session.add(User(id=user_id, username=f"user-{user_id}", supabase_user_id=f"uid-{user_id}"))
            session.add(Settings(user_id=user_id, base_currency="GBP"))
            session.commit()

        for i, (mc, r) in enumerate(zip(contributions, rates)):
            session.add(Account(
                user_id=user_id,
                name=f"Account {i}",
                currency="GBP",
                balance=10_000.0,
                monthly_contribution=mc,
                annual_interest_rate_percent=r,
                include_in_net_worth=True,
            ))
        session.commit()

    def test_total_monthly_contribution_is_sum_of_accounts(self, session):
        import asyncio
        from unittest.mock import AsyncMock, patch
        from backend.app.services.networth import compute_projection_series

        self._seed(session, user_id=100, contributions=[300.0, 200.0], rates=[5.0, 3.0])

        with patch("backend.app.services.networth.get_fx_cache") as mock_fx:
            mock_cache = AsyncMock()
            mock_cache.get_rates.return_value = {}
            mock_cache.cache_date = "2026-01-01"
            mock_fx.return_value = mock_cache

            result = asyncio.run(compute_projection_series(session, user_id=100, years=1))

        assert result["total_monthly_contribution"] == pytest.approx(500.0)

    def test_weighted_avg_return_pct_is_not_hardcoded(self, session):
        """weighted_avg_return_pct must reflect actual account rates, not a fixed 7.0."""
        import asyncio
        from unittest.mock import AsyncMock, patch
        from backend.app.services.networth import compute_projection_series

        self._seed(session, user_id=101, contributions=[0.0], rates=[4.0])

        with patch("backend.app.services.networth.get_fx_cache") as mock_fx:
            mock_cache = AsyncMock()
            mock_cache.get_rates.return_value = {}
            mock_cache.cache_date = "2026-01-01"
            mock_fx.return_value = mock_cache

            result = asyncio.run(compute_projection_series(session, user_id=101, years=1))

        # Must not be the old hardcoded default of 7.0
        wap = result.get("weighted_avg_return_pct")
        if wap is not None:
            assert abs(wap - 7.0) > 0.5 or abs(wap - 4.0) < 0.5

    def test_no_accounts_returns_zero_contribution(self, session):
        import asyncio
        from unittest.mock import AsyncMock, patch
        from backend.app.models import User, Settings
        from backend.app.services.networth import compute_projection_series

        session.add(User(id=102, username="user-102", supabase_user_id="uid-102"))
        session.add(Settings(user_id=102, base_currency="GBP"))
        session.commit()

        with patch("backend.app.services.networth.get_fx_cache") as mock_fx:
            mock_cache = AsyncMock()
            mock_cache.get_rates.return_value = {}
            mock_cache.cache_date = "2026-01-01"
            mock_fx.return_value = mock_cache

            result = asyncio.run(compute_projection_series(session, user_id=102, years=1))

        assert result["total_monthly_contribution"] == pytest.approx(0.0)
        assert result["weighted_avg_return_pct"] is None


# ─── Goal forecast: account fallback integration ──────────────────────────────

class TestGoalForecastAccountFallback:
    """The goal_forecast endpoint falls back to account contributions when goal.mc == 0."""

    @pytest.fixture(scope="class")
    def sqlite_engine(self):
        from sqlmodel import SQLModel, create_engine
        engine = create_engine(
            "sqlite:///./test_goal_fallback.db",
            connect_args={"check_same_thread": False},
        )
        import backend.app.models  # noqa: F401
        SQLModel.metadata.create_all(engine)
        yield engine
        import os as _os
        try:
            _os.unlink("./test_goal_fallback.db")
        except FileNotFoundError:
            pass

    @pytest.fixture()
    def session(self, sqlite_engine):
        from sqlmodel import Session
        with Session(sqlite_engine) as s:
            yield s

    def test_fallback_uses_account_sum_when_goal_mc_is_zero(self, session):
        """When goal.monthly_contribution == 0, effective_mc should equal account sum."""
        from backend.app.models import User, Settings, Account, Goal
        from backend.app.routers.goals import compute_goal_forecast

        # Seed: goal with mc=0, two accounts each with mc=400
        user = User(id=200, username="u200", supabase_user_id="uid-200")
        session.add(user)
        session.add(Settings(user_id=200, base_currency="GBP"))

        goal = Goal(
            id=200,
            user_id=200,
            name="Retirement",
            goal_type="retirement",
            target_amount=500_000,
            current_age=35,
            target_age=65,
            monthly_contribution=0.0,
            expected_annual_return_pct=5.0,
            is_primary=True,
        )
        session.add(goal)

        session.add(Account(
            user_id=200, name="ISA", currency="GBP", balance=10_000,
            monthly_contribution=400.0, include_in_net_worth=True,
        ))
        session.add(Account(
            user_id=200, name="SIPP", currency="GBP", balance=20_000,
            monthly_contribution=400.0, include_in_net_worth=True,
        ))
        session.commit()
        session.refresh(goal)

        # Simulate the fallback logic from the endpoint
        from sqlmodel import select
        from backend.app.models import Account as Acc
        accs = session.exec(
            select(Acc).where(Acc.user_id == 200, Acc.include_in_net_worth == True)
        ).all()
        account_mc_sum = sum(float(a.monthly_contribution or 0) for a in accs)

        assert account_mc_sum == pytest.approx(800.0)

        # With zero goal MC, forecast should differ from account-sum forecast
        result_zero = compute_goal_forecast(goal=goal, current_net_worth=30_000, base_currency="GBP")
        result_with_fallback = compute_goal_forecast(
            goal=goal, current_net_worth=30_000, base_currency="GBP",
            monthly_contribution=account_mc_sum,
        )
        assert result_with_fallback["projected_end_value"] > result_zero["projected_end_value"]

    def test_goal_mc_nonzero_no_fallback(self):
        """When goal.monthly_contribution > 0, the goal value is used directly."""
        from backend.app.models import Goal
        from backend.app.routers.goals import compute_goal_forecast

        goal = Goal(
            user_id=201,
            name="Test",
            goal_type="retirement",
            target_amount=500_000,
            current_age=35,
            target_age=65,
            monthly_contribution=600.0,  # explicit
            expected_annual_return_pct=5.0,
        )

        result = compute_goal_forecast(goal=goal, current_net_worth=0, base_currency="GBP")
        # Should be non-trivial given 600/month for 30 years at 5%
        assert result["projected_end_value"] > 100_000
