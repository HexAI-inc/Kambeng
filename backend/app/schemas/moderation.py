from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from app.models.moderation import ReportEntityType, ReportStatus, ReportReason


class ModerationReportCreate(BaseModel):
    reported_entity_type: ReportEntityType
    reported_entity_id: int
    campaign_id: Optional[int] = None
    reason: ReportReason
    description: str


class ModerationReportRead(BaseModel):
    id: int
    reported_entity_type: ReportEntityType
    reported_entity_id: int
    campaign_id: Optional[int] = None
    reported_by_user_id: Optional[int] = None
    reason: ReportReason
    description: str
    status: ReportStatus
    moderation_note: Optional[str] = None
    resolved_by_admin_id: Optional[int] = None
    resolved_at: Optional[datetime] = None
    action_taken: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ModerationReportResolve(BaseModel):
    status: ReportStatus
    action_taken: Optional[str] = None
    moderation_note: Optional[str] = None
