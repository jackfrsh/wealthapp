"""
Pension drawdown planner — stateless projection endpoint.

POST /pension/plan

Three-phase model
─────────────────
Phase 1  Accumulation : compound monthly growth from current age to retirement.
Phase 2  Lump sum     : optional cash extraction at retirement.
Phase 3  Drawdown     : withdrawal simulation to depletion or target end age.

Compounding cadence: monthly geometric.
  r_monthly = (1 + net_annual_rate)^(1/12) - 1
  where net_annual_rate = (annual_return_pct - annual_fee_pct) / 100

This differs from the simpler r/12 used in goals.py (which is adequate for
long accumulation horizons but slightly understates the compounding benefit).
The difference is intentional and documented here so future readers can
reconcile both models.

All outputs are nominal (not inflation-adjusted) unless explicitly labelled
_real.  Real-terms figures are deflated by (1 + inflation_rate_pct/100)^N
where N = years from today to retirement.

Outputs are illustrative only and must never be presented as advice.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator

from ..auth import get_current_user
from ..models import User

router = APIRouter(prefix="/pension", tags=["pension"])
logger = logging.getLogger("wealth.pension")

# Comparison rates shown in the drawdown table — illustrative, not advice.
_COMPARISON_RATES: list[float] = [3.0, 4.0, 5.0]


# ─── Input / output schemas ───────────────────────────────────────────────────

class PensionPlanRequest(BaseModel):
    current_pot: float = Field(default=0.0, ge=0.0)
    current_age: int = Field(ge=18, le=99)
    retirement_age: int = Field(ge=18, le=99)
    monthly_contribution: float = Field(default=0.0, ge=0.0)
    annual_return_pct: float = Field(default=7.0, ge=0.0, le=30.0)
    annual_fee_pct: float = Field(default=0.75, ge=0.0, le=5.0)
    inflation_rate_pct: float = Field(default=2.5, ge=0.0, le=10.0)
    # Lump sum taken at retirement
    lump_sum_type: str = Field(default="none")   # "none" | "amount" | "percentage"
    lump_sum_value: float = Field(default=0.0, ge=0.0)
    # Drawdown withdrawal
    withdrawal_mode: str = Field(default="percentage")  # "percentage" | "fixed_monthly"
    withdrawal_value: float = Field(default=4.0, ge=0.0)
    target_end_age: int = Field(default=95, ge=20, le=110)

    @model_validator(mode="after")
    def _validate_ages_and_modes(self) -> "PensionPlanRequest":
        if self.retirement_age <= self.current_age:
            raise ValueError("retirement_age must be greater than current_age")
        if self.target_end_age <= self.retirement_age:
            raise ValueError("target_end_age must be greater than retirement_age")
        if self.lump_sum_type not in ("none", "amount", "percentage"):
            raise ValueError("lump_sum_type must be 'none', 'amount', or 'percentage'")
        if self.withdrawal_mode not in ("percentage", "fixed_monthly"):
            raise ValueError("withdrawal_mode must be 'percentage' or 'fixed_monthly'")
        return self


# ─── Pure calculation helpers ─────────────────────────────────────────────────

def _net_monthly_rate(annual_return_pct: float, annual_fee_pct: float) -> float:
    """Monthly growth rate net of fees, geometric compounding.

    Example: 7% return, 0.75% fee → 6.25% net → r_monthly ≈ 0.005063
    Handles negative net_annual gracefully (returns a negative rate).
    """
    net_annual = (annual_return_pct - annual_fee_pct) / 100.0
    return (1.0 + net_annual) ** (1.0 / 12.0) - 1.0


def _accumulate(
    current_pot: float,
    monthly_contribution: float,
    r_monthly: float,
    years: int,
) -> tuple[float, list[dict]]:
    """Compound monthly for `years` years.

    Each month: pot = pot * (1 + r_monthly) + monthly_contribution

    Returns:
        (final_pot, annual_series)
        annual_series entries: {"age_offset": int, "value": float}
        age_offset 0 = start of accumulation (today).
    """
    pot = float(current_pot)
    series: list[dict] = [{"age_offset": 0, "value": round(pot, 2)}]
    n_months = years * 12
    for m in range(1, n_months + 1):
        pot = pot * (1.0 + r_monthly) + monthly_contribution
        if m % 12 == 0:
            series.append({"age_offset": m // 12, "value": round(max(pot, 0.0), 2)})
    return pot, series


def _apply_lump_sum(
    pot: float,
    lump_sum_type: str,
    lump_sum_value: float,
) -> tuple[float, float]:
    """Apply lump sum at retirement.

    Returns: (lump_sum_applied, remaining_pot)
    Clamped so remaining_pot >= 0 (cannot take more than the pot).
    """
    if lump_sum_type == "none" or lump_sum_value <= 0.0:
        return 0.0, round(pot, 2)
    if lump_sum_type == "amount":
        applied = min(float(lump_sum_value), pot)
    else:  # percentage
        applied = pot * min(float(lump_sum_value), 100.0) / 100.0
    remaining = max(pot - applied, 0.0)
    return round(applied, 2), round(remaining, 2)


def _monthly_withdrawal_amount(
    remaining_pot: float,
    withdrawal_mode: str,
    withdrawal_value: float,
) -> float:
    """Constant monthly withdrawal for drawdown.

    percentage  — initial-pot method: (remaining_pot × rate%) / 12.
                  Applied once at retirement; amount stays constant in
                  nominal terms for the full drawdown period.
    fixed_monthly — user-specified constant monthly amount.
    """
    if withdrawal_mode == "percentage":
        return round(remaining_pot * (withdrawal_value / 100.0) / 12.0, 2)
    return round(float(withdrawal_value), 2)


def _simulate_drawdown(
    remaining_pot: float,
    monthly_draw: float,
    r_monthly: float,
    retirement_age: int,
    target_end_age: int,
) -> tuple[int | None, bool, list[dict]]:
    """Simulate drawdown month-by-month from retirement_age to target_end_age.

    Each month: pot = pot * (1 + r_monthly) - monthly_draw

    Depletion age: retirement_age + (m // 12) where m is the 1-based month
    index when the pot first reaches zero.  This gives the number of full
    years of retirement income the pot could sustain.

    Returns:
        (pot_lasts_until_age, survives_to_target_age, annual_series)
        pot_lasts_until_age — None if pot survives full horizon.
        annual_series entries: {"age_offset": int, "value": float}
    """
    pot = float(remaining_pot)
    total_years = target_end_age - retirement_age
    n_months = total_years * 12
    depletion_age: int | None = None
    series: list[dict] = [{"age_offset": 0, "value": round(pot, 2)}]

    # Pot already empty at retirement
    if pot <= 0.0:
        for y in range(1, total_years + 1):
            series.append({"age_offset": y, "value": 0.0})
        return retirement_age, False, series

    # No withdrawals — pot only grows
    if monthly_draw <= 0.0:
        for m in range(1, n_months + 1):
            pot = pot * (1.0 + r_monthly)
            if m % 12 == 0:
                series.append({"age_offset": m // 12, "value": round(pot, 2)})
        return None, True, series

    last_year_added = 0
    for m in range(1, n_months + 1):
        pot = pot * (1.0 + r_monthly) - monthly_draw

        if m % 12 == 0:
            year = m // 12
            series.append({"age_offset": year, "value": round(max(pot, 0.0), 2)})
            last_year_added = year

        if pot <= 0.0 and depletion_age is None:
            # Full years of retirement income sustained = m // 12
            depletion_age = min(retirement_age + m // 12, target_end_age)
            # Pad remaining series with zeros for clean chart rendering
            for y in range(last_year_added + 1, total_years + 1):
                series.append({"age_offset": y, "value": 0.0})
            break

    return depletion_age, (depletion_age is None), series


# ─── Top-level computation ────────────────────────────────────────────────────

def compute_pension_plan(req: PensionPlanRequest) -> dict:
    """Full pension projection: accumulation → lump sum → drawdown.

    Pure function — no side effects, no DB access.
    Raises ValueError on invalid inputs (caught by the endpoint).
    """
    years_to_retirement = req.retirement_age - req.current_age
    r_monthly = _net_monthly_rate(req.annual_return_pct, req.annual_fee_pct)

    # ── Phase 1: Accumulation ─────────────────────────────────────────────
    raw_pot, accum_raw = _accumulate(
        current_pot=req.current_pot,
        monthly_contribution=req.monthly_contribution,
        r_monthly=r_monthly,
        years=years_to_retirement,
    )
    projected_pot = round(max(raw_pot, 0.0), 2)
    accumulation_series = [
        {"age": req.current_age + s["age_offset"], "value": s["value"]}
        for s in accum_raw
    ]

    # ── Phase 2: Lump sum ─────────────────────────────────────────────────
    lump_sum_applied, remaining_pot = _apply_lump_sum(
        pot=projected_pot,
        lump_sum_type=req.lump_sum_type,
        lump_sum_value=req.lump_sum_value,
    )

    # ── Phase 3: Primary drawdown ─────────────────────────────────────────
    monthly_draw = _monthly_withdrawal_amount(
        remaining_pot=remaining_pot,
        withdrawal_mode=req.withdrawal_mode,
        withdrawal_value=req.withdrawal_value,
    )
    annual_income_nominal = round(monthly_draw * 12.0, 2)

    # Real-terms deflation: today's purchasing power of future income
    inflation_factor = (1.0 + req.inflation_rate_pct / 100.0) ** years_to_retirement
    monthly_income_real = round(monthly_draw / inflation_factor, 2)
    annual_income_real = round(annual_income_nominal / inflation_factor, 2)

    depletion_age, survives, drawdown_raw = _simulate_drawdown(
        remaining_pot=remaining_pot,
        monthly_draw=monthly_draw,
        r_monthly=r_monthly,
        retirement_age=req.retirement_age,
        target_end_age=req.target_end_age,
    )
    drawdown_series = [
        {"age": req.retirement_age + s["age_offset"], "value": s["value"]}
        for s in drawdown_raw
    ]

    years_in_drawdown = (
        depletion_age - req.retirement_age
        if depletion_age is not None
        else req.target_end_age - req.retirement_age
    )

    # ── Drawdown rate comparison (always percentage / initial-pot) ────────
    comparison: list[dict] = []
    for rate in _COMPARISON_RATES:
        comp_draw = round(remaining_pot * (rate / 100.0) / 12.0, 2)
        comp_annual = round(comp_draw * 12.0, 2)
        comp_dep, comp_survives, _ = _simulate_drawdown(
            remaining_pot=remaining_pot,
            monthly_draw=comp_draw,
            r_monthly=r_monthly,
            retirement_age=req.retirement_age,
            target_end_age=req.target_end_age,
        )
        comparison.append({
            "rate_pct": rate,
            "annual_income_nominal": comp_annual,
            "monthly_income_nominal": comp_draw,
            "annual_income_real": round(comp_annual / inflation_factor, 2),
            "monthly_income_real": round(comp_draw / inflation_factor, 2),
            "pot_lasts_until_age": comp_dep,
            "survives_to_target_age": comp_survives,
        })

    return {
        "projected_pot_at_retirement": projected_pot,
        "lump_sum_applied": lump_sum_applied,
        "remaining_pot": remaining_pot,
        "monthly_income_nominal": monthly_draw,
        "annual_income_nominal": annual_income_nominal,
        "monthly_income_real": monthly_income_real,
        "annual_income_real": annual_income_real,
        "pot_lasts_until_age": depletion_age,
        "years_in_drawdown": years_in_drawdown,
        "survives_to_target_age": survives,
        "comparison": comparison,
        "accumulation_series": accumulation_series,
        "drawdown_series": drawdown_series,
    }


# ─── Endpoint ─────────────────────────────────────────────────────────────────

@router.post("/plan")
async def pension_plan(
    req: PensionPlanRequest,
    current_user: User = Depends(get_current_user),
):
    """Compute a pension drawdown projection.

    Stateless — no data is persisted.
    Outputs are illustrative only and must not be presented as financial advice.
    """
    try:
        return compute_pension_plan(req)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception:
        logger.exception("Pension plan computation failed")
        raise HTTPException(status_code=500, detail="Computation failed")
