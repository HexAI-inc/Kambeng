from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Date, Boolean, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.database import Base


class RecurringDonation(Base):
    __tablename__ = "recurring_donations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), index=True)
    
    # Donation details
    amount = Column(Float)
    frequency = Column(String, default="MONTHLY")  # WEEKLY, MONTHLY, QUARTERLY, ANNUAL
    
    # Charge scheduling
    anchor_date = Column(Date)  # Original setup date; used to calculate next charge
    next_charge_date = Column(Date, index=True)
    last_charge_date = Column(Date, nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True, index=True)
    paused_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    cancellation_reason = Column(String, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="recurring_donations")
    campaign = relationship("Campaign", back_populates="recurring_donations")
