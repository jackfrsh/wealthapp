"""add goals table

Revision ID: c3a1f8e92d01
Revises: de99ac64b3e8
Create Date: 2025-02-13
"""
from alembic import op
import sqlalchemy as sa

revision = "c3a1f8e92d01"
down_revision = "de99ac64b3e8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "goals",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("goal_type", sa.String, nullable=False, server_default="retirement"),
        sa.Column("name", sa.String, nullable=False, server_default="Retirement"),
        sa.Column("target_amount", sa.Float, nullable=False, server_default="0"),
        sa.Column("current_age", sa.Integer, nullable=False, server_default="30"),
        sa.Column("target_age", sa.Integer, nullable=False, server_default="60"),
        sa.Column("monthly_contribution", sa.Float, nullable=False, server_default="0"),
        sa.Column("expected_annual_return_pct", sa.Float, nullable=False, server_default="7"),
        sa.Column("is_primary", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("goals")
