"""add payouts.gateway_transaction_id + reversed_at (needed for /payouts/{id}/reverse)

Revision ID: n7a8b9c0d1e2
Revises: m6f7a8b9c0d1
Create Date: 2026-08-19
"""
from alembic import op
import sqlalchemy as sa

revision = "n7a8b9c0d1e2"
down_revision = "m6f7a8b9c0d1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("payouts", sa.Column("gateway_transaction_id", sa.String(), nullable=True))
    op.add_column("payouts", sa.Column("reversed_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("payouts", "reversed_at")
    op.drop_column("payouts", "gateway_transaction_id")
