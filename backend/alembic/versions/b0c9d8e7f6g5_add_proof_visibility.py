"""Add visibility column to proofs

Revision ID: b0c9d8e7f6g5
Revises: a9b8c7d6e5f4
Create Date: 2026-05-05 12:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b0c9d8e7f6g5"
down_revision: Union[str, None] = "a9b8c7d6e5f4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # create enum type for visibility
    proof_visibility_type = sa.Enum(
        "PUBLIC",
        "DONOR_ONLY",
        "ADMIN_ONLY",
        name="proof_visibility_type",
    )
    proof_visibility_type.create(op.get_bind(), checkfirst=True)

    # add column with default ADMIN_ONLY for existing rows
    op.add_column(
        "proofs",
        sa.Column("visibility", proof_visibility_type, nullable=False, server_default=sa.text("'ADMIN_ONLY'")),
    )
    op.create_index(op.f("ix_proofs_visibility"), "proofs", ["visibility"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_proofs_visibility"), table_name="proofs")
    op.drop_column("proofs", "visibility")

    proof_visibility_type = sa.Enum(name="proof_visibility_type")
    proof_visibility_type.drop(op.get_bind(), checkfirst=True)
