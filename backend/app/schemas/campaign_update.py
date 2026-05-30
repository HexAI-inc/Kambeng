from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime


class CampaignUpdateCreate(BaseModel):
    text: str
    category: Optional[str] = None
    amount_spent: Optional[float] = None


class UpdateAttachmentRead(BaseModel):
    id: int
    file_url: str
    file_name: str
    content_type: Optional[str] = None
    uploaded_by_user_id: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CampaignUpdateRead(BaseModel):
    id: int
    campaign_id: int
    user_id: int
    text: str
    category: Optional[str] = None
    amount_spent: Optional[float] = None
    attachments: List[UpdateAttachmentRead] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
