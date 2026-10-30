"""campaign balance adjustments and user token version

Revision ID: v5c6d7e8f9a0
Revises: u4b5c6d7e8f9
Create Date: 2026-10-30
"""
from alembic import op
import sqlalchemy as sa

revision = "v5c6d7e8f9a0"
down_revision = "u4b5c6d7e8f9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "campaign_balance_adjustments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("campaign_id", sa.Integer(), sa.ForeignKey("campaigns.id"), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("funded_by", sa.String(), nullable=False, server_default="COMMISSIONS"),
        sa.Column("reason", sa.String(), nullable=False),
        sa.Column("created_by_admin_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_campaign_balance_adjustments_id", "campaign_balance_adjustments", ["id"], unique=False)
    op.create_index("ix_campaign_balance_adjustments_campaign_id", "campaign_balance_adjustments", ["campaign_id"], unique=False)
    op.add_column("users", sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("users", "token_version")
    op.drop_index("ix_campaign_balance_adjustments_campaign_id", table_name="campaign_balance_adjustments")
    op.drop_index("ix_campaign_balance_adjustments_id", table_name="campaign_balance_adjustments")
    op.drop_table("campaign_balance_adjustments")
