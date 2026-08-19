from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from typing import Literal, Optional
from datetime import datetime

# Gateway-supported rails for /collections/initiate (see HPG API reference).
DonationProvider = Literal["wave", "waychit_card", "aps"]

class DonationBase(BaseModel):
    amount: float = Field(..., gt=0, description="Donation amount must be greater than 0")
    donor_name: Optional[str] = "Anonymous"
    message: Optional[str] = None

class DonationCreate(DonationBase):
    campaign_id: int
    goal_id: Optional[int] = None
    provider: Optional[DonationProvider] = None
    # Required only for provider="aps" — APS texts the OTP to this number.
    customer_mobile: Optional[str] = Field(default=None, max_length=20)

    @field_validator("provider")
    @classmethod
    def normalize_provider(cls, value: str | None) -> str | None:
        return value.lower() if value else None

    @model_validator(mode="after")
    def require_mobile_for_aps(self) -> "DonationCreate":
        if self.provider == "aps" and not (self.customer_mobile or "").strip():
            raise ValueError("customer_mobile is required for APS donations")
        return self


class ApsConfirmRequest(BaseModel):
    client_reference: str
    otp: str = Field(..., min_length=4, max_length=10)


class ApsConfirmResponse(BaseModel):
    status: str  # SUCCEEDED | FAILED
    client_reference: str

class DonationRead(DonationBase):
    id: int
    campaign_id: int
    goal_id: Optional[int] = None
    client_reference: str # The DON-12345 reference sent to HexAI
    status: str # PENDING, SUCCEEDED, FAILED
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


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