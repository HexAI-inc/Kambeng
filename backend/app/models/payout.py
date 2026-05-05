from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.database import Base

class Payout(Base):
    __tablename__ = "payouts"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"))
    
    # HexAI details
    client_reference = Column(String, unique=True, index=True) # e.g., OUT-12345
    
    # Fee Breakdown fields (NEW)
    gross_amount = Column(Float)  # The total requested withdrawal before fees
    hexai_fee = Column(Float, default=0.0)  # HexAI 1% fee
    platform_commission = Column(Float, default=0.0)  # Platform fixed commission (D10)
    net_amount = Column(Float)  # The actual amount sent to user (gross - hexai_fee - platform_commission)
    
    # Legacy compatibility field (will be deprecated)
    amount = Column(Float, nullable=True)  # The net amount sent to the user (after your 2% fee)
    
    status = Column(String, default="PENDING") # PENDING, SUCCEEDED, FAILED
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    campaign = relationship("Campaign", back_populates="payouts")