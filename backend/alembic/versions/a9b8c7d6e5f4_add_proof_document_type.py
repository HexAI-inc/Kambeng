"""Add document_type column to proofs

Revision ID: a9b8c7d6e5f4
Revises: g0e1f2a3b4c5
Create Date: 2026-05-05 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a9b8c7d6e5f4"
down_revision: Union[str, None] = "g0e1f2a3b4c5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # create enum type for document_type
    proof_doc_type = sa.Enum(
        "STUDENT_ID",
        "UTG_PORTAL",
        "TRANSCRIPT",
        "TUITION_RECEIPT",
        "OTHER",
        name="proof_document_type",
    )
    proof_doc_type.create(op.get_bind(), checkfirst=True)

    # add column with default OTHER for existing rows
    op.add_column(
        "proofs",
        sa.Column("document_type", proof_doc_type, nullable=False, server_default=sa.text("'OTHER'")),
    )
    op.create_index(op.f("ix_proofs_document_type"), "proofs", ["document_type"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_proofs_document_type"), table_name="proofs")
    op.drop_column("proofs", "document_type")

    proof_doc_type = sa.Enum(name="proof_document_type")
    proof_doc_type.drop(op.get_bind(), checkfirst=True)
