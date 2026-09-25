"""add organizations + org_verifications, link campaigns to organizations

Revision ID: p9c0d1e2f3a4
Revises: o8b9c0d1e2f3
Create Date: 2026-09-24
"""
from alembic import op
import sqlalchemy as sa

revision = "p9c0d1e2f3a4"
down_revision = "o8b9c0d1e2f3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "organizations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("org_type", sa.String(), nullable=False),
        sa.Column("region", sa.String(), nullable=True),
        sa.Column("village", sa.String(), nullable=True),
        sa.Column("logo_url", sa.String(), nullable=True),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("representative_role", sa.String(), nullable=True),
        sa.Column("verification_status", sa.String(), server_default="NOT_SUBMITTED", nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejection_reason", sa.String(), nullable=True),
        sa.Column("payout_wave_number", sa.String(), nullable=True),
        sa.Column("payout_account_holder", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_organizations_id", "organizations", ["id"])
    op.create_index("ix_organizations_owner_user_id", "organizations", ["owner_user_id"])
    op.create_index("ix_organizations_verification_status", "organizations", ["verification_status"])

    op.create_table(
        "org_verifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("submitted_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("evidence_type", sa.String(), nullable=False),
        sa.Column("document_file_url", sa.String(), nullable=False),
        sa.Column("issuer", sa.String(), nullable=True),
        sa.Column("payout_wave_number", sa.String(), nullable=False),
        sa.Column("payout_account_holder", sa.String(), nullable=False),
        sa.Column("status", sa.String(), server_default="SUBMITTED", nullable=False),
        sa.Column("reviewed_by_admin_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejection_reason", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_org_verifications_id", "org_verifications", ["id"])
    op.create_index("ix_org_verifications_organization_id", "org_verifications", ["organization_id"])
    op.create_index("ix_org_verifications_submitted_by_user_id", "org_verifications", ["submitted_by_user_id"])
    op.create_index("ix_org_verifications_status", "org_verifications", ["status"])

    op.add_column("campaigns", sa.Column("beneficiary_type", sa.String(), server_default="self", nullable=False))
    op.add_column("campaigns", sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id"), nullable=True))
    op.create_index("ix_campaigns_organization_id", "campaigns", ["organization_id"])


def downgrade() -> None:
    op.drop_index("ix_campaigns_organization_id", table_name="campaigns")
    op.drop_column("campaigns", "organization_id")
    op.drop_column("campaigns", "beneficiary_type")

    op.drop_index("ix_org_verifications_status", table_name="org_verifications")
    op.drop_index("ix_org_verifications_submitted_by_user_id", table_name="org_verifications")
    op.drop_index("ix_org_verifications_organization_id", table_name="org_verifications")
    op.drop_index("ix_org_verifications_id", table_name="org_verifications")
    op.drop_table("org_verifications")

    op.drop_index("ix_organizations_verification_status", table_name="organizations")
    op.drop_index("ix_organizations_owner_user_id", table_name="organizations")
    op.drop_index("ix_organizations_id", table_name="organizations")
    op.drop_table("organizations")
