from pydantic import BaseModel, ConfigDict, Field

from app.schemas.money import DonationAmount
from typing import Optional
from datetime import datetime, date
from enum import Enum


class FrequencyEnum(str, Enum):
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"
    QUARTERLY = "QUARTERLY"
    ANNUAL = "ANNUAL"


class RecurringDonationBase(BaseModel):
    amount: float = Field(..., gt=0, description="Donation amount must be greater than 0")
    frequency: FrequencyEnum = FrequencyEnum.MONTHLY
    anchor_date: Optional[date] = None  # If None, defaults to today


class RecurringDonationCreate(RecurringDonationBase):
    # Whole dalasi only — overridden here so RecurringDonationRead stays
    # permissive for plans created before the rule.
    amount: DonationAmount = Field(..., gt=0, description="Donation amount in whole dalasi, at least the platform minimum")
    campaign_id: int


class RecurringDonationUpdate(BaseModel):
    amount: Optional[DonationAmount] = Field(None, gt=0)
    frequency: Optional[FrequencyEnum] = None
    is_active: Optional[bool] = None


class RecurringDonationRead(RecurringDonationBase):
    id: int
    user_id: int
    campaign_id: int
    next_charge_date: date
    last_charge_date: Optional[date] = None
    is_active: bool
    cancelled_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RecurringDonationListResponse(BaseModel):
    total: int
    recurring_donations: list[RecurringDonationRead]
