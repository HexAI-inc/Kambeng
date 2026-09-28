"""user profile photo and location

Revision ID: r1e2f3a4b5c6
Revises: q0d1e2f3a4b5
Create Date: 2026-09-28
"""
from alembic import op
import sqlalchemy as sa

revision = "r1e2f3a4b5c6"
down_revision = "q0d1e2f3a4b5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_url", sa.String(), nullable=True))
    op.add_column("users", sa.Column("location", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "location")
    op.drop_column("users", "avatar_url")
