from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Enum
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
    
    qr_code_page_url = Column(String, nullable=True)
    qr_code_direct_url = Column(String, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    owner = relationship("User", back_populates="campaigns")
    donations = relationship("Donation", back_populates="campaign")
    payouts = relationship("Payout", back_populates="campaign")
    reviews = relationship("Review", back_populates="campaign")
    proofs = relationship("Proof", back_populates="campaign")
    goals = relationship("CampaignGoal", back_populates="campaign", cascade="all, delete-orphan")
    recurring_donations = relationship("RecurringDonation", back_populates="campaign")