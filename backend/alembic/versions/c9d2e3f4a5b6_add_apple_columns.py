"""add apple subscription columns

Adds settings.apple_subscription_status and users.apple_original_transaction_id,
which were previously only added by the in-code _migrate_columns path.
This migration is idempotent: it checks column existence before adding.

Revision ID: c9d2e3f4a5b6
Revises: af53748b5dc7
Create Date: 2026-04-12 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c9d2e3f4a5b6"
down_revision: Union[str, None] = "af53748b5dc7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(conn, table: str, column: str) -> bool:
    result = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = :t AND column_name = :c"
        ),
        {"t": table, "c": column},
    )
    return result.fetchone() is not None


def upgrade() -> None:
    conn = op.get_bind()

    if not _column_exists(conn, "settings", "apple_subscription_status"):
        op.add_column(
            "settings",
            sa.Column("apple_subscription_status", sa.String(), nullable=True),
        )

    if not _column_exists(conn, "users", "apple_original_transaction_id"):
        op.add_column(
            "users",
            sa.Column("apple_original_transaction_id", sa.String(), nullable=True),
        )
        op.create_index(
            "ix_users_apple_original_transaction_id",
            "users",
            ["apple_original_transaction_id"],
            unique=False,
        )


def downgrade() -> None:
    conn = op.get_bind()

    if _column_exists(conn, "users", "apple_original_transaction_id"):
        op.drop_index("ix_users_apple_original_transaction_id", table_name="users")
        op.drop_column("users", "apple_original_transaction_id")

    if _column_exists(conn, "settings", "apple_subscription_status"):
        op.drop_column("settings", "apple_subscription_status")
