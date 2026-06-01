"""add cover_image_url to campaigns and title to campaign_updates

Revision ID: 0d94025f94c1
Revises: bed1c2a3f4e5
Create Date: 2026-06-01 09:16:51.154365

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0d94025f94c1"
down_revision: Union[str, None] = "bed1c2a3f4e5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("campaigns", sa.Column("cover_image_url", sa.String(), nullable=True))

    # Create campaign_updates and update_attachments if they don't exist yet
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    if "campaign_updates" not in existing_tables:
        op.create_table(
            "campaign_updates",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column("campaign_id", sa.Integer(), sa.ForeignKey("campaigns.id"), nullable=False, index=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("title", sa.String(), nullable=True),
            sa.Column("text", sa.String(), nullable=False),
            sa.Column("category", sa.String(), nullable=True),
            sa.Column("amount_spent", sa.Float(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
    else:
        op.add_column("campaign_updates", sa.Column("title", sa.String(), nullable=True))

    if "update_attachments" not in existing_tables:
        op.create_table(
            "update_attachments",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column("update_id", sa.Integer(), sa.ForeignKey("campaign_updates.id"), nullable=False, index=True),
            sa.Column("campaign_id", sa.Integer(), sa.ForeignKey("campaigns.id"), nullable=False, index=True),
            sa.Column("file_url", sa.String(), nullable=False),
            sa.Column("file_name", sa.String(), nullable=True),
            sa.Column("content_type", sa.String(), nullable=True),
            sa.Column("uploaded_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )


def downgrade() -> None:
    op.drop_column("campaigns", "cover_image_url")
    op.drop_column("campaign_updates", "title")
