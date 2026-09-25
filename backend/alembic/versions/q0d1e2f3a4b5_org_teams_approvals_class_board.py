"""organization teams, two-person withdrawal approval, class board, payout audit

Revision ID: q0d1e2f3a4b5
Revises: p9c0d1e2f3a4
Create Date: 2026-09-25
"""
from alembic import op
import sqlalchemy as sa

revision = "q0d1e2f3a4b5"
down_revision = "p9c0d1e2f3a4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("organizations", sa.Column("approval_threshold", sa.Float(), nullable=True))

    op.create_table(
        "organization_members",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("status", sa.String(), server_default="INVITED", nullable=False),
        sa.Column("invited_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("organization_id", "user_id", name="uq_organization_members_org_user"),
    )
    op.create_index("ix_organization_members_id", "organization_members", ["id"])
    op.create_index("ix_organization_members_organization_id", "organization_members", ["organization_id"])
    op.create_index("ix_organization_members_user_id", "organization_members", ["user_id"])

    op.create_table(
        "withdrawal_requests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("campaign_id", sa.Integer(), sa.ForeignKey("campaigns.id"), nullable=False),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("requested_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", sa.String(), server_default="PENDING", nullable=False),
        sa.Column("decided_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("note", sa.String(), nullable=True),
        sa.Column("payout_id", sa.Integer(), sa.ForeignKey("payouts.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_withdrawal_requests_id", "withdrawal_requests", ["id"])
    op.create_index("ix_withdrawal_requests_campaign_id", "withdrawal_requests", ["campaign_id"])
    op.create_index("ix_withdrawal_requests_organization_id", "withdrawal_requests", ["organization_id"])
    op.create_index("ix_withdrawal_requests_status", "withdrawal_requests", ["status"])

    op.add_column("payouts", sa.Column("recipient_wave_number", sa.String(), nullable=True))
    op.add_column("payouts", sa.Column("requested_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True))
    op.add_column("payouts", sa.Column("approved_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True))
    op.add_column("payouts", sa.Column("receipt_reminder_sent_at", sa.DateTime(timezone=True), nullable=True))

    op.add_column("campaigns", sa.Column("class_board_enabled", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.add_column("donations", sa.Column("graduating_class", sa.Integer(), nullable=True))
    op.create_index("ix_donations_graduating_class", "donations", ["graduating_class"])


def downgrade() -> None:
    op.drop_index("ix_donations_graduating_class", table_name="donations")
    op.drop_column("donations", "graduating_class")
    op.drop_column("campaigns", "class_board_enabled")

    op.drop_column("payouts", "receipt_reminder_sent_at")
    op.drop_column("payouts", "approved_by_user_id")
    op.drop_column("payouts", "requested_by_user_id")
    op.drop_column("payouts", "recipient_wave_number")

    op.drop_index("ix_withdrawal_requests_status", table_name="withdrawal_requests")
    op.drop_index("ix_withdrawal_requests_organization_id", table_name="withdrawal_requests")
    op.drop_index("ix_withdrawal_requests_campaign_id", table_name="withdrawal_requests")
    op.drop_index("ix_withdrawal_requests_id", table_name="withdrawal_requests")
    op.drop_table("withdrawal_requests")

    op.drop_index("ix_organization_members_user_id", table_name="organization_members")
    op.drop_index("ix_organization_members_organization_id", table_name="organization_members")
    op.drop_index("ix_organization_members_id", table_name="organization_members")
    op.drop_table("organization_members")

    op.drop_column("organizations", "approval_threshold")
