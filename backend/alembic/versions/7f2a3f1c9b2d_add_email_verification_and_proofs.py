"""Add email verification lifecycle fields and proofs table

Revision ID: 7f2a3f1c9b2d
Revises: 508da24d6b99
Create Date: 2026-04-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "7f2a3f1c9b2d"
down_revision: Union[str, None] = "508da24d6b99"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("email_verification_code", sa.String(length=6), nullable=True))
    op.add_column("users", sa.Column("email_verification_expires_at", sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        "proofs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("campaign_id", sa.Integer(), nullable=True),
        sa.Column("file_url", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("uploaded_by_user_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["campaign_id"], ["campaigns.id"]),
        sa.ForeignKeyConstraint(["uploaded_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_proofs_id"), "proofs", ["id"], unique=False)
    op.create_index(op.f("ix_proofs_campaign_id"), "proofs", ["campaign_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_proofs_campaign_id"), table_name="proofs")
    op.drop_index(op.f("ix_proofs_id"), table_name="proofs")
    op.drop_table("proofs")

    op.drop_column("users", "email_verification_expires_at")
    op.drop_column("users", "email_verification_code")
