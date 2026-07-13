from sqlalchemy import Column, Integer, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.database import Base


class CampaignSubscription(Base):
    """A user following a campaign to receive its updates by email."""

    __tablename__ = "campaign_subscriptions"
    __table_args__ = (UniqueConstraint("user_id", "campaign_id", name="uq_subscription_user_campaign"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User")
    campaign = relationship("Campaign")
