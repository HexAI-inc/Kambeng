"""Create transaction ledger table for financial tracking and reporting

Revision ID: c6f1d9a2e4b5
Revises: b5e3f2a1d8c4
Create Date: 2026-04-06 11:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c6f1d9a2e4b5"
down_revision: Union[str, None] = "b5e3f2a1d8c4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create transaction_ledgers table
    op.create_table(
        "transaction_ledgers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("campaign_id", sa.Integer(), nullable=False),
        sa.Column("transaction_type", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("gross_amount", sa.Float(), nullable=False),
        sa.Column("hexai_fee", sa.Float(), server_default="0.0", nullable=True),
        sa.Column("platform_commission", sa.Float(), server_default="0.0", nullable=True),
        sa.Column("net_amount", sa.Float(), nullable=False),
        sa.Column("external_reference", sa.String(), nullable=True),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["campaign_id"], ["campaigns.id"], ),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ),
        sa.PrimaryKeyConstraint("id")
    )
    op.create_index(op.f("ix_transaction_ledgers_campaign_id"), "transaction_ledgers", ["campaign_id"], unique=False)
    op.create_index(op.f("ix_transaction_ledgers_transaction_type"), "transaction_ledgers", ["transaction_type"], unique=False)
    op.create_index(op.f("ix_transaction_ledgers_status"), "transaction_ledgers", ["status"], unique=False)
    op.create_index(op.f("ix_transaction_ledgers_external_reference"), "transaction_ledgers", ["external_reference"], unique=False)
    op.create_index(op.f("ix_transaction_ledgers_created_at"), "transaction_ledgers", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_transaction_ledgers_created_at"), table_name="transaction_ledgers")
    op.drop_index(op.f("ix_transaction_ledgers_external_reference"), table_name="transaction_ledgers")
    op.drop_index(op.f("ix_transaction_ledgers_status"), table_name="transaction_ledgers")
    op.drop_index(op.f("ix_transaction_ledgers_transaction_type"), table_name="transaction_ledgers")
    op.drop_index(op.f("ix_transaction_ledgers_campaign_id"), table_name="transaction_ledgers")
    op.drop_table("transaction_ledgers")
