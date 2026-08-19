import enum

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.database import Base


class ReferralType(str, enum.Enum):
    ORGANISER_REFERRAL = "organiser_referral"
    CAMPAIGN_SHARE = "campaign_share"


class Referral(Base):
    """An organiser referral (via ?ref= at signup) or a donor campaign-share
    link. Reward is granted once the referred user's campaign goes live."""

    __tablename__ = "referrals"

    id = Column(Integer, primary_key=True, index=True)
    referrer_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    referred_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    referral_code = Column(String, unique=True, nullable=False, index=True)
    referral_type = Column(String, nullable=False, default=ReferralType.ORGANISER_REFERRAL.value)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=True, index=True)
    reward_applied = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    referrer = relationship("User", foreign_keys=[referrer_user_id])
    referred = relationship("User", foreign_keys=[referred_user_id])
    campaign = relationship("Campaign")


class CampaignShareClick(Base):
    """Click tracking for personal campaign share links — powers the
    'Campaign Champion' badge and donation attribution (30-day, last-click)."""

    __tablename__ = "campaign_share_clicks"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False, index=True)
    referral_code = Column(String, nullable=True, index=True)
    resulted_in_donation = Column(Boolean, nullable=False, default=False)
    donation_id = Column(Integer, ForeignKey("donations.id"), nullable=True)
    clicked_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    campaign = relationship("Campaign")
    donation = relationship("Donation")
