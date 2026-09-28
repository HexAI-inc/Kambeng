"""create fraud_reports table

The FraudReport model shipped without a migration, so the table only existed
where it was made by create_all (tests, local SQLite). Production never had it,
which broke the admin growth report and campaign fraud reporting.

Revision ID: u4b5c6d7e8f9
Revises: t3a4b5c6d7e8
Create Date: 2026-09-28
"""
from alembic import op
import sqlalchemy as sa

revision = "u4b5c6d7e8f9"
down_revision = "t3a4b5c6d7e8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "fraud_reports",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("campaign_id", sa.Integer(), sa.ForeignKey("campaigns.id"), nullable=True),
        sa.Column("reported_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("reason", sa.String(), nullable=False),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
    )
    op.create_index("ix_fraud_reports_id", "fraud_reports", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_fraud_reports_id", table_name="fraud_reports")
    op.drop_table("fraud_reports")
