from pydantic import BaseModel, Field

class PayoutRequest(BaseModel):
    campaign_id: int
    amount: float = Field(..., gt=0, description="The amount you want to withdraw")