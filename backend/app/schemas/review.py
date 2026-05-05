from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import datetime

class ReviewBase(BaseModel):
    donor_name: Optional[str] = "Anonymous"
    comment: str = Field(..., min_length=2, description="The review text")
    rating: int = Field(default=5, ge=1, le=5, description="Rating from 1 to 5")

class ReviewCreate(ReviewBase):
    campaign_id: int

class ReviewRead(ReviewBase):
    id: int
    campaign_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)