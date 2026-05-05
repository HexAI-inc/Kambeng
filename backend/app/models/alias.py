from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.database import Base


class CampaignAlias(Base):
    __tablename__ = "campaign_aliases"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False, index=True)
    short_code = Column(String, unique=True, index=True)  # e.g., "abc123"
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    campaign = relationship("Campaign")
