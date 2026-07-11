from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict

from app.models.campaign import CampaignMode, CampaignStatus


class PublicProfileCampaign(BaseModel):
    """Campaign summary shown on a public organizer profile."""
    id: int
    title: str
    slug: str
    mode: CampaignMode
    status: CampaignStatus
    amount_raised: float
    target_amount: Optional[float] = None
    cover_image_url: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PublicProfileRead(BaseModel):
    """Publicly visible organizer profile — no contact details."""
    id: int
    full_name: Optional[str] = None
    bio: Optional[str] = None
    kyc_verified: bool
    member_since: datetime
    campaigns: List[PublicProfileCampaign]
