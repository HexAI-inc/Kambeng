"""Add reconciliation metadata for donations and ledger

Revision ID: a1c7e5d9f3b4
Revises: f9d3c1a7e4b2
Create Date: 2026-04-16 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1c7e5d9f3b4"
down_revision: Union[str, None] = "f9d3c1a7e4b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("donations", sa.Column("reconciliation_source", sa.String(), nullable=True))
    op.add_column("donations", sa.Column("reconciliation_reason", sa.Text(), nullable=True))
    op.add_column("donations", sa.Column("reconciled_by_admin_id", sa.Integer(), nullable=True))
    op.add_column("donations", sa.Column("reconciled_at", sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key(
        "fk_donations_reconciled_by_admin_id_users",
        "donations",
        "users",
        ["reconciled_by_admin_id"],
        ["id"],
    )
    op.create_index(op.f("ix_donations_reconciliation_source"), "donations", ["reconciliation_source"], unique=False)
    op.create_index(op.f("ix_donations_reconciled_by_admin_id"), "donations", ["reconciled_by_admin_id"], unique=False)

    op.add_column("transaction_ledgers", sa.Column("reconciliation_source", sa.String(), nullable=True))
    op.add_column("transaction_ledgers", sa.Column("reconciliation_reason", sa.Text(), nullable=True))
    op.add_column("transaction_ledgers", sa.Column("reconciled_by_admin_id", sa.Integer(), nullable=True))
    op.add_column("transaction_ledgers", sa.Column("reconciled_at", sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key(
        "fk_transaction_ledgers_reconciled_by_admin_id_users",
        "transaction_ledgers",
        "users",
        ["reconciled_by_admin_id"],
        ["id"],
    )
    op.create_index(
        op.f("ix_transaction_ledgers_reconciliation_source"),
        "transaction_ledgers",
        ["reconciliation_source"],
        unique=False,
    )
    op.create_index(
        op.f("ix_transaction_ledgers_reconciled_by_admin_id"),
        "transaction_ledgers",
        ["reconciled_by_admin_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_transaction_ledgers_reconciled_by_admin_id"), table_name="transaction_ledgers")
    op.drop_index(op.f("ix_transaction_ledgers_reconciliation_source"), table_name="transaction_ledgers")
    op.drop_constraint("fk_transaction_ledgers_reconciled_by_admin_id_users", "transaction_ledgers", type_="foreignkey")
    op.drop_column("transaction_ledgers", "reconciled_at")
    op.drop_column("transaction_ledgers", "reconciled_by_admin_id")
    op.drop_column("transaction_ledgers", "reconciliation_reason")
    op.drop_column("transaction_ledgers", "reconciliation_source")

    op.drop_index(op.f("ix_donations_reconciled_by_admin_id"), table_name="donations")
    op.drop_index(op.f("ix_donations_reconciliation_source"), table_name="donations")
    op.drop_constraint("fk_donations_reconciled_by_admin_id_users", "donations", type_="foreignkey")
    op.drop_column("donations", "reconciled_at")
    op.drop_column("donations", "reconciled_by_admin_id")
    op.drop_column("donations", "reconciliation_reason")
    op.drop_column("donations", "reconciliation_source")
