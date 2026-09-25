from sqlalchemy import Boolean, Column, Integer, String, Float, ForeignKey, DateTime, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.database import Base
import enum

class CampaignMode(str, enum.Enum):
    TARGET = "TARGET"
    ONGOING = "ONGOING"

class CampaignStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    CLOSED = "CLOSED"
    SUSPENDED = "SUSPENDED" # Admin can suspend fraudulent campaigns

# Predefined campaign categories. Display labels live in the frontend
# (src/lib/campaign-categories.ts) — keep the two lists in sync.
CAMPAIGN_CATEGORIES = (
    "education",
    "health",
    "emergency",
    "community",
    "faith",
    "water",
    "agriculture",
    "environment",
    "business",
    "sports",
    "arts",
    "memorial",
    "other",
)

class CampaignTag(Base):
    """Free-form, organiser-chosen tag on a campaign (lowercased, trimmed)."""
    __tablename__ = "campaign_tags"

    campaign_id = Column(Integer, ForeignKey("campaigns.id", ondelete="CASCADE"), primary_key=True)
    tag = Column(String(32), primary_key=True, index=True)

    campaign = relationship("Campaign", back_populates="tag_links")

class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String, index=True)
    slug = Column(String, unique=True, index=True) # e.g., save-the-school
    description = Column(String)
    
    mode = Column(Enum(CampaignMode), default=CampaignMode.ONGOING)
    target_amount = Column(Float, nullable=True)
    amount_raised = Column(Float, default=0.0)
    
    status = Column(Enum(CampaignStatus), default=CampaignStatus.ACTIVE)

    # Promotions engine — see app/services/promotions.py
    active_promo_id = Column(Integer, ForeignKey("promotions.id"), nullable=True)
    # individual | ngo | diaspora. "ngo" is never self-declared: it is set
    # when the campaign is linked to an organization profile.
    organiser_type = Column(String, default="individual", nullable=False)

    # Who the money is for: self | someone_else | organization
    beneficiary_type = Column(String, default="self", nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    # Ask donors for their graduating class and show a giving-by-class board.
    class_board_enabled = Column(Boolean, default=False, nullable=False)

    qr_code_page_url = Column(String, nullable=True)
    qr_code_direct_url = Column(String, nullable=True)
    cover_image_url = Column(String, nullable=True)
    category = Column(String, nullable=True, index=True)  # one of CAMPAIGN_CATEGORIES

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    owner = relationship("User", back_populates="campaigns")
    # selectin so the organization card/badge is always loaded — async sessions can't lazy-load.
    organization = relationship("Organization", back_populates="campaigns", lazy="selectin")
    donations = relationship("Donation", back_populates="campaign")
    payouts = relationship("Payout", back_populates="campaign")
    reviews = relationship("Review", back_populates="campaign")
    proofs = relationship("Proof", back_populates="campaign")
    goals = relationship("CampaignGoal", back_populates="campaign", cascade="all, delete-orphan")
    recurring_donations = relationship("RecurringDonation", back_populates="campaign")
    updates = relationship("CampaignUpdate", back_populates="campaign", cascade="all, delete-orphan", order_by="CampaignUpdate.created_at.desc()")
    # selectin so `tags` is always loaded — async sessions can't lazy-load.
    tag_links = relationship("CampaignTag", back_populates="campaign", cascade="all, delete-orphan", lazy="selectin", order_by="CampaignTag.tag")

    @property
    def tags(self) -> list[str]:
        return [link.tag for link in self.tag_links]

    @tags.setter
    def tags(self, values: list[str]) -> None:
        existing = {link.tag: link for link in self.tag_links}
        self.tag_links = [existing.get(value) or CampaignTag(tag=value) for value in values]
