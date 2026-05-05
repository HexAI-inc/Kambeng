from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from app.models.ledger import TransactionType, TransactionStatus


class TransactionLedgerBase(BaseModel):
    transaction_type: TransactionType
    status: TransactionStatus
    gross_amount: float
    net_amount: float


class TransactionLedgerCreate(TransactionLedgerBase):
    campaign_id: int
    hexai_fee: Optional[float] = None
    platform_commission: Optional[float] = None
    external_reference: Optional[str] = None
    description: Optional[str] = None


class TransactionLedgerRead(TransactionLedgerBase):
    id: int
    campaign_id: int
    hexai_fee: Optional[float] = None
    platform_commission: Optional[float] = None
    external_reference: Optional[str] = None
    description: Optional[str] = None
    created_by_user_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    confirmed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class TransactionLedgerSummary(BaseModel):
    """Summary statistics for transactions."""
    total_donations: float
    total_withdrawals: float
    total_hexai_fees: float
    total_platform_commissions: float
    net_total: float
    transaction_count: int
    average_withdrawal: Optional[float] = None


class DailyTransactionSummary(BaseModel):
    """Daily transaction summary for reporting."""
    date: str
    donation_count: int
    withdrawal_count: int
    total_donations: float
    total_withdrawals_gross: float
    total_hexai_fees: float
    total_platform_commissions: float
    net_total: float
