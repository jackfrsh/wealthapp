"""
Dashboard router: live net worth, delta vs prior snapshots, timeseries.

GET /dashboard?range=1M   (7D | 1M | 3M | 1Y | ALL)
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from ..auth import get_current_user
from ..database import get_session
from ..models import Account, Goal, Settings, Snapshot, User
from ..routers.fx import convert_to_base, get_fx_cache
from ..routers.goals import compute_goal_forecast

router = APIRouter(prefix="/dashboard", tags=["dashboard"])
logger = logging.getLogger("wealth.dashboard")

RANGE_DAYS: dict[str, int | None] = {
    "7D": 7,
    "1M": 30,
    "3M": 90,
    "1Y": 365,
    "ALL": None,
}

CRYPTO_PSEUDO_FIAT = {"BTC", "ETH"}  # MVP: treat balances as fiat-value entered by user


@router.get("")
async def dashboard(
    range: str = "1M",
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    # Settings
    settings = session.exec(
        select(Settings).where(Settings.user_id == current_user.id)
    ).first()
    base_currency = (settings.base_currency if settings else "GBP").upper()
    goal = float(settings.goal if settings else 0)

    # FX
    fx_cache = await get_fx_cache(base_currency, session)
    rates = fx_cache.get_rates()
    fx_as_of = fx_cache.cache_date

    # Live net worth
    accounts = session.exec(
        select(Account).where(Account.user_id == current_user.id)
    ).all()

    included = [a for a in accounts if getattr(a, "include_in_net_worth", True)]
    excluded_accounts = 0
    current_total = 0.0

    for acc in included:
        ccy = (acc.currency or base_currency).upper()
        bal = float(acc.balance or 0.0)

        # MVP crypto rule: treat BTC/ETH balances as already base-currency value
        if ccy in CRYPTO_PSEUDO_FIAT:
            current_total += bal
            continue

        try:
            current_total += float(
                convert_to_base(
                    bal,
                    ccy,
                    base_currency,
                    rates,
                )
            )
        except Exception:
            excluded_accounts += 1

    current_total = round(current_total, 2)

    # Snapshots
    all_snaps = session.exec(
        select(Snapshot)
        .where(Snapshot.user_id == current_user.id)
        .order_by(Snapshot.created_at.asc())
    ).all()

    # Compute range-specific delta (first snapshot in range vs latest)
    days = RANGE_DAYS.get(range.upper(), 30)
    cutoff = None
    if days is not None:
        cutoff = datetime.now(timezone.utc) - timedelta(days=int(days))

    series: list[dict[str, object]] = []
    for snap in all_snaps:
        snap_dt = snap.created_at
        if snap_dt.tzinfo is None:
            snap_dt = snap_dt.replace(tzinfo=timezone.utc)
        if cutoff and snap_dt < cutoff:
            continue
        series.append({"t": snap.created_at.isoformat(), "v": float(snap.total_base)})

    # Range delta: change from first point in range to current
    range_change = 0.0
    range_change_pct = 0.0
    if len(series) > 0:
        first_in_range = series[0]["v"]
        range_change = round(current_total - first_in_range, 2)
        if first_in_range != 0:
            range_change_pct = round((range_change / abs(first_in_range)) * 100, 2)

    # ─── Primary goal + forecast ────────────────────────────────────────────────
    primary_goal = session.exec(
        select(Goal).where(
            Goal.user_id == current_user.id,
            Goal.is_primary == True,
        )
    ).first()

    goal_data = None
    forecast_data = None
    if primary_goal:
        try:
            years = max(1, primary_goal.target_age - primary_goal.current_age)
            forecast_result = compute_goal_forecast(
                goal=primary_goal,
                current_net_worth=current_total,
                base_currency=base_currency,
            )
            goal_data = {
                "id": primary_goal.id,
                "goal_type": primary_goal.goal_type,
                "name": primary_goal.name,
                "target_amount": primary_goal.target_amount,
                "current_age": primary_goal.current_age,
                "target_age": primary_goal.target_age,
                "monthly_contribution": primary_goal.monthly_contribution,
                "expected_annual_return_pct": primary_goal.expected_annual_return_pct,
                "years_remaining": years,
            }
            forecast_data = {
                "status": forecast_result["status"],
                "projected_end_value": forecast_result["projected_end_value"],
                "years_remaining": forecast_result["years_remaining"],
            }
        except Exception:
            logger.exception("Forecast computation failed for goal_id=%s", primary_goal.id)
            goal_data = {
                "id": primary_goal.id,
                "goal_type": primary_goal.goal_type,
                "name": primary_goal.name,
                "target_amount": primary_goal.target_amount,
                "current_age": primary_goal.current_age,
                "target_age": primary_goal.target_age,
                "monthly_contribution": primary_goal.monthly_contribution,
                "expected_annual_return_pct": primary_goal.expected_annual_return_pct,
                "years_remaining": max(1, primary_goal.target_age - primary_goal.current_age),
            }
            forecast_data = None

    return {
        "base_currency": base_currency,
        "current_total": current_total,
        "range_change": range_change,
        "range_change_pct": range_change_pct,
        "goal": goal,
        "accounts_count": len(accounts),
        "fx_as_of": fx_as_of,
        "excluded_accounts": excluded_accounts,
        "series": series,
        "total_snapshots": len(all_snaps),
        "primary_goal": goal_data,
        "forecast": forecast_data,
    }