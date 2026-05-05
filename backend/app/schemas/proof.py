from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime


class ProofCreate(BaseModel):
    description: Optional[str] = None
    document_type: Optional[str] = None
    visibility: Optional[str] = None


class ProofRead(BaseModel):
    id: int
    campaign_id: int
    file_url: str
    description: Optional[str] = None
    document_type: Optional[str] = None
    visibility: Optional[str] = None
    uploaded_by_user_id: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
