from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional
from typing import List


class FraudReportCreate(BaseModel):
    reason: str
    details: Optional[str] = None
    # When reporting anonymously, frontend should provide a reCAPTCHA token
    recaptcha_token: Optional[str] = None


class FraudReportRead(BaseModel):
    id: int
    campaign_id: int
    reported_by_user_id: int
    reason: str
    details: Optional[str]
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FraudReportList(BaseModel):
    items: List[FraudReportRead]
    total: int

    model_config = ConfigDict(from_attributes=True)
