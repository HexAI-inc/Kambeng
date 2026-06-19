from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import datetime

class DonationBase(BaseModel):
    amount: float = Field(..., gt=0, description="Donation amount must be greater than 0")
    donor_name: Optional[str] = "Anonymous"
    message: Optional[str] = None

class DonationCreate(DonationBase):
    campaign_id: int
    goal_id: Optional[int] = None

class DonationRead(DonationBase):
    id: int
    campaign_id: int
    goal_id: Optional[int] = None
    client_reference: str # The DON-12345 reference sent to HexAI
    status: str # PENDING, SUCCEEDED, FAILED
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StripePaymentIntentRequest(BaseModel):
    campaign_id: int
    goal_id: Optional[int] = None
    amount: float = Field(..., gt=0)
    donor_name: Optional[str] = "Anonymous"
    message: Optional[str] = None

class StripeConfirmRequest(BaseModel):
    client_reference: str
    payment_intent_id: str

class DonationManualApproveRequest(BaseModel):
    reason: Optional[str] = None


class DonationManualRejectRequest(BaseModel):
    reason: str = Field(..., min_length=2, description="Reason why the payment is being rejected")


class DonationReconciliationResponse(BaseModel):
    client_reference: str
    donation_status: str
    previous_status: str
    idempotent: bool
    source: str
    reason: Optional[str] = None
    reconciled_by_admin_id: Optional[int] = None
    reconciled_at: Optional[datetime] = None