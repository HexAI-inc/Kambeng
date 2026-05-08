from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from app.models.kyc import KYCDocumentType, KYCStatus as KYCStatusEnum


class KYCBase(BaseModel):
    document_type: KYCDocumentType


class KYCSubmit(KYCBase):
    pass


class KYCRead(KYCBase):
    id: int
    user_id: int
    document_file_url: str
    status: KYCStatusEnum
    reviewed_by_admin_id: Optional[int] = None
    reviewed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class KYCReview(BaseModel):
    """Admin request to approve or reject KYC submission."""
    approved: bool
    rejection_reason: Optional[str] = None


class KYCStatusResponse(BaseModel):
    """User's current KYC status."""
    status: str
    last_submission_id: Optional[int] = None
    last_submission_date: Optional[datetime] = None
    rejection_reason: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class KYCRejectRequest(BaseModel):
    """Payload for admin rejecting a KYC submission."""
    rejection_reason: str

    model_config = ConfigDict(from_attributes=True)
