"""donor features: donation-account link, campaign subscriptions, account purpose

Revision ID: i2b3c4d5e6f7
Revises: h1a2b3c4d5e6
Create Date: 2026-07-13
"""
from alembic import op
import sqlalchemy as sa

revision = "i2b3c4d5e6f7"
down_revision = "h1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("donations", sa.Column("user_id", sa.Integer(), nullable=True))
    op.create_index("ix_donations_user_id", "donations", ["user_id"])
    op.create_foreign_key("fk_donations_user_id", "donations", "users", ["user_id"], ["id"])

    op.add_column("users", sa.Column("account_purpose", sa.String(), nullable=True))

    op.create_table(
        "campaign_subscriptions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("campaign_id", sa.Integer(), sa.ForeignKey("campaigns.id"), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "campaign_id", name="uq_subscription_user_campaign"),
    )


def downgrade() -> None:
    op.drop_table("campaign_subscriptions")
    op.drop_column("users", "account_purpose")
    op.drop_constraint("fk_donations_user_id", "donations", type_="foreignkey")
    op.drop_index("ix_donations_user_id", table_name="donations")
    op.drop_column("donations", "user_id")
