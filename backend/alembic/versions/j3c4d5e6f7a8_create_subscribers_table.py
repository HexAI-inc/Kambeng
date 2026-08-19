"""marketing module: subscribers table for email capture + nurture sequences

Revision ID: j3c4d5e6f7a8
Revises: i2b3c4d5e6f7
Create Date: 2026-07-20
"""
from alembic import op
import sqlalchemy as sa

revision = "j3c4d5e6f7a8"
down_revision = "i2b3c4d5e6f7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "subscribers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(), nullable=False, index=True),
        sa.Column("source", sa.String(), nullable=False, index=True),
        sa.Column("campaign_id", sa.Integer(), sa.ForeignKey("campaigns.id"), nullable=True, index=True),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("phone", sa.String(), nullable=True),
        sa.Column("fundraising_goal", sa.String(), nullable=True),
        sa.Column("confirm_token", sa.String(), nullable=False, unique=True, index=True),
        sa.Column("unsubscribe_token", sa.String(), nullable=False, unique=True, index=True),
        sa.Column("confirmed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("unsubscribed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("sequence_stage", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("unsubscribed_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("email", "source", "campaign_id", name="uq_subscriber_email_source_campaign"),
    )


def downgrade() -> None:
    op.drop_table("subscribers")
