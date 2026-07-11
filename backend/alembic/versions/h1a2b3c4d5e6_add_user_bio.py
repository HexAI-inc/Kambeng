"""add user bio column for public profiles

Revision ID: h1a2b3c4d5e6
Revises: 0d94025f94c1
Create Date: 2026-07-11
"""
from alembic import op
import sqlalchemy as sa

revision = "h1a2b3c4d5e6"
down_revision = "0d94025f94c1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("bio", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "bio")
