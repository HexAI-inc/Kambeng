"""profile cover photo, social links, supported-campaigns opt-in, organizer follows

Revision ID: s2f3a4b5c6d7
Revises: r1e2f3a4b5c6
Create Date: 2026-09-28
"""
from alembic import op
import sqlalchemy as sa

revision = "s2f3a4b5c6d7"
down_revision = "r1e2f3a4b5c6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("cover_url", sa.String(), nullable=True))
    op.add_column("users", sa.Column("social_links", sa.JSON(), nullable=True))
    op.add_column("users", sa.Column("show_supported_campaigns", sa.Boolean(), server_default=sa.false(), nullable=False))

    op.create_table(
        "user_follows",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("follower_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("followed_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("follower_id", "followed_id", name="uq_user_follows_pair"),
        sa.CheckConstraint("follower_id <> followed_id", name="ck_user_follows_not_self"),
    )
    op.create_index("ix_user_follows_follower_id", "user_follows", ["follower_id"])
    op.create_index("ix_user_follows_followed_id", "user_follows", ["followed_id"])


def downgrade() -> None:
    op.drop_index("ix_user_follows_followed_id", table_name="user_follows")
    op.drop_index("ix_user_follows_follower_id", table_name="user_follows")
    op.drop_table("user_follows")
    op.drop_column("users", "show_supported_campaigns")
    op.drop_column("users", "social_links")
    op.drop_column("users", "cover_url")
