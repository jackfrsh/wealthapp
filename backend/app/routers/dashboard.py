"""
Dashboard router: live net worth, delta vs prior snapshots, timeseries.

GET /dashboard?range=1M   (7D | 1M | 3M | 1Y | ALL)
"""
from __future__ import annotations

import json
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


def _compute_breakdown_delta(old_snap: Snapshot, new_snap: Snapshot) -> list[dict] | None:
    """Compare two snapshots and return top movers by absolute delta.

    Matching uses stable account IDs when present (so renames don't produce
    false delete+add pairs).  For legacy snapshots that pre-date the id field,
    the account name is used as the fallback key.

    Returns up to 3 items: [{name, delta}] sorted by abs(delta) desc.
    Returns None when there is no meaningful data to show.
    """
    def _key(item: dict) -> str:
        """Stable key: str(id) when available, else account name."""
        raw_id = item.get("id")
        return str(raw_id) if raw_id is not None else item.get("name", "")

    try:
        old_raw = json.loads(old_snap.breakdown_json or "[]")
        new_raw = json.loads(new_snap.breakdown_json or "[]")

        old_items: dict[str, float] = {
            _key(item): float(item.get("value_base", 0))
            for item in old_raw
            if _key(item)
        }
        # For display: prefer the newest snapshot's name; fall back to old name.
        old_name_by_key: dict[str, str] = {
            _key(item): item.get("name", _key(item))
            for item in old_raw
            if _key(item)
        }
        new_name_by_key: dict[str, str] = {
            _key(item): item.get("name", _key(item))
            for item in new_raw
            if _key(item)
        }
        new_items: dict[str, float] = {
            _key(item): float(item.get("value_base", 0))
            for item in new_raw
            if _key(item)
        }

        all_keys = set(old_items) | set(new_items)
        if not all_keys:
            return None

        movers = []
        for key in all_keys:
            delta = new_items.get(key, 0.0) - old_items.get(key, 0.0)
            if abs(delta) >= 1.0:  # suppress sub-unit noise
                display_name = new_name_by_key.get(key) or old_name_by_key.get(key, key)
                movers.append({"name": display_name, "delta": round(delta, 2)})

        if not movers:
            return None

        movers.sort(key=lambda x: abs(x["delta"]), reverse=True)
        return movers[:3]
    except Exception:
        logger.debug("breakdown_delta computation failed", exc_info=True)
        return None


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

    # Snapshots — only those recorded in the current base currency are comparable.
    # Mixing snapshots from a different currency would produce nonsense deltas.
    all_snaps = session.exec(
        select(Snapshot)
        .where(Snapshot.user_id == current_user.id)
        .order_by(Snapshot.created_at.asc())
    ).all()

    # Detect if any snapshots exist in a different currency (user changed base currency).
    history_currency_changed = any(
        s.base_currency != base_currency for s in all_snaps
    )

    # Only use snapshots that match the current base currency for delta/chart.
    comparable_snaps = [s for s in all_snaps if s.base_currency == base_currency]

    # Compute range-specific delta (first snapshot in range vs latest)
    days = RANGE_DAYS.get(range.upper(), 30)
    cutoff = None
    if days is not None:
        cutoff = datetime.now(timezone.utc) - timedelta(days=int(days))

    # Most recent snapshot date (regardless of range — for Home freshness indicator).
    last_snapshot_date: str | None = None
    if comparable_snaps:
        last_snap = comparable_snaps[-1]
        lsd = last_snap.created_at
        if lsd.tzinfo is None:
            lsd = lsd.replace(tzinfo=timezone.utc)
        last_snapshot_date = lsd.isoformat()

    series: list[dict[str, object]] = []
    range_snaps: list[Snapshot] = []  # comparable snaps within the selected range
    for snap in comparable_snaps:
        snap_dt = snap.created_at
        if snap_dt.tzinfo is None:
            snap_dt = snap_dt.replace(tzinfo=timezone.utc)
        if cutoff and snap_dt < cutoff:
            continue
        range_snaps.append(snap)
        series.append({"t": snap.created_at.isoformat(), "v": float(snap.total_base)})

    # Breakdown delta: top movers between first and last snapshot in the range.
    # Uses the same comparison window as the hero range_change for consistency.
    # Suppressed when cross-currency or fewer than two snapshots in range.
    breakdown_delta: list[dict] | None = None
    if len(range_snaps) >= 2 and not history_currency_changed:
        breakdown_delta = _compute_breakdown_delta(range_snaps[0], range_snaps[-1])

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
        # True when the user has old snapshots in a different base currency.
        # The frontend should surface a message explaining why history is limited.
        "history_currency_changed": history_currency_changed and not series,
        # ISO timestamp of the most recent comparable snapshot, or null.
        # Used by Home to display snapshot freshness.
        "last_snapshot_date": last_snapshot_date,
        # Top movers between first and last snapshot in the selected range.
        # Null when history is insufficient or cross-currency.
        "breakdown_delta": breakdown_delta,
        "primary_goal": goal_data,
        "forecast": forecast_data,
    }