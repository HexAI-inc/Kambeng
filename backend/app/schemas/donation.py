from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator
from typing import Literal, Optional
from datetime import datetime

# Gateway-supported rails for /collections/initiate (see HPG API reference).
DonationProvider = Literal["wave", "waychit_card", "aps"]

# Waychit Card and APS both require a customer_email on the gateway's side
# (an identity/KYC step) — confirmed for Waychit via its explicit error
# ("Waychit card sessions require a customer email"), and inferred for APS
# from its generic "authorize-customer ... Validation errors" response,
# since neither field was documented in HPG's public API reference. Wave
# has run without it since before this change, so it's left optional there.
PROVIDERS_REQUIRING_EMAIL = {"waychit_card", "aps"}

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
    # Required for provider in {"aps", "waychit_card"} — see note above.
    customer_email: Optional[EmailStr] = None

    @field_validator("provider")
    @classmethod
    def normalize_provider(cls, value: str | None) -> str | None:
        return value.lower() if value else None

    @model_validator(mode="after")
    def require_mobile_for_aps(self) -> "DonationCreate":
        if self.provider == "aps" and not (self.customer_mobile or "").strip():
            raise ValueError("customer_mobile is required for APS donations")
        return self

    @model_validator(mode="after")
    def require_email_for_card_and_aps(self) -> "DonationCreate":
        if self.provider in PROVIDERS_REQUIRING_EMAIL and not self.customer_email:
            raise ValueError(f"customer_email is required for {self.provider} donations")
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