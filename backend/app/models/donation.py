from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.database import Base

class Donation(Base):
    __tablename__ = "donations"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"))
    goal_id = Column(Integer, ForeignKey("campaign_goals.id"), nullable=True, index=True)
    # Set when the donor was logged in — powers "my donations" history.
    # Anonymous quick-pay donations keep this NULL.
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    
    # HexAI details
    client_reference = Column(String, unique=True, index=True) # e.g., DON-12345
    amount = Column(Float)
    status = Column(String, default="PENDING") # PENDING, SUCCEEDED, FAILED
    
    # Optional donor details
    donor_name = Column(String, nullable=True, default="Anonymous")
    message = Column(String, nullable=True)
    # Required by the gateway for Waychit Card and APS (identity/KYC step on
    # their side) — not required for Wave, which has no such requirement.
    donor_email = Column(String, nullable=True)

    # Gateway rail used (wave | waychit_card | aps), and — for APS's two-step
    # OTP flow only — the gateway's transaction_id + request_token captured
    # from the /collections/initiate response so /collections/{id}/confirm
    # can be called once the donor submits the OTP they were texted.
    provider = Column(String, nullable=True)
    gateway_transaction_id = Column(String, nullable=True)
    gateway_request_token = Column(String, nullable=True)

    # Promotions engine — set if a donor-side promo (fee-free day, first
    # donation bonus, matched donation, diaspora) applied to this donation.
    # use_alter breaks the donations<->promo_applications FK cycle (each
    # table's PK is referenced by a column on the other) so create/drop
    # ordering resolves cleanly.
    promo_application_id = Column(
        Integer,
        ForeignKey("promo_applications.id", use_alter=True, name="fk_donations_promo_application_id"),
        nullable=True,
    )

    # Reconciliation metadata (manual/webhook fallback tracking)
    reconciliation_source = Column(String, nullable=True, index=True)
    reconciliation_reason = Column(Text, nullable=True)
    reconciled_by_admin_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    reconciled_at = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    campaign = relationship("Campaign", back_populates="donations")
    goal = relationship("CampaignGoal", back_populates="donations")