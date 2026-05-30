from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


def _normalize_email(email: str) -> str:
    return email.strip().lower()


class KYCNotificationEmailBase(BaseModel):
    email: str = Field(..., min_length=3)
    is_active: bool = True


class KYCNotificationEmailCreate(KYCNotificationEmailBase):
    pass


class KYCNotificationEmailUpdate(BaseModel):
    email: str | None = Field(default=None, min_length=3)
    is_active: bool | None = None


class KYCNotificationEmailRead(KYCNotificationEmailBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
