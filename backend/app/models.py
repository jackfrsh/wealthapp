"""SQLModel models for Wealth App.

This repo uses SQLite + SQLModel without Alembic.
Schema changes are applied via a lightweight ensure step (see database.ensure_schema).

FX rates are stored as: 1 BASE = X QUOTE.
Example: base GBP, USD=1.366 means 1 GBP = 1.366 USD.
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Optional

from sqlmodel import SQLModel, Field


# ─── Users ───────────────────────────────────────────────────────────────────

class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    password_hash: str = Field(default="")
    supabase_user_id: Optional[str] = Field(default=None, index=True)

    # Stripe (nullable; added for Pro billing)
    stripe_customer_id: Optional[str] = Field(default=None, index=True)
    stripe_subscription_id: Optional[str] = Field(default=None, index=True)

    created_at: datetime = Field(default_factory=datetime.utcnow)


# ─── Settings ────────────────────────────────────────────────────────────────

class Settings(SQLModel, table=True):
    __tablename__ = "settings"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True, unique=True)
    base_currency: str = Field(default="GBP")
    goal: float = Field(default=0.0)
    theme_preference: str = Field(default="system")  # "system" | "dark" | "light"
    is_pro: bool = Field(default=False)


# ─── Accounts ────────────────────────────────────────────────────────────────

class Account(SQLModel, table=True):
    __tablename__ = "accounts"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)

    name: str
    type: str = Field(default="bank")  # bank / isa / sipp / crypto / mortgage / other
    currency: str = Field(default="GBP")
    balance: float = Field(default=0.0)
    include_in_net_worth: bool = Field(default=True)
    notes: Optional[str] = Field(default=None)

    # Projection inputs (MVP)
    monthly_contribution: float = Field(default=0.0)
    annual_interest_rate_percent: float = Field(default=0.0)

    updated_at: datetime = Field(default_factory=datetime.utcnow)


# ─── FX Rate Cache ───────────────────────────────────────────────────────────

class FxRateCache(SQLModel, table=True):
    __tablename__ = "fx_rate_cache"

    id: Optional[int] = Field(default=None, primary_key=True)
    cache_date: str  # ISO YYYY-MM-DD
    base_currency: str
    rates_json: str  # JSON dict: {"USD": 1.27, ...}
    fetched_at: datetime = Field(default_factory=datetime.utcnow)

    def get_rates(self) -> dict[str, float]:
        return json.loads(self.rates_json)


# ─── Goals ────────────────────────────────────────────────────────────────────

class Goal(SQLModel, table=True):
    __tablename__ = "goals"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)

    goal_type: str = Field(default="retirement")  # retirement | savings | property
    name: str = Field(default="Retirement")
    target_amount: float = Field(default=0.0)
    current_age: int = Field(default=30)
    target_age: int = Field(default=60)
    monthly_contribution: float = Field(default=0.0)
    expected_annual_return_pct: float = Field(default=7.0)
    is_primary: bool = Field(default=True)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# ─── Net worth snapshots ─────────────────────────────────────────────────────

class Snapshot(SQLModel, table=True):
    __tablename__ = "snapshots"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    base_currency: str = Field(default="GBP")

    # Net worth in base currency
    total_base: float = Field(default=0.0)

    # FX metadata for transparency
    fx_as_of: Optional[str] = Field(default=None)  # ISO YYYY-MM-DD
    excluded_accounts: int = Field(default=0)

    # Optional breakdown for /snapshots page
    breakdown_json: str = Field(default="[]")

    def get_breakdown(self) -> list[dict[str, Any]]:
        return json.loads(self.breakdown_json)