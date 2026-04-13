"""SQLModel models for Wealth App.

This repo uses Postgres + SQLModel with Alembic as the canonical migration tool.
database.ensure_schema() calls create_all() as a safety net for tables not yet covered by a migration.
Never add schema mutations outside of Alembic migration files.

FX rates are stored as: 1 BASE = X QUOTE.
Example: base GBP, USD=1.366 means 1 GBP = 1.366 USD.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Optional

from sqlmodel import SQLModel, Field

# ─── Stripe webhook idempotency ─────────────────────────────────────────────

class StripeEvent(SQLModel, table=True):
    __tablename__ = "stripe_events"

    id: str = Field(primary_key=True)  # evt_...
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ─── Analytics Events (GDPR-friendly, no cookies) ────────────────────────────

class AnalyticsEvent(SQLModel, table=True):
    __tablename__ = "analytics_events"

    id: Optional[int] = Field(default=None, primary_key=True)

    # Account-linked analytics (no cookies)
    user_id: int = Field(foreign_key="users.id", index=True)

    # Controlled event name (validated in API layer)
    name: str = Field(index=True)

    # Small JSON blob for non-sensitive metadata (page, etc.)
    meta_json: str = Field(default="{}")

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    def get_meta(self) -> dict[str, Any]:
        try:
            return json.loads(self.meta_json or "{}")
        except Exception:
            return {}
            
# ─── Users ───────────────────────────────────────────────────────────────────

class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    supabase_user_id: Optional[str] = Field(default=None, index=True)

    # Stripe (nullable; added for Pro billing)
    stripe_customer_id: Optional[str] = Field(default=None, index=True)
    stripe_subscription_id: Optional[str] = Field(default=None, index=True)

    # Apple (nullable; durable key for a user's Apple subscription lifecycle)
    # The iOS app must set appAccountToken = supabase_user_id on purchase so
    # server notifications can resolve back to this user without a sync call.
    apple_original_transaction_id: Optional[str] = Field(default=None, index=True)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ─── Settings ────────────────────────────────────────────────────────────────

class Settings(SQLModel, table=True):
    __tablename__ = "settings"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True, unique=True)
    base_currency: str = Field(default="GBP")
    goal: float = Field(default=0.0)
    theme_preference: str = Field(default="system")  # "system" | "dark" | "light"
    is_pro: bool = Field(default=False)

    # Cached Stripe subscription data (updated by billing sync/webhook only — never hits Stripe on read)
    subscription_status: Optional[str] = Field(default=None)   # active | trialing | past_due | canceled | null
    trial_end_iso: Optional[str] = Field(default=None)         # ISO 8601 datetime or null

    # Apple subscription status (updated by /billing/apple/sync and /billing/apple/notifications)
    # Values: active | grace | expired | revoked | null
    # "grace" = Apple billing grace period — user retains access temporarily while payment retries
    apple_subscription_status: Optional[str] = Field(default=None)


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

    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ─── FX Rate Cache ───────────────────────────────────────────────────────────

class FxRateCache(SQLModel, table=True):
    __tablename__ = "fx_rate_cache"

    id: Optional[int] = Field(default=None, primary_key=True)
    cache_date: str  # ISO YYYY-MM-DD
    base_currency: str
    rates_json: str  # JSON dict: {"USD": 1.27, ...}
    fetched_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ─── Projection scenarios ────────────────────────────────────────────────────

class ProjectionScenario(SQLModel, table=True):
    __tablename__ = "projection_scenarios"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)

    name: str = Field(index=True)
    monthly_contribution: float = Field(default=0.0)
    expected_annual_return_pct: float = Field(default=7.0)
    notes: Optional[str] = Field(default=None)
    sort_order: int = Field(default=0)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))    


# ─── Net worth snapshots ─────────────────────────────────────────────────────

class Snapshot(SQLModel, table=True):
    __tablename__ = "snapshots"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
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


# ─── Apple IAP: verified transactions ────────────────────────────────────────

class AppleTransaction(SQLModel, table=True):
    """
    One row per unique Apple transactionId.
    Idempotent on insert: callers should check by transaction_id before inserting.
    originalTransactionId is the durable subscription key across renewals.
    """
    __tablename__ = "apple_transactions"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)

    transaction_id: str = Field(index=True, unique=True)
    original_transaction_id: str = Field(index=True)
    product_id: str = Field(default="")
    app_account_token: Optional[str] = Field(default=None, index=True)

    purchase_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_date: Optional[datetime] = Field(default=None)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ─── Apple IAP: server notification audit log ─────────────────────────────────

class AppleNotification(SQLModel, table=True):
    """
    Append-only audit log of all Apple Server Notification v2 events received.
    notification_uuid provides idempotency: duplicate UUIDs are dropped.
    No signed payloads or raw JWS are stored — only decoded metadata.
    """
    __tablename__ = "apple_notifications"

    id: Optional[int] = Field(default=None, primary_key=True)

    notification_uuid: str = Field(index=True, unique=True)
    notification_type: str = Field(index=True)        # e.g. SUBSCRIBED, EXPIRED
    subtype: Optional[str] = Field(default=None)      # e.g. BILLING_RECOVERY, GRACE_PERIOD
    original_transaction_id: Optional[str] = Field(default=None, index=True)
    app_account_token: Optional[str] = Field(default=None, index=True)

    # Decoded, non-sensitive metadata (no JWS/signed payloads)
    event_json: str = Field(default="{}")

    processed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))