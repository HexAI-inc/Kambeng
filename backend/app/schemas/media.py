from pydantic import BaseModel
from typing import List, Optional, Dict


class CampaignImageRead(BaseModel):
    file_name: str
    url: str
    size: int
    content_type: Optional[str] = None
    original_name: Optional[str] = None


class CampaignImageUploadResponse(BaseModel):
    uploaded: List[CampaignImageRead]


class CampaignImagePresignRequest(BaseModel):
    filename: str
    content_type: str


class CampaignPresignResponse(BaseModel):
    url: str
    fields: Dict[str, str]
    file_name: str
    key: str
    public_url: str
    expires_in: int
