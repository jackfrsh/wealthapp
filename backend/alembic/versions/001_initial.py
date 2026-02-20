"""initial schema — all tables

Revision ID: 001_initial
Revises:
Create Date: 2025-01-01 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("username", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("password_hash", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index(op.f("ix_users_username"), "users", ["username"], unique=True)

    op.create_table(
        "settings",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("base_currency", sqlmodel.sql.sqltypes.AutoString(), nullable=False, server_default="GBP"),
        sa.Column("goal", sa.Float(), nullable=False, server_default="0.0"),
    )
    op.create_index(op.f("ix_settings_user_id"), "settings", ["user_id"])

    op.create_table(
        "accounts",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("type", sqlmodel.sql.sqltypes.AutoString(), nullable=False, server_default="bank"),
        sa.Column("currency", sqlmodel.sql.sqltypes.AutoString(), nullable=False, server_default="GBP"),
        sa.Column("balance", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("include_in_net_worth", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("notes", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("monthly_contribution", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("annual_interest_rate_percent", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index(op.f("ix_accounts_user_id"), "accounts", ["user_id"])

    op.create_table(
        "fx_rate_cache",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("cache_date", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("base_currency", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("rates_json", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("fetched_at", sa.DateTime(), nullable=False),
    )

    op.create_table(
        "snapshots",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("base_currency", sqlmodel.sql.sqltypes.AutoString(), nullable=False, server_default="GBP"),
        sa.Column("total_base", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("fx_as_of", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("excluded_accounts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("breakdown_json", sqlmodel.sql.sqltypes.AutoString(), nullable=False, server_default="[]"),
    )
    op.create_index(op.f("ix_snapshots_user_id"), "snapshots", ["user_id"])


def downgrade() -> None:
    op.drop_table("snapshots")
    op.drop_table("fx_rate_cache")
    op.drop_table("accounts")
    op.drop_table("settings")
    op.drop_table("users")
