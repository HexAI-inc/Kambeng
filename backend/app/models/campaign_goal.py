from sqlalchemy import Column, Integer, String, Float, ForeignKey, Date, DateTime, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.database import Base
import enum


class GoalStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"


class CampaignGoal(Base):
    __tablename__ = "campaign_goals"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), index=True, nullable=False)
    title = Column(String, nullable=False, index=True)
    description = Column(String, nullable=True)
    target_amount = Column(Float, nullable=False)
    amount_raised = Column(Float, nullable=False, default=0.0)
    due_date = Column(Date, nullable=True)
    status = Column(Enum(GoalStatus), nullable=False, default=GoalStatus.DRAFT)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    campaign = relationship("Campaign", back_populates="goals")
    donations = relationship("Donation", back_populates="goal")