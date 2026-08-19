"""add donations.donor_email — required by HPG for Waychit Card + APS

Revision ID: m6f7a8b9c0d1
Revises: l5e6f7a8b9c0
Create Date: 2026-08-19
"""
from alembic import op
import sqlalchemy as sa

revision = "m6f7a8b9c0d1"
down_revision = "l5e6f7a8b9c0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("donations", sa.Column("donor_email", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("donations", "donor_email")
