from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from app.models.campaign import CampaignMode, CampaignStatus

class CampaignBase(BaseModel):
    title: str
    description: str
    mode: CampaignMode # TARGET or ONGOING
    target_amount: Optional[float] = None

class CampaignCreate(CampaignBase):
    pass

class CampaignRead(CampaignBase):
    id: int
    user_id: int
    slug: str
    amount_raised: float
    status: CampaignStatus
    qr_code_page_url: Optional[str] = None
    qr_code_direct_url: Optional[str] = None
    cover_image_url: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)