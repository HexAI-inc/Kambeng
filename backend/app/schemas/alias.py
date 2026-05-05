from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime


class CampaignAliasCreate(BaseModel):
    short_code: Optional[str] = None  # If auto-generate short code, leave None


class CampaignAliasRead(BaseModel):
    id: int
    campaign_id: int
    short_code: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AliasRedirectResponse(BaseModel):
    campaign_id: int
    slug: str
    redirect_url: str
