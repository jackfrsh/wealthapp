"""
FX router: daily-cached exchange rates.

Rate fetching strategy:
  1. Try ExchangeRate-API (free tier, no key needed for popular pairs)
  2. Fall back to Open Exchange Rates (USD base only, free)
  3. Fall back to hardcoded approximate rates so the app stays usable

Rates are stored as: how many units of TARGET per 1 unit of BASE.
  e.g., base=GBP, rates={"USD": 1.27, "EUR": 1.16, "GBP": 1.0}
"""
from __future__ import annotations

import json
from datetime import date, datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..auth import get_current_user
from ..database import get_session
from ..models import FxRateCache, User

router = APIRouter(prefix="/fx", tags=["fx"])


# ─── Fallback rates (relative to GBP base, approximate) ─────────────────────

FALLBACK_RATES_GBP: dict[str, float] = {
    "GBP": 1.0,
    "USD": 1.27,
    "EUR": 1.16,
    "CHF": 1.12,
    "AUD": 1.93,
    "CAD": 1.73,
    "JPY": 196.0,
    "SEK": 13.5,
    "NOK": 13.6,
    "DKK": 8.65,
    "NZD": 2.10,
    "SGD": 1.71,
    "HKD": 9.93,
    "INR": 106.0,
    "BTC": 0.0000155,
    "ETH": 0.000374,
}


def _cross_rates(base: str, gbp_rates: dict[str, float]) -> dict[str, float]:
    """Convert GBP-base rates to any other base currency."""
    if base == "GBP":
        return gbp_rates.copy()
    if base not in gbp_rates:
        raise ValueError(f"Unknown currency: {base}")
    base_in_gbp = 1.0 / gbp_rates[base]   # 1 unit of base = X GBP
    result: dict[str, float] = {}
    for ccy, rate_gbp in gbp_rates.items():
        # 1 base = rate_gbp/gbp_rates[base] units of ccy
        result[ccy] = rate_gbp * base_in_gbp
    return result


async def _fetch_from_web(base: str) -> dict[str, float] | None:
    """Attempt to pull live rates from a free public API."""
    urls = [
        f"https://open.er-api.com/v6/latest/{base}",
        f"https://api.exchangerate-api.com/v4/latest/{base}",
    ]
    async with httpx.AsyncClient(timeout=6.0) as client:
        for url in urls:
            try:
                r = await client.get(url)
                if r.status_code == 200:
                    data = r.json()
                    # open.er-api.com uses "rates", exchangerate-api uses "rates"
                    rates = data.get("rates") or data.get("conversion_rates")
                    if rates and isinstance(rates, dict):
                        return {k.upper(): float(v) for k, v in rates.items()}
            except Exception:
                continue
    return None


def _get_or_create_cache(
    base: str,
    session: Session,
    force_refresh: bool = False,
) -> FxRateCache:
    today = date.today().isoformat()

    if not force_refresh:
        cached = session.exec(
            select(FxRateCache).where(
                FxRateCache.cache_date == today,
                FxRateCache.base_currency == base.upper(),
            )
        ).first()
        if cached:
            return cached

    # Delete stale entry for today if refreshing
    stale = session.exec(
        select(FxRateCache).where(
            FxRateCache.cache_date == today,
            FxRateCache.base_currency == base.upper(),
        )
    ).first()
    if stale:
        session.delete(stale)
        session.commit()

    # Use fallback rates (sync path — web fetch is separate)
    fallback = _cross_rates(base.upper(), FALLBACK_RATES_GBP)
    entry = FxRateCache(
        cache_date=today,
        base_currency=base.upper(),
        rates_json=json.dumps(fallback),
        fetched_at=datetime.now(timezone.utc),
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


async def get_fx_cache(base: str, session: Session) -> FxRateCache:
    """Get cached FX rates. Returns instantly from DB or fallback. Never blocks on network.

    Strategy:
    1. If today's cache exists → return it (instant, ~1ms)
    2. If no cache → return in-memory fallback immediately, schedule async refresh
    """
    today = date.today().isoformat()

    try:
        cached = session.exec(
            select(FxRateCache).where(
                FxRateCache.cache_date == today,
                FxRateCache.base_currency == base.upper(),
            )
        ).first()
        if cached:
            return cached
    except Exception:
        pass

    # No cache for today — return fallback immediately
    fallback = _cross_rates(base.upper(), FALLBACK_RATES_GBP)
    fallback_entry = FxRateCache(
        id=-1,
        cache_date=today,
        base_currency=base.upper(),
        rates_json=json.dumps(fallback),
        fetched_at=datetime.now(timezone.utc),
    )

    # Schedule background refresh (fire-and-forget)
    import asyncio
    try:
        asyncio.get_event_loop().create_task(_background_fx_refresh(base.upper(), today))
    except Exception:
        pass

    return fallback_entry


async def _background_fx_refresh(base: str, today: str) -> None:
    """Fetch live rates and persist to DB. Runs in background, never blocks requests."""
    try:
        live = await _fetch_from_web(base)
        if not live:
            return

        from .._bg_session import get_bg_session
        with get_bg_session() as session:
            # Delete stale
            stale = session.exec(
                select(FxRateCache).where(
                    FxRateCache.cache_date == today,
                    FxRateCache.base_currency == base,
                )
            ).first()
            if stale:
                session.delete(stale)
                session.commit()

            entry = FxRateCache(
                cache_date=today,
                base_currency=base,
                rates_json=json.dumps(live),
                fetched_at=datetime.now(timezone.utc),
            )
            session.add(entry)
            session.commit()
    except Exception:
        pass  # Background task — never raise
CRYPTO_PSEUDO_FIAT = {"BTC", "ETH"}  # MVP: user-entered fiat value


def convert_to_base(
    amount: float,
    from_currency: str,
    base_currency: str,
    rates: dict[str, float],
) -> float:
    """Convert amount from from_currency into base_currency using provided rates.

    MVP rule:
    - BTC/ETH balances are treated as already in base currency (fiat value entered by user).
    """

    from_currency = (from_currency or base_currency or "GBP").upper()
    base_currency = (base_currency or "GBP").upper()

    # ✅ Crypto rule
    if from_currency in CRYPTO_PSEUDO_FIAT:
        return float(amount or 0.0)

    # If already base
    if from_currency == base_currency:
        return float(amount or 0.0)

    if from_currency not in rates:
        raise HTTPException(
            status_code=400,
            detail=f"No FX rate available for {from_currency} → {base_currency}",
        )

    rate = rates[from_currency]
    return float(amount or 0.0) / float(rate)


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/latest")
async def fx_latest(
    base: str = "GBP",
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    cache = await get_fx_cache(base.upper(), session)
    return {
        "date": cache.cache_date,
        "base_currency": cache.base_currency,
        "rates": cache.get_rates(),
        "fetched_at": cache.fetched_at,
        "source": "live" if cache.fetched_at else "fallback",
    }


@router.post("/refresh")
async def fx_refresh(
    base: str = "GBP",
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Force-refresh the FX cache for today."""
    today = date.today().isoformat()
    stale = session.exec(
        select(FxRateCache).where(
            FxRateCache.cache_date == today,
            FxRateCache.base_currency == base.upper(),
        )
    ).first()
    if stale:
        session.delete(stale)
        session.commit()

    cache = await get_fx_cache(base.upper(), session)
    return {
        "date": cache.cache_date,
        "base_currency": cache.base_currency,
        "rates": cache.get_rates(),
        "fetched_at": cache.fetched_at,
    }
