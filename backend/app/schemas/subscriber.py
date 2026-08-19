from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.subscriber import SubscriberSource


class SubscribeRequest(BaseModel):
    email: EmailStr
    source: SubscriberSource
    campaign_slug: str | None = None
    name: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, max_length=40)
    fundraising_goal: str | None = Field(default=None, max_length=500)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("name", "phone", "fundraising_goal")
    @classmethod
    def strip_optional(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class SubscribeResponse(BaseModel):
    subscribed: bool
    already_subscribed: bool = False
    message: str


class SubscriberRead(BaseModel):
    id: int
    email: str
    source: str
    campaign_id: int | None
    campaign_title: str | None = None
    name: str | None
    phone: str | None
    fundraising_goal: str | None
    confirmed: bool
    unsubscribed: bool
    sequence_stage: int
    created_at: datetime
    confirmed_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class SubscriberListResponse(BaseModel):
    total: int
    items: list[SubscriberRead]


class MarketingStats(BaseModel):
    total: int
    confirmed: int
    unsubscribed: int
    last_7_days: int
    by_source: dict[str, int]
    last_7_days_by_source: dict[str, int]


class BroadcastRequest(BaseModel):
    subject: str = Field(..., min_length=3, max_length=200)
    heading: str = Field(..., min_length=3, max_length=200)
    body: str = Field(..., min_length=10, max_length=10000)
    cta_label: str | None = Field(default=None, max_length=80)
    cta_url: str | None = Field(default=None, max_length=500)
    # Restrict the audience to specific sources; empty/None = whole list.
    sources: list[SubscriberSource] | None = None
    test_recipient: EmailStr | None = None  # when set, send ONLY to this address


class BroadcastResponse(BaseModel):
    recipients: int
    sent: int
    failed: int
    test: bool = False
