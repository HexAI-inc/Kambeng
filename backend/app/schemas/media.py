from pydantic import BaseModel
from typing import List, Optional


class CampaignImageRead(BaseModel):
    file_name: str
    url: str
    size: int
    content_type: Optional[str] = None
    original_name: Optional[str] = None


class CampaignImageUploadResponse(BaseModel):
    uploaded: List[CampaignImageRead]
