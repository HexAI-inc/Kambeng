from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Enum, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.database import Base
import enum


class ReportEntityType(str, enum.Enum):
    """Types of entities that can be reported."""
    CAMPAIGN = "CAMPAIGN"
    REVIEW = "REVIEW"
    USER = "USER"


class ReportStatus(str, enum.Enum):
    """Status of a moderation report."""
    OPEN = "OPEN"
    REVIEWING = "REVIEWING"
    RESOLVED = "RESOLVED"
    DISMISSED = "DISMISSED"


class ReportReason(str, enum.Enum):
    """Common reasons for reporting."""
    SCAM = "SCAM"
    INAPPROPRIATE_CONTENT = "INAPPROPRIATE_CONTENT"
    HATE_SPEECH = "HATE_SPEECH"
    FALSE_INFORMATION = "FALSE_INFORMATION"
    HARASSMENT = "HARASSMENT"
    SPAM = "SPAM"
    OTHER = "OTHER"


class ModerationReport(Base):
    __tablename__ = "moderation_reports"

    id = Column(Integer, primary_key=True, index=True)
    
    # Report details
    reported_entity_type = Column(Enum(ReportEntityType), nullable=False, index=True)
    reported_entity_id = Column(Integer, nullable=False, index=True)
    
    # Campaign context (for correlation)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=True, index=True)
    
    # Reporter info
    reported_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Nullable for anonymous reports
    
    # Report content
    reason = Column(Enum(ReportReason), nullable=False, index=True)
    description = Column(Text, nullable=False)
    
    # Moderation
    status = Column(Enum(ReportStatus), default=ReportStatus.OPEN, index=True)
    moderation_note = Column(Text, nullable=True)  # Admin notes
    resolved_by_admin_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    
    # Resolution
    action_taken = Column(String, nullable=True)  # "campaign_suspended", "review_deleted", "user_warned", etc.
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    campaign = relationship("Campaign", foreign_keys=[campaign_id])
    reported_by = relationship("User", foreign_keys=[reported_by_user_id])
    resolved_by = relationship("User", foreign_keys=[resolved_by_admin_id])
