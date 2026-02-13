"""add theme_preference to settings

Revision ID: a1b2c3d4e5f6
Revises: 556668b6236e
Create Date: 2026-02-13 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '556668b6236e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use batch mode for SQLite compatibility
    with op.batch_alter_table('settings', schema=None) as batch_op:
        batch_op.add_column(sa.Column('theme_preference', sa.String(), server_default='system', nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('settings', schema=None) as batch_op:
        batch_op.drop_column('theme_preference')
