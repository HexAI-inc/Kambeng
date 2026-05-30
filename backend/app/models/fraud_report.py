from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.database import Base


class FraudReport(Base):
    __tablename__ = "fraud_reports"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"))
    reported_by_user_id = Column(Integer, ForeignKey("users.id"))
    reason = Column(String, nullable=False)
    details = Column(Text, nullable=True)
    status = Column(String, default="NEW")  # NEW, REVIEWED, ACTIONED
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    campaign = relationship("Campaign")
    reporter = relationship("User")
