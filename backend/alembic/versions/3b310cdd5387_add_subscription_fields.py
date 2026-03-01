"""add subscription fields

Revision ID: 3b310cdd5387
Revises: 7c30e4897718
Create Date: 2026-03-01 11:53:47.820933
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic
revision: str = '3b310cdd5387'
down_revision: Union[str, None] = '7c30e4897718'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.add_column("settings", sa.Column("subscription_status", sa.String(), nullable=True))
    op.add_column("settings", sa.Column("trial_end_iso", sa.String(), nullable=True))

def downgrade():
    op.drop_column("settings", "trial_end_iso")
    op.drop_column("settings", "subscription_status")
