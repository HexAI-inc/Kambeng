"""Extend payout table with fee breakdown fields for fee codification

Revision ID: b5e3f2a1d8c4
Revises: a4f2e8d1b3c6
Create Date: 2026-04-06 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b5e3f2a1d8c4"
down_revision: Union[str, None] = "a4f2e8d1b3c6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new fee breakdown columns to payouts table
    op.add_column("payouts", sa.Column("gross_amount", sa.Float(), nullable=True))
    op.add_column("payouts", sa.Column("hexai_fee", sa.Float(), server_default="0.0", nullable=True))
    op.add_column("payouts", sa.Column("platform_commission", sa.Float(), server_default="0.0", nullable=True))
    op.add_column("payouts", sa.Column("net_amount", sa.Float(), nullable=True))
    
    # Make amount column nullable for backward compatibility
    op.alter_column("payouts", "amount", existing_type=sa.Float(), nullable=True)


def downgrade() -> None:
    # Remove fee breakdown columns
    op.drop_column("payouts", "net_amount")
    op.drop_column("payouts", "platform_commission")
    op.drop_column("payouts", "hexai_fee")
    op.drop_column("payouts", "gross_amount")
    
    # Restore amount column NOT NULL constraint
    op.alter_column("payouts", "amount", existing_type=sa.Float(), nullable=False)
