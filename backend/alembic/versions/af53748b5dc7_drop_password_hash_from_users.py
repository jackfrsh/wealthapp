"""drop password_hash from users

Revision ID: af53748b5dc7
Revises: 3b310cdd5387
Create Date: 2026-03-01 12:25:15.201179
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic
revision: str = 'af53748b5dc7'
down_revision = "3b310cdd5387"  # IMPORTANT: make sure this matches your latest migration
branch_labels = None
depends_on = None


def upgrade():
    op.drop_column("users", "password_hash")


def downgrade():
    op.add_column(
        "users",
        sa.Column("password_hash", sa.String(), nullable=False),
    )