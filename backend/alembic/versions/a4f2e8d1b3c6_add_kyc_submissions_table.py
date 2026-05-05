"""Add KYC submissions table and kyc status columns to users

Revision ID: a4f2e8d1b3c6
Revises: 0b71f7d8e2aa
Create Date: 2026-04-06 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a4f2e8d1b3c6"
down_revision: Union[str, None] = "0b71f7d8e2aa"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add KYC status columns to users table
    op.add_column("users", sa.Column("kyc_status", sa.String(), server_default="NOT_SUBMITTED", nullable=False))
    op.add_column("users", sa.Column("kyc_verified_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("kyc_rejection_reason", sa.String(), nullable=True))
    op.create_index(op.f("ix_users_kyc_status"), "users", ["kyc_status"], unique=False)
    
    # Create kyc_submissions table
    op.create_table(
        "kyc_submissions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("document_type", sa.String(), nullable=False),
        sa.Column("document_file_url", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("reviewed_by_admin_id", sa.Integer(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejection_reason", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ),
        sa.ForeignKeyConstraint(["reviewed_by_admin_id"], ["users.id"], ),
        sa.PrimaryKeyConstraint("id")
    )
    op.create_index(op.f("ix_kyc_submissions_user_id"), "kyc_submissions", ["user_id"], unique=False)
    op.create_index(op.f("ix_kyc_submissions_status"), "kyc_submissions", ["status"], unique=False)


def downgrade() -> None:
    # Drop kyc_submissions table
    op.drop_index(op.f("ix_kyc_submissions_status"), table_name="kyc_submissions")
    op.drop_index(op.f("ix_kyc_submissions_user_id"), table_name="kyc_submissions")
    op.drop_table("kyc_submissions")
    
    # Remove KYC status columns from users table
    op.drop_index(op.f("ix_users_kyc_status"), table_name="users")
    op.drop_column("users", "kyc_rejection_reason")
    op.drop_column("users", "kyc_verified_at")
    op.drop_column("users", "kyc_status")
