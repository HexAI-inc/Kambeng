import enum

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.database import Base


class PromoType(str, enum.Enum):
    CAMPAIGN_FEE_WAIVER = "campaign_fee_waiver"
    MILESTONE_COMPLETION_REBATE = "milestone_completion_rebate"
    TRANSPARENCY_REBATE = "transparency_rebate"
    DONOR_FEE_FREE_DAY = "donor_fee_free_day"
    MATCHED_DONATION = "matched_donation"
    FIRST_DONATION_BONUS = "first_donation_bonus"
    ORGANISER_REFERRAL = "organiser_referral"
    NGO_ONBOARDING = "ngo_onboarding"
    DIASPORA_FIRST_DONATION = "diaspora_first_donation"


# Promo types that are naturally self-limiting (a single reward grant / a
# single onboarding waiver) and so are exempt from the "ends_at required"
# guardrail — see app/services/promotions.py validate_promo_window.
SELF_LIMITING_TYPES = {PromoType.ORGANISER_REFERRAL, PromoType.NGO_ONBOARDING}

# Types resolved at withdrawal time against campaigns.active_promo_id (or,
# for referral/ngo, against ad-hoc eligibility) — see resolve_withdrawal_fee_waiver.
WITHDRAWAL_TIME_TYPES = {
    PromoType.CAMPAIGN_FEE_WAIVER,
    PromoType.MILESTONE_COMPLETION_REBATE,
    PromoType.TRANSPARENCY_REBATE,
    PromoType.NGO_ONBOARDING,
    PromoType.ORGANISER_REFERRAL,
}

# Types resolved at donation-reconciliation time — see apply_donation_promos.
DONATION_TIME_TYPES = {
    PromoType.DONOR_FEE_FREE_DAY,
    PromoType.MATCHED_DONATION,
    PromoType.FIRST_DONATION_BONUS,
    PromoType.DIASPORA_FIRST_DONATION,
}


class Promotion(Base):
    """A named, configurable promo rule. Every promotion — current or
    future — is a row here, not a code deployment (see docs)."""

    __tablename__ = "promotions"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    promo_type = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=True)

    fee_waiver_pct = Column(Float, nullable=True)  # 0-100
    rebate_pct = Column(Float, nullable=True)  # 0-100

    match_pool_total = Column(Float, nullable=True)
    match_pool_remaining = Column(Float, nullable=True)
    match_ratio = Column(Float, nullable=True)

    max_campaigns = Column(Integer, nullable=True)
    campaigns_used = Column(Integer, nullable=False, default=0)

    category_filter = Column(String, nullable=True)
    requires_first_donation = Column(Boolean, nullable=False, default=False)
    requires_organiser_type = Column(String, nullable=True)

    starts_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    ends_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)

    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    applications = relationship("PromoApplication", back_populates="promotion", cascade="all, delete-orphan")


class PromoApplication(Base):
    """Audit trail: every time a promotion actually waived or rebated a fee.
    Source of truth for promo cost reporting (fee_waived_amount = CAC)."""

    __tablename__ = "promo_applications"

    id = Column(Integer, primary_key=True, index=True)
    promotion_id = Column(Integer, ForeignKey("promotions.id"), nullable=False, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=True, index=True)
    donation_id = Column(Integer, ForeignKey("donations.id"), nullable=True, index=True)
    payout_id = Column(Integer, ForeignKey("payouts.id"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    fee_waived_amount = Column(Float, nullable=False, default=0.0)
    match_contributed_amount = Column(Float, nullable=True)

    # Set true when the underlying donation/payout is later reversed —
    # excluded from cost reporting without deleting the audit row (§7.4).
    reversed = Column(Boolean, nullable=False, default=False)

    applied_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    promotion = relationship("Promotion", back_populates="applications")
    campaign = relationship("Campaign")
    donation = relationship("Donation", foreign_keys=[donation_id])
    payout = relationship("Payout", foreign_keys=[payout_id])
    user = relationship("User")
