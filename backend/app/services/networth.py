"""Net worth computation, snapshots, and projections.

Kept intentionally small and dependency-light for MVP.

Assumptions (MVP):
- Monthly contribution is in the account's own currency.
- Projection uses today's FX rates as constant across the horizon.
- Debts (negative balances) follow the same formula.
- Crypto (BTC/ETH) balances are treated as *fiat-value entered by the user*
  (already in base currency) to avoid live pricing complexity.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date
from typing import Optional

from fastapi import HTTPException
from sqlmodel import Session, select

from ..models import Account, Settings, Snapshot
from ..routers.fx import convert_to_base, get_fx_cache

CRYPTO_PSEUDO_FIAT = {"BTC", "ETH"}


@dataclass
class NetWorthResult:
    base_currency: str
    fx_as_of: str
    total_base: float
    excluded_accounts: int
    breakdown_json: str


def _value_to_base_mvp(balance: float, currency: str, base_currency: str, rates: dict) -> float:
    """Convert a balance to base currency.

    MVP rule:
    - BTC/ETH are treated as already-denominated in base currency (fiat value).
    """
    ccy = (currency or base_currency or "GBP").upper()
    if ccy in CRYPTO_PSEUDO_FIAT:
        return float(balance or 0.0)

    # Normal FX conversion path
    return float(convert_to_base(balance, ccy, base_currency, rates))


async def compute_live_networth(session: Session, user_id: int) -> NetWorthResult:
    """Compute current net worth in the user's base currency."""
    settings = session.exec(select(Settings).where(Settings.user_id == user_id)).first()
    base_currency = (settings.base_currency if settings else "GBP").upper()

    fx_cache = await get_fx_cache(base_currency, session)
    rates = fx_cache.get_rates()

    accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
    included = [a for a in accounts if a.include_in_net_worth]

    total = 0.0
    excluded = 0
    breakdown = []

    for acc in included:
        try:
            value_base = _value_to_base_mvp(acc.balance, acc.currency, base_currency, rates)
        except HTTPException:
            excluded += 1
            continue

        total += float(value_base)
        breakdown.append(
            {
                "id": acc.id,
                "name": acc.name,
                "currency": acc.currency,
                "balance": acc.balance,
                "value_base": round(float(value_base), 2),
            }
        )

    return NetWorthResult(
        base_currency=base_currency,
        fx_as_of=str(fx_cache.cache_date),
        total_base=round(total, 2),
        excluded_accounts=excluded,
        breakdown_json=json.dumps(breakdown),
    )


async def write_snapshot(session: Session, user_id: int) -> Snapshot:
    """Write a net worth snapshot for the given user."""
    nw = await compute_live_networth(session, user_id)

    snap = Snapshot(
        user_id=user_id,
        base_currency=nw.base_currency,
        total_base=nw.total_base,
        fx_as_of=nw.fx_as_of,
        excluded_accounts=nw.excluded_accounts,
        breakdown_json=nw.breakdown_json,
    )
    session.add(snap)
    session.commit()
    session.refresh(snap)
    return snap


def _add_months(d: date, months: int) -> date:
    """Add months to a date (day clamped to 1 for stability)."""
    y = d.year + (d.month - 1 + months) // 12
    m = (d.month - 1 + months) % 12 + 1
    return date(y, m, 1)


async def compute_projection_series(session: Session, user_id: int, years: int = 10):
    """Compute an aggregate net worth projection series.

    Returns: dict with:
      base_currency, fx_as_of, excluded_accounts, years, points
    where points = [{date, projected_net_worth}]
    """
    if years < 1:
        years = 1
    if years > 50:
        years = 50

    settings = session.exec(select(Settings).where(Settings.user_id == user_id)).first()
    base_currency = (settings.base_currency if settings else "GBP").upper()

    fx_cache = await get_fx_cache(base_currency, session)
    rates = fx_cache.get_rates()

    accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
    included = [a for a in accounts if a.include_in_net_worth]

    # Prepare per-account mutable state in native currency
    state = []
    for a in included:
        state.append(
            {
                "currency": (a.currency or base_currency).upper(),
                "balance": float(a.balance or 0.0),
                "c": float(getattr(a, "monthly_contribution", 0.0) or 0.0),
                "r": float(getattr(a, "annual_interest_rate_percent", 0.0) or 0.0) / 100.0,
            }
        )

    start = date.today().replace(day=1)
    months = years * 12

    points = []

    # Count excluded accounts based on current FX coverage (MVP: BTC/ETH never excluded)
    excluded_current = 0
    for acc in state:
        try:
            _ = _value_to_base_mvp(acc["balance"], acc["currency"], base_currency, rates)
        except HTTPException:
            excluded_current += 1

    for m in range(0, months + 1):
        # Sum current month
        total = 0.0
        excluded = 0
        for acc in state:
            try:
                total += _value_to_base_mvp(acc["balance"], acc["currency"], base_currency, rates)
            except HTTPException:
                excluded += 1
                continue

        points.append(
            {
                "date": _add_months(start, m).isoformat(),
                "projected_net_worth": round(float(total), 2),
            }
        )

        # Advance one month (except after last point)
        if m == months:
            break

        for acc in state:
            monthly_r = acc["r"] / 12.0
            acc["balance"] = acc["balance"] * (1.0 + monthly_r) + acc["c"]

    return {
        "base_currency": base_currency,
        "fx_as_of": str(fx_cache.cache_date),
        "excluded_accounts": excluded_current,
        "years": years,
        "points": points,
    }