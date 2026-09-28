from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON
from sqlalchemy.sql import false, func
from sqlalchemy.orm import relationship
from app.db.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, index=True)
    bio = Column(String, nullable=True)  # public organizer bio shown on profile pages
    avatar_url = Column(String, nullable=True)  # public profile photo
    location = Column(String, nullable=True)  # free text, e.g. "Serekunda, KMC"
    cover_url = Column(String, nullable=True)  # public profile banner
    handle = Column(String(30), unique=True, nullable=True, index=True)  # kambeng.gm/@handle, stored lowercase
    favorite_causes = Column(JSON, nullable=True)  # up to 3 campaign category slugs
    social_links = Column(JSON, nullable=True)  # {"website": url, "facebook": url, ...}
    # Opt-in: list campaigns this user gave to (under their own name) on their public profile
    show_supported_campaigns = Column(Boolean, default=False, server_default=false(), nullable=False)
    email = Column(String, unique=True, index=True)
    wave_number = Column(String, unique=True, index=True) # e.g., +220...
    password_hash = Column(String)
    is_email_verified = Column(Boolean, default=False)
    email_verification_code_hash = Column(String, nullable=True)
    email_verification_expires_at = Column(DateTime(timezone=True), nullable=True)
    role = Column(String, default="USER") # USER or ADMIN
    # Persona preference (not a permission): DONATE or FUNDRAISE. Tailors the
    # default dashboard experience; users can do everything either way.
    account_purpose = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    # Referral program — see app/services/promotions.py
    referral_code = Column(String, unique=True, nullable=True, index=True)
    referred_by_code = Column(String, nullable=True)

    # KYC fields for withdrawal eligibility
    kyc_status = Column(String, default="NOT_SUBMITTED", index=True)  # NOT_SUBMITTED, SUBMITTED, REVIEWING, APPROVED, REJECTED
    kyc_verified_at = Column(DateTime(timezone=True), nullable=True)
    kyc_rejection_reason = Column(String, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    campaigns = relationship("Campaign", back_populates="owner")
    kyc_submissions = relationship("KYC", back_populates="user", foreign_keys="KYC.user_id")
    recurring_donations = relationship("RecurringDonation", back_populates="user")