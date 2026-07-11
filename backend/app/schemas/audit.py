from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime


class AdminAuditLogRead(BaseModel):
    id: int
    action_type: str
    performed_by_admin_id: int
    target_entity_type: str
    target_entity_id: int
    campaign_id: Optional[int] = None
    target_user_id: Optional[int] = None
    description: str
    details: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserOverviewItem(BaseModel):
    """Quick summary of a user for admin oversight."""
    id: int
    full_name: str
    email: str
    wave_number: str
    role: str
    is_active: bool
    kyc_status: str
    created_at: datetime
    campaign_count: int
    total_raised: float
    last_activity: Optional[datetime] = None


class PayoutOverviewItem(BaseModel):
    """Summary of recent payouts for oversight."""
    payout_id: int
    client_reference: Optional[str] = None
    campaign_id: int
    campaign_title: str
    user_id: int
    user_name: str
    gross_amount: float
    hexai_fee: float
    platform_commission: float
    net_amount: float
    status: str
    created_at: datetime


class AdminSystemStats(BaseModel):
    """Overall system statistics."""
    total_users: int
    total_campaigns: int
    kyc_approved_count: int
    kyc_pending_count: int
    kyc_rejected_count: int
    total_platform_revenue: float
    active_campaigns: int
    suspended_campaigns: int
    last_audit_entry_date: Optional[datetime] = None
