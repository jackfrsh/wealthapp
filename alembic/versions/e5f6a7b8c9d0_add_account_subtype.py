"""add account_subtype column

Revision ID: e5f6a7b8c9d0
Revises: f1a2b3c4d5e6
Create Date: 2026-05-29

"""
from alembic import op
import sqlalchemy as sa

revision = "e5f6a7b8c9d0"
down_revision = "f1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "accounts",
        sa.Column("account_subtype", sa.String, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("accounts", "account_subtype")
