from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.sql import func

from app.db.database import Base


class CampaignBalanceAdjustment(Base):
    """Money Kambeng puts into (or takes out of) a campaign's withdrawable
    balance without it being raised — e.g. writing off an overdraft against
    platform commissions. It never touches amount_raised, so the public total
    keeps showing only what donors gave."""

    __tablename__ = "campaign_balance_adjustments"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False, index=True)
    # Positive adds to the campaign's balance.
    amount = Column(Float, nullable=False)
    # Where the money comes from: COMMISSIONS (Kambeng's earned commissions).
    funded_by = Column(String, nullable=False, default="COMMISSIONS")
    reason = Column(String, nullable=False)
    created_by_admin_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
