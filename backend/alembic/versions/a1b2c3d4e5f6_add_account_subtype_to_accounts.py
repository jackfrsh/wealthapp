"""add account_subtype to accounts

Adds accounts.account_subtype (VARCHAR, nullable).

Production already has this column from a manual ALTER TABLE, so the upgrade
is idempotent: it checks for the column's existence before adding it.  When
deployed, Alembic runs the migration, sees the column is already present,
skips the ADD COLUMN, and stamps the new revision — no data is touched.

Revision ID: a1b2c3d4e5f6
Revises: c9d2e3f4a5b6
Create Date: 2026-05-30 19:30:52.384156
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "c9d2e3f4a5b6"
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

    if not _column_exists(conn, "accounts", "account_subtype"):
        op.add_column(
            "accounts",
            sa.Column("account_subtype", sa.String(), nullable=True),
        )


def downgrade() -> None:
    conn = op.get_bind()

    if _column_exists(conn, "accounts", "account_subtype"):
        op.drop_column("accounts", "account_subtype")
