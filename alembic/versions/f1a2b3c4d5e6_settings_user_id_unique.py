"""add unique constraint to settings.user_id

Revision ID: f1a2b3c4d5e6
Revises: c3a1f8e92d01
Create Date: 2026-02-19
"""
from alembic import op
import sqlalchemy as sa

revision = "f1a2b3c4d5e6"
down_revision = "c3a1f8e92d01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Dedupe: keep lowest id per user_id, delete the rest
    conn = op.get_bind()
    conn.execute(sa.text(
        "DELETE FROM settings WHERE id NOT IN ("
        "  SELECT MIN(id) FROM settings GROUP BY user_id"
        ")"
    ))
    # Create unique index (works on both SQLite and PostgreSQL)
    op.create_index("uq_settings_user_id", "settings", ["user_id"], unique=True)


def downgrade() -> None:
    op.drop_index("uq_settings_user_id", table_name="settings")
