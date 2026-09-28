"""profile handle (custom URL) and favourite causes

Revision ID: t3a4b5c6d7e8
Revises: s2f3a4b5c6d7
Create Date: 2026-09-28
"""
from alembic import op
import sqlalchemy as sa

revision = "t3a4b5c6d7e8"
down_revision = "s2f3a4b5c6d7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("handle", sa.String(length=30), nullable=True))
    op.create_index("ix_users_handle", "users", ["handle"], unique=True)
    op.add_column("users", sa.Column("favorite_causes", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "favorite_causes")
    op.drop_index("ix_users_handle", table_name="users")
    op.drop_column("users", "handle")
