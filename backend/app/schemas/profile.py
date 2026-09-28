from datetime import datetime
from typing import Dict, List, Optional

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


class SupportedCampaign(BaseModel):
    """A campaign the profile owner gave to under their own name. No amounts."""
    id: int
    title: str
    slug: str
    cover_image_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class FollowedProfile(BaseModel):
    """An organizer the current user follows."""
    id: int
    full_name: Optional[str] = None
    handle: Optional[str] = None
    avatar_url: Optional[str] = None
    kyc_verified: bool = False
    followed_at: datetime


class HandleAvailability(BaseModel):
    handle: str
    available: bool
    reason: Optional[str] = None


class PublicProfileRead(BaseModel):
    """Publicly visible organizer profile — no contact details."""
    id: int
    full_name: Optional[str] = None
    handle: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    cover_url: Optional[str] = None
    favorite_causes: List[str] = []
    location: Optional[str] = None
    social_links: Dict[str, str] = {}
    kyc_verified: bool
    member_since: datetime
    # Track record across the organizer's public campaigns
    total_raised: float = 0
    supporters_count: int = 0
    followers_count: int = 0
    # Relative to the viewer; always False when logged out
    is_following: bool = False
    # Empty unless the owner opted in
    supported_campaigns: List[SupportedCampaign] = []
    campaigns: List[PublicProfileCampaign]
