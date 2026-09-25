import re
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.organization import (
    OrganizationType,
    OrgEvidenceType,
    OrgVerificationStatus,
    PayoutAccountHolder,
)

_NON_DIGITS = re.compile(r"[^\d]+")


def normalize_wave_number(value: str) -> str:
    """'+220 783 4351', '07834351' and '7834351' all become '+2207834351'."""
    digits = _NON_DIGITS.sub("", value or "")
    if digits.startswith("220") and len(digits) == 10:
        digits = digits[3:]
    digits = digits.lstrip("0")
    if len(digits) != 7:
        raise ValueError("Enter a 7-digit Gambian Wave number, e.g. +220 783 4351")
    return f"+220{digits}"


def _blank_to_none(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = value.strip()
    return value or None


class OrganizationFields(BaseModel):
    region: Optional[str] = Field(default=None, max_length=80)
    village: Optional[str] = Field(default=None, max_length=80)
    description: Optional[str] = Field(default=None, max_length=1000)
    representative_role: Optional[str] = Field(default=None, max_length=60)

    _strip = field_validator("region", "village", "description", "representative_role")(_blank_to_none)


class OrganizationCreate(OrganizationFields):
    name: str = Field(..., min_length=2, max_length=120)
    org_type: OrganizationType

    @field_validator("name")
    @classmethod
    def _strip_name(cls, value: str) -> str:
        return value.strip()


class OrganizationUpdate(OrganizationFields):
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    org_type: Optional[OrganizationType] = None
    # Whole dalasi; send null to turn the two-person rule off.
    approval_threshold: Optional[int] = Field(default=None, ge=0)

    @field_validator("name")
    @classmethod
    def _strip_name(cls, value: Optional[str]) -> Optional[str]:
        return value.strip() if value is not None else None


class OrganizationPublic(BaseModel):
    """What donors see on a campaign page. No payout details."""
    id: int
    name: str
    org_type: OrganizationType
    region: Optional[str] = None
    village: Optional[str] = None
    logo_url: Optional[str] = None
    description: Optional[str] = None
    representative_role: Optional[str] = None
    is_verified: bool = False

    model_config = ConfigDict(from_attributes=True)


class OrgVerificationRead(BaseModel):
    id: int
    organization_id: int
    submitted_by_user_id: int
    evidence_type: OrgEvidenceType
    document_file_url: str
    issuer: Optional[str] = None
    payout_wave_number: str
    payout_account_holder: PayoutAccountHolder
    status: OrgVerificationStatus
    reviewed_by_admin_id: Optional[int] = None
    reviewed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class OrganizationMemberRead(BaseModel):
    id: int
    user_id: int
    full_name: Optional[str] = None
    title: Optional[str] = None
    status: str  # INVITED | ACTIVE
    kyc_verified: bool = False
    accepted_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MemberInvite(BaseModel):
    # Their Kambeng login: Wave number or email.
    identifier: str = Field(..., min_length=3, max_length=120)
    title: Optional[str] = Field(default=None, max_length=60)

    _strip = field_validator("title")(_blank_to_none)


class OrganizationInvitation(BaseModel):
    member_id: int
    organization: OrganizationPublic
    title: Optional[str] = None
    invited_by_name: Optional[str] = None
    created_at: datetime


class OrganizationRead(OrganizationPublic):
    """The team's (and admins') view."""
    owner_user_id: int
    verification_status: OrgVerificationStatus
    verified_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    payout_wave_number: Optional[str] = None
    payout_account_holder: Optional[PayoutAccountHolder] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    latest_verification: Optional[OrgVerificationRead] = None
    approval_threshold: Optional[float] = None
    # OWNER manages team, verification and settings; MANAGER runs campaigns.
    my_role: str = "OWNER"
    owner_name: Optional[str] = None
    members: list[OrganizationMemberRead] = []


class AdminOrgVerificationRead(OrgVerificationRead):
    organization: OrganizationPublic
    organization_verification_status: OrgVerificationStatus
    submitter_name: Optional[str] = None
    submitter_email: Optional[str] = None
    submitter_wave_number: Optional[str] = None
    # The representative's personal KYC — reviewers should see both at once.
    submitter_kyc_status: Optional[str] = None
    campaign_count: int = 0


class OrgVerificationRejectRequest(BaseModel):
    rejection_reason: str = Field(..., min_length=3, max_length=1000)
