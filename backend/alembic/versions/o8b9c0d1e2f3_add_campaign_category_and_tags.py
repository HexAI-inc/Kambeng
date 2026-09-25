"""add campaigns.category + campaign_tags table

Revision ID: o8b9c0d1e2f3
Revises: n7a8b9c0d1e2
Create Date: 2026-09-23
"""
from alembic import op
import sqlalchemy as sa

revision = "o8b9c0d1e2f3"
down_revision = "n7a8b9c0d1e2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("campaigns", sa.Column("category", sa.String(), nullable=True))
    op.create_index("ix_campaigns_category", "campaigns", ["category"])

    op.create_table(
        "campaign_tags",
        sa.Column("campaign_id", sa.Integer(), sa.ForeignKey("campaigns.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("tag", sa.String(length=32), primary_key=True),
    )
    op.create_index("ix_campaign_tags_tag", "campaign_tags", ["tag"])


def downgrade() -> None:
    op.drop_index("ix_campaign_tags_tag", table_name="campaign_tags")
    op.drop_table("campaign_tags")
    op.drop_index("ix_campaigns_category", table_name="campaigns")
    op.drop_column("campaigns", "category")
