"""Create recurring_donations table for subscription-based donations

Revision ID: g0e1f2a3b4c5
Revises: f9d3c1a7e4b2
Create Date: 2026-05-04 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "g0e1f2a3b4c5"
down_revision: Union[str, None] = "f9d3c1a7e4b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create recurring_donations table
    op.create_table(
        "recurring_donations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("campaign_id", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("frequency", sa.String(), nullable=False, server_default="MONTHLY"),
        sa.Column("anchor_date", sa.Date(), nullable=False),
        sa.Column("next_charge_date", sa.Date(), nullable=False),
        sa.Column("last_charge_date", sa.Date(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("paused_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancellation_reason", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ),
        sa.ForeignKeyConstraint(["campaign_id"], ["campaigns.id"], ),
        sa.PrimaryKeyConstraint("id")
    )
    op.create_index(op.f("ix_recurring_donations_user_id"), "recurring_donations", ["user_id"], unique=False)
    op.create_index(op.f("ix_recurring_donations_campaign_id"), "recurring_donations", ["campaign_id"], unique=False)
    op.create_index(op.f("ix_recurring_donations_next_charge_date"), "recurring_donations", ["next_charge_date"], unique=False)
    op.create_index(op.f("ix_recurring_donations_is_active"), "recurring_donations", ["is_active"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_recurring_donations_is_active"), table_name="recurring_donations")
    op.drop_index(op.f("ix_recurring_donations_next_charge_date"), table_name="recurring_donations")
    op.drop_index(op.f("ix_recurring_donations_campaign_id"), table_name="recurring_donations")
    op.drop_index(op.f("ix_recurring_donations_user_id"), table_name="recurring_donations")
    op.drop_table("recurring_donations")
