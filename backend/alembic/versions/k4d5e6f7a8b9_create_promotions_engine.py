"""promotions engine: promotions, promo_applications, referrals, campaign_share_clicks

Revision ID: k4d5e6f7a8b9
Revises: j3c4d5e6f7a8
Create Date: 2026-08-19
"""
from alembic import op
import sqlalchemy as sa

revision = "k4d5e6f7a8b9"
down_revision = "j3c4d5e6f7a8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "promotions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("slug", sa.String(), nullable=False, unique=True, index=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("promo_type", sa.String(), nullable=False, index=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("fee_waiver_pct", sa.Float(), nullable=True),
        sa.Column("rebate_pct", sa.Float(), nullable=True),
        sa.Column("match_pool_total", sa.Float(), nullable=True),
        sa.Column("match_pool_remaining", sa.Float(), nullable=True),
        sa.Column("match_ratio", sa.Float(), nullable=True),
        sa.Column("max_campaigns", sa.Integer(), nullable=True),
        sa.Column("campaigns_used", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("category_filter", sa.String(), nullable=True),
        sa.Column("requires_first_donation", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("requires_organiser_type", sa.String(), nullable=True),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "promo_applications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("promotion_id", sa.Integer(), sa.ForeignKey("promotions.id"), nullable=False, index=True),
        sa.Column("campaign_id", sa.Integer(), sa.ForeignKey("campaigns.id"), nullable=True, index=True),
        sa.Column("donation_id", sa.Integer(), sa.ForeignKey("donations.id"), nullable=True, index=True),
        sa.Column("payout_id", sa.Integer(), sa.ForeignKey("payouts.id"), nullable=True, index=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True, index=True),
        sa.Column("fee_waived_amount", sa.Float(), nullable=False, server_default="0"),
        sa.Column("match_contributed_amount", sa.Float(), nullable=True),
        sa.Column("reversed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("applied_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "referrals",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("referrer_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("referred_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True, index=True),
        sa.Column("referral_code", sa.String(), nullable=False, unique=True, index=True),
        sa.Column("referral_type", sa.String(), nullable=False, server_default="organiser_referral"),
        sa.Column("campaign_id", sa.Integer(), sa.ForeignKey("campaigns.id"), nullable=True, index=True),
        sa.Column("reward_applied", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "campaign_share_clicks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("campaign_id", sa.Integer(), sa.ForeignKey("campaigns.id"), nullable=False, index=True),
        sa.Column("referral_code", sa.String(), nullable=True, index=True),
        sa.Column("resulted_in_donation", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("donation_id", sa.Integer(), sa.ForeignKey("donations.id"), nullable=True),
        sa.Column("clicked_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.add_column("campaigns", sa.Column("active_promo_id", sa.Integer(), sa.ForeignKey("promotions.id"), nullable=True))
    op.add_column("campaigns", sa.Column("organiser_type", sa.String(), nullable=False, server_default="individual"))

    op.add_column("users", sa.Column("referral_code", sa.String(), nullable=True))
    op.create_index("ix_users_referral_code", "users", ["referral_code"], unique=True)
    op.add_column("users", sa.Column("referred_by_code", sa.String(), nullable=True))

    op.add_column("donations", sa.Column("promo_application_id", sa.Integer(), sa.ForeignKey("promo_applications.id"), nullable=True))
    op.add_column("payouts", sa.Column("promo_application_id", sa.Integer(), sa.ForeignKey("promo_applications.id"), nullable=True))


def downgrade() -> None:
    op.drop_column("payouts", "promo_application_id")
    op.drop_column("donations", "promo_application_id")

    op.drop_index("ix_users_referral_code", table_name="users")
    op.drop_column("users", "referred_by_code")
    op.drop_column("users", "referral_code")

    op.drop_column("campaigns", "organiser_type")
    op.drop_column("campaigns", "active_promo_id")

    op.drop_table("campaign_share_clicks")
    op.drop_table("referrals")
    op.drop_table("promo_applications")
    op.drop_table("promotions")
