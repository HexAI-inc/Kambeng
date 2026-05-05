"""Create admin audit log table for sensitive action tracking

Revision ID: d7a4b2e5f1c8
Revises: c6f1d9a2e4b5
Create Date: 2026-04-06 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d7a4b2e5f1c8"
down_revision: Union[str, None] = "c6f1d9a2e4b5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create admin_audit_logs table
    op.create_table(
        "admin_audit_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("action_type", sa.String(), nullable=False),
        sa.Column("performed_by_admin_id", sa.Integer(), nullable=False),
        sa.Column("target_entity_type", sa.String(), nullable=False),
        sa.Column("target_entity_id", sa.Integer(), nullable=False),
        sa.Column("campaign_id", sa.Integer(), nullable=True),
        sa.Column("target_user_id", sa.Integer(), nullable=True),
        sa.Column("description", sa.String(), nullable=False),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("old_value", sa.Text(), nullable=True),
        sa.Column("new_value", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["performed_by_admin_id"], ["users.id"], ),
        sa.ForeignKeyConstraint(["campaign_id"], ["campaigns.id"], ),
        sa.ForeignKeyConstraint(["target_user_id"], ["users.id"], ),
        sa.PrimaryKeyConstraint("id")
    )
    op.create_index(op.f("ix_admin_audit_logs_action_type"), "admin_audit_logs", ["action_type"], unique=False)
    op.create_index(op.f("ix_admin_audit_logs_performed_by_admin_id"), "admin_audit_logs", ["performed_by_admin_id"], unique=False)
    op.create_index(op.f("ix_admin_audit_logs_target_entity_id"), "admin_audit_logs", ["target_entity_id"], unique=False)
    op.create_index(op.f("ix_admin_audit_logs_campaign_id"), "admin_audit_logs", ["campaign_id"], unique=False)
    op.create_index(op.f("ix_admin_audit_logs_created_at"), "admin_audit_logs", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_admin_audit_logs_created_at"), table_name="admin_audit_logs")
    op.drop_index(op.f("ix_admin_audit_logs_campaign_id"), table_name="admin_audit_logs")
    op.drop_index(op.f("ix_admin_audit_logs_target_entity_id"), table_name="admin_audit_logs")
    op.drop_index(op.f("ix_admin_audit_logs_performed_by_admin_id"), table_name="admin_audit_logs")
    op.drop_index(op.f("ix_admin_audit_logs_action_type"), table_name="admin_audit_logs")
    op.drop_table("admin_audit_logs")
