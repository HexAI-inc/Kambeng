"""Create moderation reports table for abuse tracking

Revision ID: f9d3c1a7e4b2
Revises: e8c2a9b6d3f5
Create Date: 2026-04-06 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f9d3c1a7e4b2"
down_revision: Union[str, None] = "e8c2a9b6d3f5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create moderation_reports table
    op.create_table(
        "moderation_reports",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("reported_entity_type", sa.String(), nullable=False),
        sa.Column("reported_entity_id", sa.Integer(), nullable=False),
        sa.Column("campaign_id", sa.Integer(), nullable=True),
        sa.Column("reported_by_user_id", sa.Integer(), nullable=True),
        sa.Column("reason", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("moderation_note", sa.Text(), nullable=True),
        sa.Column("resolved_by_admin_id", sa.Integer(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("action_taken", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["campaign_id"], ["campaigns.id"], ),
        sa.ForeignKeyConstraint(["reported_by_user_id"], ["users.id"], ),
        sa.ForeignKeyConstraint(["resolved_by_admin_id"], ["users.id"], ),
        sa.PrimaryKeyConstraint("id")
    )
    op.create_index(op.f("ix_moderation_reports_reported_entity_type"), "moderation_reports", ["reported_entity_type"], unique=False)
    op.create_index(op.f("ix_moderation_reports_reported_entity_id"), "moderation_reports", ["reported_entity_id"], unique=False)
    op.create_index(op.f("ix_moderation_reports_campaign_id"), "moderation_reports", ["campaign_id"], unique=False)
    op.create_index(op.f("ix_moderation_reports_reason"), "moderation_reports", ["reason"], unique=False)
    op.create_index(op.f("ix_moderation_reports_status"), "moderation_reports", ["status"], unique=False)
    op.create_index(op.f("ix_moderation_reports_created_at"), "moderation_reports", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_moderation_reports_created_at"), table_name="moderation_reports")
    op.drop_index(op.f("ix_moderation_reports_status"), table_name="moderation_reports")
    op.drop_index(op.f("ix_moderation_reports_reason"), table_name="moderation_reports")
    op.drop_index(op.f("ix_moderation_reports_campaign_id"), table_name="moderation_reports")
    op.drop_index(op.f("ix_moderation_reports_reported_entity_id"), table_name="moderation_reports")
    op.drop_index(op.f("ix_moderation_reports_reported_entity_type"), table_name="moderation_reports")
    op.drop_table("moderation_reports")
