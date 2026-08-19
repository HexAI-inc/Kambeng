"""add donation provider + APS gateway tokens (transaction_id, request_token)

Revision ID: l5e6f7a8b9c0
Revises: k4d5e6f7a8b9
Create Date: 2026-08-19
"""
from alembic import op
import sqlalchemy as sa

revision = "l5e6f7a8b9c0"
down_revision = "k4d5e6f7a8b9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("donations", sa.Column("provider", sa.String(), nullable=True))
    op.add_column("donations", sa.Column("gateway_transaction_id", sa.String(), nullable=True))
    op.add_column("donations", sa.Column("gateway_request_token", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("donations", "gateway_request_token")
    op.drop_column("donations", "gateway_transaction_id")
    op.drop_column("donations", "provider")
