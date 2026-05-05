from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.campaign_goal import GoalStatus


class CampaignGoalBase(BaseModel):
    title: str
    description: Optional[str] = None
    target_amount: float = Field(..., gt=0)
    due_date: Optional[date] = None
    sort_order: int = 0
    status: GoalStatus = GoalStatus.DRAFT


class CampaignGoalCreate(CampaignGoalBase):
    pass


class CampaignGoalUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    target_amount: Optional[float] = Field(default=None, gt=0)
    due_date: Optional[date] = None
    sort_order: Optional[int] = None
    status: Optional[GoalStatus] = None


class CampaignGoalRead(CampaignGoalBase):
    id: int
    campaign_id: int
    amount_raised: float
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)