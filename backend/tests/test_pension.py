"""
Tests for the Retirement Drawdown Planner.

Covers:
- _net_monthly_rate: geometric compounding, fee deduction
- _accumulate: basic growth, zero return, zero contributions, multi-year
- _apply_lump_sum: none / amount / percentage, clamping
- _monthly_withdrawal_amount: percentage and fixed modes
- _simulate_drawdown: normal depletion, survival, zero withdrawal,
                      depleted-at-start, zero return depletion
- compute_pension_plan: full end-to-end scenarios
- Edge cases: retirement_age == current_age + 1, zero pot, very high withdrawal,
              lump sum > pot, zero return, depletion boundary
- API: response shape, validation errors, auth guard
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone

import pytest

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_pension.db")
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret-at-least-32-chars-long-padding")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")


# ─── Unit tests for pure calculation helpers ──────────────────────────────────

class TestNetMonthlyRate:

    @pytest.fixture(autouse=True)
    def _import(self):
        from backend.app.routers.pension import _net_monthly_rate
        self.fn = _net_monthly_rate

    def test_positive_net_rate(self):
        r = self.fn(annual_return_pct=7.0, annual_fee_pct=0.75)
        # (1 + 0.0625)^(1/12) - 1
        import math
        expected = math.pow(1 + 0.0625, 1 / 12) - 1
        assert abs(r - expected) < 1e-10

    def test_zero_net_rate(self):
        r = self.fn(annual_return_pct=3.0, annual_fee_pct=3.0)
        assert abs(r) < 1e-10

    def test_negative_net_rate_allowed(self):
        """Fee exceeds return — pot shrinks."""
        r = self.fn(annual_return_pct=1.0, annual_fee_pct=2.0)
        assert r < 0.0

    def test_zero_both(self):
        r = self.fn(annual_return_pct=0.0, annual_fee_pct=0.0)
        assert abs(r) < 1e-10


class TestAccumulate:

    @pytest.fixture(autouse=True)
    def _import(self):
        from backend.app.routers.pension import _accumulate, _net_monthly_rate
        self.acc = _accumulate
        self.rate = _net_monthly_rate

    def test_zero_return_zero_contributions(self):
        """With 0% return and 0 contributions, pot stays flat."""
        final, series = self.acc(
            current_pot=50_000,
            monthly_contribution=0,
            r_monthly=0.0,
            years=10,
        )
        assert abs(final - 50_000) < 1.0
        assert series[0] == {"age_offset": 0, "value": 50_000.0}
        assert len(series) == 11  # 0..10

    def test_zero_return_with_contributions(self):
        """Pure accumulation: 500/mo × 12 months × 5 years = 30,000 extra."""
        final, series = self.acc(
            current_pot=0.0,
            monthly_contribution=500.0,
            r_monthly=0.0,
            years=5,
        )
        assert abs(final - 30_000.0) < 1.0

    def test_growth_increases_pot(self):
        """Positive return must produce more than linear."""
        r = self.rate(7.0, 0.0)
        final_with_return, _ = self.acc(50_000, 500, r, 20)
        # Compare with zero-return baseline
        final_flat, _ = self.acc(50_000, 500, 0.0, 20)
        assert final_with_return > final_flat

    def test_series_length(self):
        """Annual series should have (years + 1) entries."""
        _, series = self.acc(10_000, 0, 0.0, 15)
        assert len(series) == 16  # offsets 0..15

    def test_series_age_offsets_sequential(self):
        _, series = self.acc(10_000, 100, 0.0, 5)
        for i, s in enumerate(series):
            assert s["age_offset"] == i

    def test_pot_is_non_negative(self):
        """Even with negative net rate, accumulated values are floored at 0 in series."""
        r = self.rate(1.0, 5.0)  # negative net rate
        _, series = self.acc(1_000, 0, r, 3)
        for s in series:
            assert s["value"] >= 0.0


class TestApplyLumpSum:

    @pytest.fixture(autouse=True)
    def _import(self):
        from backend.app.routers.pension import _apply_lump_sum
        self.fn = _apply_lump_sum

    def test_none_type_returns_zero_applied(self):
        applied, remaining = self.fn(100_000, "none", 0)
        assert applied == 0.0
        assert remaining == 100_000.0

    def test_amount_type(self):
        applied, remaining = self.fn(100_000, "amount", 25_000)
        assert applied == 25_000.0
        assert remaining == 75_000.0

    def test_percentage_type(self):
        applied, remaining = self.fn(100_000, "percentage", 25.0)
        assert applied == 25_000.0
        assert remaining == 75_000.0

    def test_amount_clamped_to_pot(self):
        """Lump sum cannot exceed the pot."""
        applied, remaining = self.fn(50_000, "amount", 200_000)
        assert applied == 50_000.0
        assert remaining == 0.0

    def test_percentage_100(self):
        applied, remaining = self.fn(80_000, "percentage", 100.0)
        assert applied == 80_000.0
        assert remaining == 0.0

    def test_percentage_clamped_at_100(self):
        """Percentage > 100 is clamped to 100."""
        applied, remaining = self.fn(50_000, "percentage", 150.0)
        assert applied == 50_000.0
        assert remaining == 0.0

    def test_zero_lump_sum_value(self):
        applied, remaining = self.fn(100_000, "amount", 0)
        assert applied == 0.0
        assert remaining == 100_000.0


class TestMonthlyWithdrawal:

    @pytest.fixture(autouse=True)
    def _import(self):
        from backend.app.routers.pension import _monthly_withdrawal_amount
        self.fn = _monthly_withdrawal_amount

    def test_percentage_mode(self):
        """4% of 300,000 = 12,000/yr = 1,000/mo."""
        w = self.fn(300_000, "percentage", 4.0)
        assert abs(w - 1_000.0) < 0.01

    def test_fixed_monthly_mode(self):
        w = self.fn(300_000, "fixed_monthly", 1_500.0)
        assert abs(w - 1_500.0) < 0.01

    def test_zero_percentage(self):
        w = self.fn(300_000, "percentage", 0.0)
        assert w == 0.0

    def test_zero_fixed_monthly(self):
        w = self.fn(300_000, "fixed_monthly", 0.0)
        assert w == 0.0


class TestSimulateDrawdown:

    @pytest.fixture(autouse=True)
    def _import(self):
        from backend.app.routers.pension import _simulate_drawdown
        self.fn = _simulate_drawdown

    def _args(self, pot=200_000, draw=1_000, r=0.005, retire=65, end=95):
        return dict(
            remaining_pot=pot,
            monthly_draw=draw,
            r_monthly=r,
            retirement_age=retire,
            target_end_age=end,
        )

    def test_pot_already_empty(self):
        dep, survives, series = self.fn(**self._args(pot=0))
        assert dep == 65
        assert survives is False
        assert all(s["value"] == 0.0 for s in series[1:])

    def test_zero_withdrawal_survives(self):
        """No withdrawals → pot only grows → survives."""
        dep, survives, series = self.fn(**self._args(draw=0))
        assert dep is None
        assert survives is True
        # All values non-decreasing (pot grows with positive rate)
        for i in range(1, len(series)):
            assert series[i]["value"] >= series[i - 1]["value"]

    def test_very_high_withdrawal_depletes_early(self):
        """£5,000/mo from £50,000 pot at 0% return depletes in 10 months (< 1 year)."""
        dep, survives, series = self.fn(
            **self._args(pot=50_000, draw=5_000, r=0.0, retire=65, end=95)
        )
        assert survives is False
        assert dep is not None
        assert dep <= 66  # depletes within first year

    def test_series_starts_at_remaining_pot(self):
        dep, survives, series = self.fn(**self._args(pot=200_000))
        assert series[0] == {"age_offset": 0, "value": 200_000.0}

    def test_series_has_correct_length(self):
        """Series should have (target_end_age - retirement_age + 1) entries."""
        _, _, series = self.fn(**self._args(retire=65, end=95))
        assert len(series) == 31  # offsets 0..30

    def test_series_values_non_negative(self):
        """No negative values in series even after depletion."""
        _, _, series = self.fn(**self._args(pot=10_000, draw=2_000, r=0.0))
        for s in series:
            assert s["value"] >= 0.0

    def test_survival_at_low_withdrawal(self):
        """3% drawdown on 300k = 750/mo — at 6% return net should survive 30 years."""
        from backend.app.routers.pension import _net_monthly_rate
        r = _net_monthly_rate(7.0, 0.75)
        pot = 300_000
        draw = pot * 0.03 / 12  # 750/mo
        dep, survives, _ = self.fn(
            remaining_pot=pot,
            monthly_draw=draw,
            r_monthly=r,
            retirement_age=65,
            target_end_age=95,
        )
        assert survives is True
        assert dep is None

    def test_depletion_age_at_retirement_boundary(self):
        """Pot depletes in month 12 → depletion_age = retirement_age + 1."""
        # Pot = 12 * monthly_draw, zero return → exactly 12 months
        pot = 12_000.0
        draw = 1_000.0
        dep, survives, _ = self.fn(
            remaining_pot=pot,
            monthly_draw=draw,
            r_monthly=0.0,
            retirement_age=65,
            target_end_age=95,
        )
        assert survives is False
        assert dep == 66  # 12 full months = 1 year → retirement_age + 1

    def test_depletion_age_zero_return_exact(self):
        """Pot = N * monthly_draw at 0% → lasts exactly N months."""
        from backend.app.routers.pension import _net_monthly_rate
        # 24 months = 2 years
        pot = 24_000.0
        draw = 1_000.0
        dep, survives, _ = self.fn(
            remaining_pot=pot,
            monthly_draw=draw,
            r_monthly=0.0,
            retirement_age=65,
            target_end_age=95,
        )
        assert survives is False
        assert dep == 67  # 2 years → retirement_age + 2


class TestComputePensionPlan:

    @pytest.fixture(autouse=True)
    def _import(self):
        from backend.app.routers.pension import compute_pension_plan, PensionPlanRequest
        self.fn = compute_pension_plan
        self.Req = PensionPlanRequest

    def _req(self, **overrides):
        defaults = dict(
            current_pot=100_000.0,
            current_age=40,
            retirement_age=65,
            monthly_contribution=500.0,
            annual_return_pct=7.0,
            annual_fee_pct=0.75,
            inflation_rate_pct=2.5,
            lump_sum_type="none",
            lump_sum_value=0.0,
            withdrawal_mode="percentage",
            withdrawal_value=4.0,
            target_end_age=95,
        )
        defaults.update(overrides)
        return self.Req(**defaults)

    def test_response_keys_present(self):
        result = self.fn(self._req())
        expected_keys = {
            "projected_pot_at_retirement",
            "lump_sum_applied",
            "remaining_pot",
            "monthly_income_nominal",
            "annual_income_nominal",
            "monthly_income_real",
            "annual_income_real",
            "pot_lasts_until_age",
            "years_in_drawdown",
            "survives_to_target_age",
            "comparison",
            "accumulation_series",
            "drawdown_series",
        }
        assert set(result.keys()) == expected_keys

    def test_projected_pot_exceeds_current(self):
        """25 years at 7% gross with contributions → significant growth."""
        result = self.fn(self._req())
        assert result["projected_pot_at_retirement"] > 100_000.0

    def test_no_lump_sum_means_remaining_equals_projected(self):
        result = self.fn(self._req(lump_sum_type="none"))
        assert result["lump_sum_applied"] == 0.0
        assert result["remaining_pot"] == result["projected_pot_at_retirement"]

    def test_lump_sum_amount_applied(self):
        result = self.fn(self._req(lump_sum_type="amount", lump_sum_value=50_000))
        assert result["lump_sum_applied"] == 50_000.0
        assert abs(result["remaining_pot"] - (result["projected_pot_at_retirement"] - 50_000.0)) < 1.0

    def test_lump_sum_percentage_applied(self):
        result = self.fn(self._req(lump_sum_type="percentage", lump_sum_value=25.0))
        expected = result["projected_pot_at_retirement"] * 0.25
        assert abs(result["lump_sum_applied"] - expected) < 1.0

    def test_annual_income_is_12x_monthly(self):
        result = self.fn(self._req())
        assert abs(result["annual_income_nominal"] - result["monthly_income_nominal"] * 12) < 0.05

    def test_real_income_less_than_nominal_with_inflation(self):
        """Inflation > 0 → real income < nominal."""
        result = self.fn(self._req(inflation_rate_pct=2.5))
        assert result["monthly_income_real"] < result["monthly_income_nominal"]

    def test_real_income_equals_nominal_with_zero_inflation(self):
        result = self.fn(self._req(inflation_rate_pct=0.0))
        assert abs(result["monthly_income_real"] - result["monthly_income_nominal"]) < 0.01

    def test_comparison_has_three_entries(self):
        result = self.fn(self._req())
        assert len(result["comparison"]) == 3

    def test_comparison_rates_are_3_4_5(self):
        result = self.fn(self._req())
        rates = [c["rate_pct"] for c in result["comparison"]]
        assert rates == [3.0, 4.0, 5.0]

    def test_comparison_keys_present(self):
        result = self.fn(self._req())
        for c in result["comparison"]:
            for key in (
                "rate_pct", "annual_income_nominal", "monthly_income_nominal",
                "annual_income_real", "monthly_income_real",
                "pot_lasts_until_age", "survives_to_target_age"
            ):
                assert key in c

    def test_higher_rate_higher_income(self):
        """5% drawdown always produces more income than 4%, which > 3%."""
        result = self.fn(self._req())
        incomes = [c["monthly_income_nominal"] for c in result["comparison"]]
        assert incomes[0] < incomes[1] < incomes[2]  # 3% < 4% < 5%

    def test_higher_rate_shorter_longevity(self):
        """Higher withdrawal → shorter longevity (or equal if both survive)."""
        result = self.fn(self._req())
        longevities = [
            (c["pot_lasts_until_age"] if not c["survives_to_target_age"] else 999)
            for c in result["comparison"]
        ]
        # 3% should last at least as long as 4% which >= 5%
        assert longevities[0] >= longevities[1] >= longevities[2]

    def test_accumulation_series_first_entry_is_current_pot(self):
        result = self.fn(self._req(current_pot=80_000))
        assert result["accumulation_series"][0] == {"age": 40, "value": 80_000.0}

    def test_accumulation_series_last_entry_is_retirement_age(self):
        result = self.fn(self._req(current_age=40, retirement_age=65))
        last = result["accumulation_series"][-1]
        assert last["age"] == 65
        assert abs(last["value"] - result["projected_pot_at_retirement"]) < 1.0

    def test_drawdown_series_starts_at_retirement_age(self):
        result = self.fn(self._req(retirement_age=65))
        assert result["drawdown_series"][0]["age"] == 65

    def test_drawdown_series_first_value_is_remaining_pot(self):
        result = self.fn(self._req(lump_sum_type="none"))
        first = result["drawdown_series"][0]["value"]
        assert abs(first - result["remaining_pot"]) < 1.0

    def test_zero_pot(self):
        """Zero starting pot with zero contributions → zero income."""
        result = self.fn(self._req(current_pot=0.0, monthly_contribution=0.0))
        assert result["projected_pot_at_retirement"] == 0.0
        assert result["monthly_income_nominal"] == 0.0
        assert result["annual_income_nominal"] == 0.0

    def test_zero_return_accumulation(self):
        """At 0% return, final pot = current_pot + contribution × months."""
        result = self.fn(self._req(
            current_pot=0.0,
            monthly_contribution=500.0,
            annual_return_pct=0.0,
            annual_fee_pct=0.0,
            current_age=40,
            retirement_age=65,
        ))
        expected = 500.0 * 25 * 12  # = 150,000
        assert abs(result["projected_pot_at_retirement"] - expected) < 10.0

    def test_lump_sum_exceeds_pot_clamps_to_zero_remaining(self):
        """Lump sum > pot → remaining pot = 0, no income."""
        result = self.fn(self._req(
            current_pot=10_000.0,
            monthly_contribution=0.0,
            annual_return_pct=0.0,
            annual_fee_pct=0.0,
            current_age=60,
            retirement_age=65,
            lump_sum_type="amount",
            lump_sum_value=200_000.0,
        ))
        assert result["remaining_pot"] == 0.0
        assert result["monthly_income_nominal"] == 0.0

    def test_fixed_monthly_withdrawal_mode(self):
        result = self.fn(self._req(
            withdrawal_mode="fixed_monthly",
            withdrawal_value=1_500.0,
        ))
        assert abs(result["monthly_income_nominal"] - 1_500.0) < 0.01
        assert abs(result["annual_income_nominal"] - 18_000.0) < 0.05

    def test_very_high_withdrawal_depletes_quickly(self):
        """50% annual withdrawal → pot depletes well before target."""
        result = self.fn(self._req(
            withdrawal_mode="percentage",
            withdrawal_value=50.0,
            target_end_age=95,
            retirement_age=65,
        ))
        assert result["survives_to_target_age"] is False
        assert result["pot_lasts_until_age"] is not None
        assert result["pot_lasts_until_age"] < 75

    def test_minimum_accumulation_period(self):
        """retirement_age = current_age + 1 is valid and works cleanly."""
        result = self.fn(self._req(
            current_age=64,
            retirement_age=65,
            target_end_age=95,
        ))
        assert "projected_pot_at_retirement" in result
        assert result["accumulation_series"][-1]["age"] == 65

    def test_years_in_drawdown_when_depletes(self):
        """years_in_drawdown = depletion_age - retirement_age."""
        result = self.fn(self._req(
            current_pot=12_000.0,
            monthly_contribution=0.0,
            annual_return_pct=0.0,
            annual_fee_pct=0.0,
            current_age=60,
            retirement_age=65,
            withdrawal_mode="percentage",
            withdrawal_value=100.0,  # 100% of pot → all gone month 1
            target_end_age=95,
        ))
        assert result["survives_to_target_age"] is False
        assert result["years_in_drawdown"] == result["pot_lasts_until_age"] - 65

    def test_years_in_drawdown_when_survives(self):
        """years_in_drawdown = target_end_age - retirement_age when pot survives."""
        result = self.fn(self._req(
            withdrawal_mode="percentage",
            withdrawal_value=1.0,  # very low drawdown
            annual_return_pct=8.0,
        ))
        if result["survives_to_target_age"]:
            assert result["years_in_drawdown"] == 95 - 65


# ─── Validation tests ─────────────────────────────────────────────────────────

class TestPensionPlanRequestValidation:

    @pytest.fixture(autouse=True)
    def _import(self):
        from backend.app.routers.pension import PensionPlanRequest
        self.Req = PensionPlanRequest

    def _base(self, **kw):
        defaults = dict(
            current_pot=100_000,
            current_age=40,
            retirement_age=65,
            target_end_age=95,
        )
        defaults.update(kw)
        return defaults

    def test_retirement_age_must_exceed_current_age(self):
        with pytest.raises(Exception):
            self.Req(**self._base(current_age=65, retirement_age=65))

    def test_target_end_age_must_exceed_retirement_age(self):
        with pytest.raises(Exception):
            self.Req(**self._base(retirement_age=65, target_end_age=65))

    def test_invalid_lump_sum_type(self):
        with pytest.raises(Exception):
            self.Req(**self._base(lump_sum_type="cash"))

    def test_invalid_withdrawal_mode(self):
        with pytest.raises(Exception):
            self.Req(**self._base(withdrawal_mode="monthly"))

    def test_negative_current_pot_rejected(self):
        with pytest.raises(Exception):
            self.Req(**self._base(current_pot=-1))

    def test_return_pct_above_30_rejected(self):
        with pytest.raises(Exception):
            self.Req(**self._base(annual_return_pct=31.0))

    def test_fee_pct_above_5_rejected(self):
        with pytest.raises(Exception):
            self.Req(**self._base(annual_fee_pct=5.1))

    def test_valid_request_passes(self):
        req = self.Req(**self._base())
        assert req.current_age == 40


# ─── Integration tests: API endpoint ─────────────────────────────────────────

@pytest.fixture(scope="module")
def test_app():
    from sqlmodel import SQLModel, Session, create_engine
    from fastapi.testclient import TestClient

    engine = create_engine(
        "sqlite:///./test_pension_int.db",
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
        _os.unlink("./test_pension_int.db")
    except FileNotFoundError:
        pass


@pytest.fixture()
def db_session(test_app):
    from sqlmodel import Session
    _, engine = test_app
    with Session(engine) as s:
        yield s


def _seed_user(session, uid: str):
    from backend.app.models import User, Settings
    from sqlmodel import select

    existing = session.exec(select(User).where(User.supabase_user_id == uid)).first()
    if existing:
        return existing

    user = User(username=f"user-{uid}", supabase_user_id=uid)
    session.add(user)
    session.commit()
    session.refresh(user)
    session.add(Settings(user_id=user.id, base_currency="GBP"))
    session.commit()
    return user


_BASE_PAYLOAD = {
    "current_pot": 100_000,
    "current_age": 40,
    "retirement_age": 65,
    "monthly_contribution": 500,
    "annual_return_pct": 7.0,
    "annual_fee_pct": 0.75,
    "inflation_rate_pct": 2.5,
    "lump_sum_type": "none",
    "lump_sum_value": 0,
    "withdrawal_mode": "percentage",
    "withdrawal_value": 4.0,
    "target_end_age": 95,
}


class TestPensionPlanEndpoint:

    def test_returns_200_with_valid_payload(self, test_app, db_session):
        from backend.app.auth import get_current_user
        from backend.app.main import app as fastapi_app

        client, _ = test_app
        user = _seed_user(db_session, "pension-ok")

        async def _auth():
            return user

        fastapi_app.dependency_overrides[get_current_user] = _auth
        try:
            resp = client.post("/api/pension/plan", json=_BASE_PAYLOAD)
            assert resp.status_code == 200
            data = resp.json()
            assert "projected_pot_at_retirement" in data
            assert "comparison" in data
            assert len(data["comparison"]) == 3
        finally:
            del fastapi_app.dependency_overrides[get_current_user]

    def test_response_shape(self, test_app, db_session):
        from backend.app.auth import get_current_user
        from backend.app.main import app as fastapi_app

        client, _ = test_app
        user = _seed_user(db_session, "pension-shape")

        async def _auth():
            return user

        fastapi_app.dependency_overrides[get_current_user] = _auth
        try:
            resp = client.post("/api/pension/plan", json=_BASE_PAYLOAD)
            data = resp.json()
            for key in [
                "projected_pot_at_retirement",
                "lump_sum_applied",
                "remaining_pot",
                "monthly_income_nominal",
                "annual_income_nominal",
                "monthly_income_real",
                "annual_income_real",
                "pot_lasts_until_age",
                "years_in_drawdown",
                "survives_to_target_age",
                "comparison",
                "accumulation_series",
                "drawdown_series",
            ]:
                assert key in data, f"Missing key: {key}"
        finally:
            del fastapi_app.dependency_overrides[get_current_user]

    def test_401_without_auth(self, test_app):
        client, _ = test_app
        resp = client.post("/api/pension/plan", json=_BASE_PAYLOAD)
        assert resp.status_code == 401

    def test_422_on_invalid_ages(self, test_app, db_session):
        from backend.app.auth import get_current_user
        from backend.app.main import app as fastapi_app

        client, _ = test_app
        user = _seed_user(db_session, "pension-invalid-ages")

        async def _auth():
            return user

        fastapi_app.dependency_overrides[get_current_user] = _auth
        try:
            payload = {**_BASE_PAYLOAD, "retirement_age": 39}  # <= current_age
            resp = client.post("/api/pension/plan", json=payload)
            assert resp.status_code == 422
        finally:
            del fastapi_app.dependency_overrides[get_current_user]

    def test_lump_sum_scenario(self, test_app, db_session):
        from backend.app.auth import get_current_user
        from backend.app.main import app as fastapi_app

        client, _ = test_app
        user = _seed_user(db_session, "pension-lump")

        async def _auth():
            return user

        fastapi_app.dependency_overrides[get_current_user] = _auth
        try:
            payload = {
                **_BASE_PAYLOAD,
                "lump_sum_type": "percentage",
                "lump_sum_value": 25.0,
            }
            resp = client.post("/api/pension/plan", json=payload)
            assert resp.status_code == 200
            data = resp.json()
            # 25% lump sum: applied > 0
            assert data["lump_sum_applied"] > 0.0
            # remaining_pot < projected_pot
            assert data["remaining_pot"] < data["projected_pot_at_retirement"]
        finally:
            del fastapi_app.dependency_overrides[get_current_user]

    def test_fixed_monthly_withdrawal(self, test_app, db_session):
        from backend.app.auth import get_current_user
        from backend.app.main import app as fastapi_app

        client, _ = test_app
        user = _seed_user(db_session, "pension-fixed")

        async def _auth():
            return user

        fastapi_app.dependency_overrides[get_current_user] = _auth
        try:
            payload = {
                **_BASE_PAYLOAD,
                "withdrawal_mode": "fixed_monthly",
                "withdrawal_value": 2000.0,
            }
            resp = client.post("/api/pension/plan", json=payload)
            assert resp.status_code == 200
            data = resp.json()
            assert abs(data["monthly_income_nominal"] - 2000.0) < 0.01
        finally:
            del fastapi_app.dependency_overrides[get_current_user]

    def test_zero_pot_returns_zero_income(self, test_app, db_session):
        from backend.app.auth import get_current_user
        from backend.app.main import app as fastapi_app

        client, _ = test_app
        user = _seed_user(db_session, "pension-zero-pot")

        async def _auth():
            return user

        fastapi_app.dependency_overrides[get_current_user] = _auth
        try:
            payload = {**_BASE_PAYLOAD, "current_pot": 0, "monthly_contribution": 0}
            resp = client.post("/api/pension/plan", json=payload)
            assert resp.status_code == 200
            data = resp.json()
            assert data["monthly_income_nominal"] == 0.0
        finally:
            del fastapi_app.dependency_overrides[get_current_user]

    def test_accumulation_series_ages_are_correct(self, test_app, db_session):
        from backend.app.auth import get_current_user
        from backend.app.main import app as fastapi_app

        client, _ = test_app
        user = _seed_user(db_session, "pension-series-ages")

        async def _auth():
            return user

        fastapi_app.dependency_overrides[get_current_user] = _auth
        try:
            resp = client.post("/api/pension/plan", json=_BASE_PAYLOAD)
            data = resp.json()
            series = data["accumulation_series"]
            assert series[0]["age"] == 40
            assert series[-1]["age"] == 65
        finally:
            del fastapi_app.dependency_overrides[get_current_user]
