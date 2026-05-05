from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Enum as SAEnum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.database import Base
import enum


class Proof(Base):
    __tablename__ = "proofs"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), index=True)
    file_url = Column(String, nullable=False)
    description = Column(String, nullable=True)
    
    class ProofType(str, enum.Enum):
        STUDENT_ID = "STUDENT_ID"
        UTG_PORTAL = "UTG_PORTAL"
        TRANSCRIPT = "TRANSCRIPT"
        TUITION_RECEIPT = "TUITION_RECEIPT"
        OTHER = "OTHER"

    document_type = Column(SAEnum(ProofType), nullable=False, default=ProofType.OTHER)

    class VisibilityType(str, enum.Enum):
        PUBLIC = "PUBLIC"
        DONOR_ONLY = "DONOR_ONLY"
        ADMIN_ONLY = "ADMIN_ONLY"

    visibility = Column(SAEnum(VisibilityType), nullable=False, default=VisibilityType.ADMIN_ONLY)
    uploaded_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    campaign = relationship("Campaign", back_populates="proofs")
