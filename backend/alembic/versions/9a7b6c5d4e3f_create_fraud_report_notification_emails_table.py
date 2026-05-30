"""Create fraud report notification emails table and merge heads

Revision ID: 9a7b6c5d4e3f
Revises: c1d2e3f4a5b6, d4c3b2a1f0e9
Create Date: 2026-05-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9a7b6c5d4e3f"
down_revision: Union[str, tuple[str, str], None] = ("c1d2e3f4a5b6", "d4c3b2a1f0e9")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "fraud_report_notification_emails",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index(op.f("ix_fraud_report_notification_emails_id"), "fraud_report_notification_emails", ["id"], unique=False)
    op.create_index(op.f("ix_fraud_report_notification_emails_email"), "fraud_report_notification_emails", ["email"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_fraud_report_notification_emails_email"), table_name="fraud_report_notification_emails")
    op.drop_index(op.f("ix_fraud_report_notification_emails_id"), table_name="fraud_report_notification_emails")
    op.drop_table("fraud_report_notification_emails")