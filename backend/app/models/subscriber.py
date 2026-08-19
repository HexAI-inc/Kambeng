import enum

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.database import Base


class SubscriberSource(str, enum.Enum):
    HOMEPAGE = "homepage"
    CAMPAIGN_FOLLOW = "campaign_follow"
    POST_DONATION = "post_donation"
    WAITLIST = "waitlist"
    GUIDE = "guide"


# Sources whose subscribers receive the donor welcome sequence vs the
# organiser waitlist sequence (see app/services/marketing_sequence_service.py).
DONOR_SOURCES = {SubscriberSource.HOMEPAGE, SubscriberSource.CAMPAIGN_FOLLOW, SubscriberSource.POST_DONATION}
ORGANISER_SOURCES = {SubscriberSource.WAITLIST, SubscriberSource.GUIDE}


class Subscriber(Base):
    """A marketing email subscriber captured from one of the on-platform
    capture points (homepage opt-in, campaign follow, post-donation,
    organiser waitlist, lead-magnet guide)."""

    __tablename__ = "subscribers"
    __table_args__ = (
        UniqueConstraint("email", "source", "campaign_id", name="uq_subscriber_email_source_campaign"),
    )

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, nullable=False, index=True)
    source = Column(String, nullable=False, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=True, index=True)

    # Waitlist / guide extras
    name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    fundraising_goal = Column(String, nullable=True)  # "What do you want to raise funds for?"

    confirm_token = Column(String, unique=True, nullable=False, index=True)
    unsubscribe_token = Column(String, unique=True, nullable=False, index=True)
    confirmed = Column(Boolean, default=False, nullable=False)
    unsubscribed = Column(Boolean, default=False, nullable=False)

    # Index of the next nurture-sequence email to send (0 = none sent yet).
    sequence_stage = Column(Integer, default=0, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    confirmed_at = Column(DateTime(timezone=True), nullable=True)
    unsubscribed_at = Column(DateTime(timezone=True), nullable=True)

    campaign = relationship("Campaign")
