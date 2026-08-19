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
    # Self-declared organiser type — drives eligibility for NGO onboarding
    # promos (see app/services/promotions.py). Diaspora detection is
    # deliberately manual for now (admin can set it), per the promotions
    # engine rollout plan.
    organiser_type: Optional[str] = "individual"

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


class CampaignOwner(BaseModel):
    """Public organizer attribution — who a campaign belongs to."""
    id: int
    full_name: Optional[str] = None
    kyc_verified: bool = False

    model_config = ConfigDict(from_attributes=True)


class CampaignDetailRead(CampaignRead):
    """Campaign detail including the owner. Only used by endpoints that
    eagerly load the owner relationship."""
    owner: Optional[CampaignOwner] = None