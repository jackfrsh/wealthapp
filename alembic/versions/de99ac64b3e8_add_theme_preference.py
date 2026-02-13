"""add theme preference

Revision ID: de99ac64b3e8
Revises: b54aae24ad35
Create Date: 2026-02-13 17:03:05.846854

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'de99ac64b3e8'
down_revision: Union[str, Sequence[str], None] = 'b54aae24ad35'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
