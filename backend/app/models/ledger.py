from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Enum, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.database import Base
import enum


class TransactionType(str, enum.Enum):
    """Types of transactions that can be recorded in the ledger."""
    DONATION = "DONATION"          # Incoming donation to campaign
    WITHDRAWAL = "WITHDRAWAL"      # Outgoing payout from campaign
    REFUND = "REFUND"              # Refund of a donation
    FEE_HEXAI = "FEE_HEXAI"       # HexAI platform fee deduction
    FEE_PLATFORM = "FEE_PLATFORM" # Kambeng platform commission deduction


class TransactionStatus(str, enum.Enum):
    """Status of a transaction."""
    PENDING = "PENDING"      # Transaction initiated but not confirmed
    SUCCEEDED = "SUCCEEDED"  # Transaction completed successfully
    FAILED = "FAILED"        # Transaction failed
    REVERSED = "REVERSED"    # Transaction was reversed/refunded


class TransactionLedger(Base):
    __tablename__ = "transaction_ledgers"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False, index=True)
    
    # Transaction details
    transaction_type = Column(
        Enum(TransactionType, native_enum=False, validate_strings=True),
        nullable=False,
        index=True,
    )
    status = Column(
        Enum(TransactionStatus, native_enum=False, validate_strings=True),
        default=TransactionStatus.PENDING,
        index=True,
    )
    
    # Financial breakdown
    gross_amount = Column(Float, nullable=False)  # Total transaction amount
    hexai_fee = Column(Float, default=0.0)        # HexAI 1% fee (if applicable)
    platform_commission = Column(Float, default=0.0)  # Kambeng fixed D10 commission (if applicable)
    net_amount = Column(Float, nullable=False)    # Actual amount received/sent after fees
    
    # Reference information
    external_reference = Column(String, nullable=True, index=True)  # HexAI or other external ref
    description = Column(String, nullable=True)   # Human-readable description

    # Reconciliation metadata (for webhook/manual donation fallback events)
    reconciliation_source = Column(String, nullable=True, index=True)
    reconciliation_reason = Column(Text, nullable=True)
    reconciled_by_admin_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    reconciled_at = Column(DateTime(timezone=True), nullable=True)
    
    # Actor information
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Who triggered the transaction
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    confirmed_at = Column(DateTime(timezone=True), nullable=True)  # When transaction was confirmed
    
    # Relationships
    campaign = relationship("Campaign", foreign_keys=[campaign_id])
    created_by = relationship("User", foreign_keys=[created_by_user_id])
