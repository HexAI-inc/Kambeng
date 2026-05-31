from datetime import datetime
from typing import List

from pydantic import BaseModel, Field

class PayoutRequest(BaseModel):
    campaign_id: int
    amount: float = Field(..., gt=0, description="The amount you want to withdraw")


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
    amount_raised: float
    total_withdrawn: float
    available_balance: float
    withdrawal_history: List[WithdrawalHistoryItem]