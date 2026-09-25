from datetime import datetime
from typing import List

from pydantic import BaseModel, Field

from app.schemas.money import WholeDalasi

class PayoutRequest(BaseModel):
    campaign_id: int
    amount: WholeDalasi = Field(..., gt=0, description="The amount you want to withdraw, in whole dalasi")


class WithdrawalHistoryItem(BaseModel):
    id: int
    client_reference: str
    gross_amount: float
    hexai_fee: float
    platform_commission: float
    net_amount: float
    status: str
    created_at: datetime


class CampaignWithdrawalSummaryResponse(BaseModel):
    campaign_id: int
    campaign_title: str
    # Where withdrawals go — the organization's declared number for a verified
    # organization campaign, otherwise the owner's own.
    payout_wave_number: str | None = None
    organization_name: str | None = None
    organization_verification_status: str | None = None
    # Set when the organization isn't verified yet (personal KYC is separate).
    withdrawal_blocked_reason: str | None = None
    # Two-person rule: withdrawals above this need a second manager.
    approval_threshold: float | None = None
    # Spending accountability — withdrawn vs. shown with receipts.
    spent_accounted_for: float = 0.0
    spent_unaccounted: float = 0.0
    amount_raised: float
    total_withdrawn: float
    available_balance: float
    withdrawal_history: List[WithdrawalHistoryItem]

class WithdrawalRequestRead(BaseModel):
    """A withdrawal above an organization's approval threshold."""
    id: int
    campaign_id: int
    amount: float
    status: str  # PENDING | APPROVED | REJECTED | CANCELLED | FAILED
    requested_by_user_id: int
    requested_by_name: str | None = None
    decided_by_name: str | None = None
    decided_at: datetime | None = None
    note: str | None = None
    payout_id: int | None = None
    created_at: datetime
    # For the viewer: another manager may approve; the requester may cancel.
    can_approve: bool = False
    can_cancel: bool = False


class WithdrawalRequestDecision(BaseModel):
    note: str | None = Field(default=None, max_length=500)
