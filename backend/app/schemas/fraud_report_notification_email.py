from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


def _normalize_email(email: str) -> str:
    return email.strip().lower()


class FraudReportNotificationEmailBase(BaseModel):
    email: str = Field(..., min_length=3)
    is_active: bool = True


class FraudReportNotificationEmailCreate(FraudReportNotificationEmailBase):
    pass


class FraudReportNotificationEmailUpdate(BaseModel):
    email: str | None = Field(default=None, min_length=3)
    is_active: bool | None = None


class FraudReportNotificationEmailRead(FraudReportNotificationEmailBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)