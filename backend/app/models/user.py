from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    wave_number = Column(String, unique=True, index=True) # e.g., +220...
    password_hash = Column(String)
    is_email_verified = Column(Boolean, default=False)
    email_verification_code_hash = Column(String, nullable=True)
    email_verification_expires_at = Column(DateTime(timezone=True), nullable=True)
    role = Column(String, default="USER") # USER or ADMIN
    
    # KYC fields for withdrawal eligibility
    kyc_status = Column(String, default="NOT_SUBMITTED", index=True)  # NOT_SUBMITTED, SUBMITTED, REVIEWING, APPROVED, REJECTED
    kyc_verified_at = Column(DateTime(timezone=True), nullable=True)
    kyc_rejection_reason = Column(String, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    campaigns = relationship("Campaign", back_populates="owner")
    kyc_submissions = relationship("KYC", back_populates="user", foreign_keys="KYC.user_id")
    recurring_donations = relationship("RecurringDonation", back_populates="user")