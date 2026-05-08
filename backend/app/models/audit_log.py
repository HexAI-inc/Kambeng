from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.database import Base
import enum


class AuditActionType(str, enum.Enum):
    """Types of sensitive actions that are audited."""
    KYC_APPROVED = "KYC_APPROVED"
    KYC_REJECTED = "KYC_REJECTED"
    CAMPAIGN_SUSPENDED = "CAMPAIGN_SUSPENDED"
    CAMPAIGN_REACTIVATED = "CAMPAIGN_REACTIVATED"
    REVIEW_DELETED = "REVIEW_DELETED"
    USER_DISABLED = "USER_DISABLED"
    USER_ENABLED = "USER_ENABLED"
    PAYOUT_MANUAL_OVERRIDE = "PAYOUT_MANUAL_OVERRIDE"
    PAYOUT_REVERSED = "PAYOUT_REVERSED"
    FEE_OVERRIDE = "FEE_OVERRIDE"
    DONATION_MANUAL_APPROVED = "DONATION_MANUAL_APPROVED"
    DONATION_MANUAL_REJECTED = "DONATION_MANUAL_REJECTED"
    COMMISSION_WITHDRAWAL_INITIATED = "COMMISSION_WITHDRAWAL_INITIATED"
    COMMISSIONS_VIEWED = "COMMISSIONS_VIEWED"


class AdminAuditLog(Base):
    __tablename__ = "admin_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    
    # Action details
    action_type = Column(String, nullable=False, index=True)
    performed_by_admin_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Target entity
    target_entity_type = Column(String, nullable=False)  # e.g., "KYC", "Campaign", "Review", "User"
    target_entity_id = Column(Integer, nullable=False, index=True)
    
    # Campaign context (optional - for correlation)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=True, index=True)
    
    # User context (optional - target user for user-related actions)
    target_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    
    # Details
    description = Column(String, nullable=False)
    details = Column(Text, nullable=True)  # JSON or text with additional metadata
    
    # Change tracking
    old_value = Column(Text, nullable=True)  # Previous value for updates
    new_value = Column(Text, nullable=True)  # New value for updates
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # Relationships
    performed_by = relationship("User", foreign_keys=[performed_by_admin_id])
    campaign = relationship("Campaign", foreign_keys=[campaign_id])
    target_user = relationship("User", foreign_keys=[target_user_id])
