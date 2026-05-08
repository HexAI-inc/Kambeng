from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class CommissionSourceItem(BaseModel):
    """Individual commission source (campaign payout)."""
    payout_id: int
    campaign_id: int
    campaign_title: str
    user_id: int
    user_name: str
    gross_amount: float
    platform_commission: float
    status: str
    created_at: datetime


class CommissionSummary(BaseModel):
    """Overall commission/revenue summary for admin."""
    total_commissions: float  # Total platform commissions across all payouts
    withdrawn_commissions: float  # Already paid out to admin
    pending_commissions: float  # In-progress or pending payouts
    available_commissions: float  # Ready to withdraw (total - withdrawn - pending)
    commission_count: int  # Number of payout records with commissions
    last_updated: datetime


class AdminCommissionWithdrawalRequest(BaseModel):
    """Request to withdraw platform commissions."""
    amount: float
    recipient_mobile: Optional[str] = None  # Optional: if admin wants it to their own account
    reason: Optional[str] = None


class AdminCommissionWithdrawalResponse(BaseModel):
    """Response after commission withdrawal request."""
    withdrawal_id: str  # Payout reference or withdrawal ID
    amount: float
    status: str
    created_at: datetime
    message: str
