from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.database import Base

class Donation(Base):
    __tablename__ = "donations"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"))
    goal_id = Column(Integer, ForeignKey("campaign_goals.id"), nullable=True, index=True)
    
    # HexAI details
    client_reference = Column(String, unique=True, index=True) # e.g., DON-12345
    amount = Column(Float)
    status = Column(String, default="PENDING") # PENDING, SUCCEEDED, FAILED
    
    # Optional donor details
    donor_name = Column(String, nullable=True, default="Anonymous")
    message = Column(String, nullable=True)

    # Reconciliation metadata (manual/webhook fallback tracking)
    reconciliation_source = Column(String, nullable=True, index=True)
    reconciliation_reason = Column(Text, nullable=True)
    reconciled_by_admin_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    reconciled_at = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    campaign = relationship("Campaign", back_populates="donations")
    goal = relationship("CampaignGoal", back_populates="donations")