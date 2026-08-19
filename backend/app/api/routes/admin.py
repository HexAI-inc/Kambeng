from typing import List, Optional
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_, cast, String

from app.api.routes.auth import get_admin_user
from app.db.database import get_db
from app.models.campaign import Campaign, CampaignStatus
from app.models.kyc import KYC, KYCStatus
from app.models.review import Review
from app.models.user import User
from app.models.audit_log import AdminAuditLog, AuditActionType
from app.models.payout import Payout
from app.models.ledger import TransactionLedger, TransactionType, TransactionStatus
from app.models.donation import Donation
from app.schemas.campaign import CampaignRead
from app.schemas.kyc import AdminKYCRead, KYCRead, KYCRejectRequest
from app.schemas.review import ReviewRead
from app.schemas.audit import AdminAuditLogRead, UserOverviewItem, PayoutOverviewItem, AdminSystemStats
from app.schemas.commissions import CommissionSummary, CommissionSourceItem, AdminCommissionWithdrawalRequest, AdminCommissionWithdrawalResponse
from app.schemas.user import AdminUserUpdate, UserRead
from app.services.email_service import render_kyc_approved_email, render_kyc_rejected_email, send_email
from app.services.hexai_service import HexAIGatewayError, HexAIPaymentService
from app.services.payout_service import apply_payout_status, normalize_gateway_status
from app.core.logging_config import get_logger

hexai_service = HexAIPaymentService()
logger = get_logger("admin")
from app.core.config import settings
from sqlalchemy import func


router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/campaigns", response_model=List[CampaignRead])
async def list_all_campaigns(
    status: Optional[str] = Query(default=None),
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _admin_user: User = Depends(get_admin_user),
):
    query = select(Campaign)
    if status:
        query = query.where(Campaign.status == status)

    result = await db.execute(query.order_by(Campaign.created_at.desc()).offset(skip).limit(limit))
    return result.scalars().all()


@router.get("/campaigns/{campaign_id}", response_model=CampaignRead)
async def get_campaign_detail(
    campaign_id: int,
    db: AsyncSession = Depends(get_db),
    _admin_user: User = Depends(get_admin_user),
):
    """Get campaign details by ID."""
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalars().first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


@router.patch("/campaigns/{slug}/status")
async def moderate_campaign_status(
    slug: str,
    status: str,
    db: AsyncSession = Depends(get_db),
    _admin_user: User = Depends(get_admin_user),
):
    if status not in ["ACTIVE", "CLOSED", "SUSPENDED"]:
        raise HTTPException(status_code=400, detail="Invalid status")

    result = await db.execute(select(Campaign).where(Campaign.slug == slug))
    campaign = result.scalars().first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    old_status = campaign.status
    campaign.status = status
    await db.commit()
    await db.refresh(campaign)
    
    # Log to audit trail
    action_type_map = {
        "SUSPENDED": AuditActionType.CAMPAIGN_SUSPENDED,
        "ACTIVE": AuditActionType.CAMPAIGN_REACTIVATED,
        "CLOSED": AuditActionType.CAMPAIGN_SUSPENDED  # Use same action type for closed
    }
    
    await _log_audit_action(
        db=db,
        action_type=action_type_map.get(status, AuditActionType.CAMPAIGN_SUSPENDED),
        performed_by_admin_id=_admin_user.id,
        target_entity_type="Campaign",
        target_entity_id=campaign.id,
        campaign_id=campaign.id,
        description=f"Campaign '{campaign.title}' status changed from {old_status} to {status}",
        old_value=old_status,
        new_value=status
    )
    
    return {"message": f"Campaign status updated to {status}"}


@router.get("/reviews", response_model=List[ReviewRead])
async def list_all_reviews(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _admin_user: User = Depends(get_admin_user),
):
    result = await db.execute(select(Review).order_by(Review.created_at.desc()).offset(skip).limit(limit))
    return result.scalars().all()


@router.delete("/reviews/{review_id}")
async def delete_review_as_admin(
    review_id: int,
    db: AsyncSession = Depends(get_db),
    _admin_user: User = Depends(get_admin_user),
):
    result = await db.execute(select(Review).where(Review.id == review_id))
    review = result.scalars().first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    # Get campaign info for logging
    campaign_result = await db.execute(select(Campaign).where(Campaign.id == review.campaign_id))
    campaign = campaign_result.scalars().first()
    
    await db.delete(review)
    await db.commit()
    
    # Log to audit trail
    await _log_audit_action(
        db=db,
        action_type=AuditActionType.REVIEW_DELETED,
        performed_by_admin_id=_admin_user.id,
        target_entity_type="Review",
        target_entity_id=review_id,
        campaign_id=review.campaign_id,
        target_user_id=review.user_id,
        description=f"Review deleted from campaign '{campaign.title if campaign else 'Unknown'}' by reviewer {review.user_id}",
        old_value=f"Star: {review.star_count}, Text: {review.text[:50] if review.text else 'N/A'}"
    )
    
    return {"message": "Review deleted"}


# ===== KYC Management Endpoints =====

@router.get("/kyc/queue", response_model=List[AdminKYCRead])
async def list_kyc_queue(
    status: Optional[str] = Query(default=None),
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _admin_user: User = Depends(get_admin_user),
):
    """List pending KYC submissions for admin review."""
    query = select(KYC)

    if status:
        if status not in [s.value for s in KYCStatus]:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join([s.value for s in KYCStatus])}")
        query = query.where(cast(KYC.status, String) == status)
    else:
        query = query.where(
            cast(KYC.status, String).in_([KYCStatus.SUBMITTED.value, KYCStatus.REVIEWING.value])
        )

    result = await db.execute(query.order_by(KYC.created_at.asc()).offset(skip).limit(limit))
    submissions = result.scalars().all()

    user_ids = list({s.user_id for s in submissions})
    users_result = await db.execute(select(User).where(User.id.in_(user_ids)))
    users_by_id = {u.id: u for u in users_result.scalars().all()}

    rows = []
    for s in submissions:
        user = users_by_id.get(s.user_id)
        rows.append(AdminKYCRead(
            id=s.id,
            user_id=s.user_id,
            document_type=s.document_type,
            document_file_url=s.document_file_url,
            status=s.status,
            reviewed_by_admin_id=s.reviewed_by_admin_id,
            reviewed_at=s.reviewed_at,
            rejection_reason=s.rejection_reason,
            created_at=s.created_at,
            updated_at=s.updated_at,
            user_name=user.full_name if user else None,
            user_email=user.email if user else None,
        ))
    return rows


@router.get("/kyc/{submission_id}", response_model=AdminKYCRead)
async def get_kyc_detail(
    submission_id: int,
    db: AsyncSession = Depends(get_db),
    _admin_user: User = Depends(get_admin_user),
):
    """Get KYC submission details by ID."""
    result = await db.execute(select(KYC).where(KYC.id == submission_id))
    submission = result.scalars().first()
    if not submission:
        raise HTTPException(status_code=404, detail="KYC submission not found")
    user_result = await db.execute(select(User).where(User.id == submission.user_id))
    user = user_result.scalars().first()
    return AdminKYCRead(
        id=submission.id,
        user_id=submission.user_id,
        document_type=submission.document_type,
        document_file_url=submission.document_file_url,
        status=submission.status,
        reviewed_by_admin_id=submission.reviewed_by_admin_id,
        reviewed_at=submission.reviewed_at,
        rejection_reason=submission.rejection_reason,
        created_at=submission.created_at,
        updated_at=submission.updated_at,
        user_name=user.full_name if user else None,
        user_email=user.email if user else None,
    )


@router.post("/kyc/{submission_id}/approve", response_model=KYCRead)
async def approve_kyc(
    submission_id: int,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user),
):
    """Approve a KYC submission."""
    result = await db.execute(select(KYC).where(KYC.id == submission_id))
    submission = result.scalars().first()
    if not submission:
        raise HTTPException(status_code=404, detail="KYC submission not found")
    
    # Update submission
    submission.status = KYCStatus.APPROVED.value
    submission.reviewed_by_admin_id = admin_user.id
    submission.reviewed_at = datetime.now(UTC)
    
    # Update user KYC status
    user_result = await db.execute(select(User).where(User.id == submission.user_id))
    user = user_result.scalars().first()
    if user:
        user.kyc_status = KYCStatus.APPROVED.value
        user.kyc_verified_at = datetime.now(UTC)
        user.kyc_rejection_reason = None
    
    await db.commit()
    
    # Log to audit trail
    await _log_audit_action(
        db=db,
        action_type=AuditActionType.KYC_APPROVED,
        performed_by_admin_id=admin_user.id,
        target_entity_type="KYC",
        target_entity_id=submission.id,
        target_user_id=submission.user_id,
        description=f"KYC submission {submission.document_type} approved for user {user.full_name if user else 'Unknown'}",
        new_value="APPROVED"
    )
    
    await db.refresh(submission)

    if user and user.email:
        try:
            dashboard_link = f"{settings.FRONTEND_URL.rstrip('/')}/dashboard"
            html = render_kyc_approved_email(full_name=user.full_name or user.email, dashboard_link=dashboard_link)
            send_email(user.email, "Your identity has been verified — KYC Approved", html)
        except Exception:
            pass  # never block the approval on email failure

    return submission


@router.post("/kyc/{submission_id}/reject")
async def reject_kyc(
    submission_id: int,
    payload: KYCRejectRequest = Body(...),
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user),
):
    """Reject a KYC submission. Accepts JSON body `{rejection_reason: str}`."""
    rejection_reason = payload.rejection_reason
    if not rejection_reason or not rejection_reason.strip():
        raise HTTPException(status_code=400, detail="rejection_reason is required")
    
    result = await db.execute(select(KYC).where(KYC.id == submission_id))
    submission = result.scalars().first()
    if not submission:
        raise HTTPException(status_code=404, detail="KYC submission not found")
    
    # Update submission
    submission.status = KYCStatus.REJECTED.value
    submission.reviewed_by_admin_id = admin_user.id
    submission.reviewed_at = datetime.now(UTC)
    submission.rejection_reason = rejection_reason
    
    # Update user KYC status
    user_result = await db.execute(select(User).where(User.id == submission.user_id))
    user = user_result.scalars().first()
    if user:
        user.kyc_status = KYCStatus.REJECTED.value
        user.kyc_rejection_reason = rejection_reason
        user.kyc_verified_at = None
    
    await db.commit()
    
    # Log to audit trail
    await _log_audit_action(
        db=db,
        action_type=AuditActionType.KYC_REJECTED,
        performed_by_admin_id=admin_user.id,
        target_entity_type="KYC",
        target_entity_id=submission.id,
        target_user_id=submission.user_id,
        description=f"KYC submission rejected for user {user.full_name if user else 'Unknown'}",
        details=rejection_reason,
        new_value="REJECTED"
    )
    
    await db.refresh(submission)

    if user and user.email:
        try:
            kyc_link = f"{settings.FRONTEND_URL.rstrip('/')}/dashboard/kyc"
            html = render_kyc_rejected_email(
                full_name=user.full_name or user.email,
                rejection_reason=rejection_reason,
                kyc_link=kyc_link,
            )
            send_email(user.email, "Action required: KYC submission not approved", html)
        except Exception:
            pass  # never block the rejection on email failure

    return {"message": "KYC submission rejected", "submission_id": submission.id, "rejection_reason": rejection_reason}


# ===== Financial Reporting Endpoints =====

@router.get("/reports/transactions")
async def list_transactions(
    campaign_id: Optional[int] = Query(default=None),
    transaction_type: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _admin_user: User = Depends(get_admin_user),
):
    """List all transactions with optional filtering."""
    from app.models.ledger import TransactionLedger
    from app.schemas.ledger import TransactionLedgerRead
    
    query = select(TransactionLedger)
    
    if campaign_id:
        query = query.where(TransactionLedger.campaign_id == campaign_id)
    
    if transaction_type:
        query = query.where(cast(TransactionLedger.transaction_type, String) == transaction_type.upper())
    
    if status:
        query = query.where(cast(TransactionLedger.status, String) == status.upper())
    
    result = await db.execute(query.order_by(TransactionLedger.created_at.desc()).offset(skip).limit(limit))
    transactions = result.scalars().all()
    
    return [TransactionLedgerRead.model_validate(t) for t in transactions]


@router.get("/reports/summary")
async def get_financial_summary(
    db: AsyncSession = Depends(get_db),
    _admin_user: User = Depends(get_admin_user),
):
    """Get overall financial summary statistics."""
    from app.models.ledger import TransactionLedger, TransactionType, TransactionStatus
    from app.schemas.ledger import TransactionLedgerSummary
    from sqlalchemy import and_
    
    # Get successful donations
    donations_result = await db.execute(
        select(func.sum(TransactionLedger.net_amount)).where(
            and_(
                cast(TransactionLedger.transaction_type, String) == TransactionType.DONATION.value,
                cast(TransactionLedger.status, String) == TransactionStatus.SUCCEEDED.value
            )
        )
    )
    total_donations = donations_result.scalar() or 0.0
    
    # Get successful withdrawals
    withdrawals_result = await db.execute(
        select(func.sum(TransactionLedger.gross_amount)).where(
            and_(
                cast(TransactionLedger.transaction_type, String) == TransactionType.WITHDRAWAL.value,
                cast(TransactionLedger.status, String) == TransactionStatus.SUCCEEDED.value
            )
        )
    )
    total_withdrawals_gross = withdrawals_result.scalar() or 0.0
    
    # Get total fees
    fees_result = await db.execute(
        select(
            func.sum(TransactionLedger.hexai_fee),
            func.sum(TransactionLedger.platform_commission)
        ).where(
            and_(
                cast(TransactionLedger.transaction_type, String) == TransactionType.WITHDRAWAL.value,
                cast(TransactionLedger.status, String) == TransactionStatus.SUCCEEDED.value
            )
        )
    )
    fees_row = fees_result.first()
    total_hexai_fees = fees_row[0] or 0.0
    total_platform_commissions = fees_row[1] or 0.0
    
    # Get transaction count
    count_result = await db.execute(select(func.count(TransactionLedger.id)))
    transaction_count = count_result.scalar() or 0
    
    # Get withdrawal count for average
    withdraw_count_result = await db.execute(
        select(func.count(TransactionLedger.id)).where(
            and_(
                cast(TransactionLedger.transaction_type, String) == TransactionType.WITHDRAWAL.value,
                cast(TransactionLedger.status, String) == TransactionStatus.SUCCEEDED.value
            )
        )
    )
    withdraw_count = withdraw_count_result.scalar() or 0
    
    net_total = total_donations - total_withdrawals_gross
    average_withdrawal = total_withdrawals_gross / withdraw_count if withdraw_count > 0 else None
    
    return TransactionLedgerSummary(
        total_donations=total_donations,
        total_withdrawals=total_withdrawals_gross,
        total_hexai_fees=total_hexai_fees,
        total_platform_commissions=total_platform_commissions,
        net_total=net_total,
        transaction_count=transaction_count,
        average_withdrawal=average_withdrawal
    )


@router.get("/reports/campaign/{campaign_id}")
async def get_campaign_report(
    campaign_id: int,
    db: AsyncSession = Depends(get_db),
    _admin_user: User = Depends(get_admin_user),
):
    """Get detailed financial report for a specific campaign."""
    from app.models.ledger import TransactionLedger, TransactionStatus
    from app.schemas.ledger import TransactionLedgerSummary
    from sqlalchemy import and_
    
    # Get successful donations for this campaign
    donations_result = await db.execute(
        select(func.sum(TransactionLedger.net_amount)).where(
            and_(
                TransactionLedger.campaign_id == campaign_id,
                cast(TransactionLedger.status, String) == TransactionStatus.SUCCEEDED.value
            )
        )
    )
    total_donations = donations_result.scalar() or 0.0
    
    # Get successful withdrawals for this campaign
    withdrawals_result = await db.execute(
        select(func.sum(TransactionLedger.gross_amount)).where(
            and_(
                TransactionLedger.campaign_id == campaign_id,
                cast(TransactionLedger.status, String) == TransactionStatus.SUCCEEDED.value
            )
        )
    )
    total_withdrawals_gross = withdrawals_result.scalar() or 0.0
    
    # Get total fees for this campaign
    fees_result = await db.execute(
        select(
            func.sum(TransactionLedger.hexai_fee),
            func.sum(TransactionLedger.platform_commission)
        ).where(
            and_(
                TransactionLedger.campaign_id == campaign_id,
                cast(TransactionLedger.status, String) == TransactionStatus.SUCCEEDED.value
            )
        )
    )
    fees_row = fees_result.first()
    total_hexai_fees = fees_row[0] or 0.0
    total_platform_commissions = fees_row[1] or 0.0
    
    # Get transaction count for this campaign
    count_result = await db.execute(
        select(func.count(TransactionLedger.id)).where(TransactionLedger.campaign_id == campaign_id)
    )
    transaction_count = count_result.scalar() or 0
    
    net_total = total_donations - total_withdrawals_gross
    
    return TransactionLedgerSummary(
        total_donations=total_donations,
        total_withdrawals=total_withdrawals_gross,
        total_hexai_fees=total_hexai_fees,
        total_platform_commissions=total_platform_commissions,
        net_total=net_total,
        transaction_count=transaction_count,
        average_withdrawal=None
    )


# ===== Super-Admin Oversight Endpoints (Audit Logs) =====

async def _log_audit_action(
    db: AsyncSession,
    action_type: AuditActionType,
    performed_by_admin_id: int,
    target_entity_type: str,
    target_entity_id: int,
    description: str,
    campaign_id: Optional[int] = None,
    target_user_id: Optional[int] = None,
    old_value: Optional[str] = None,
    new_value: Optional[str] = None,
    details: Optional[str] = None,
):
    """Helper to log admin actions to audit log."""
    audit_log = AdminAuditLog(
        action_type=action_type.value,
        performed_by_admin_id=performed_by_admin_id,
        target_entity_type=target_entity_type,
        target_entity_id=target_entity_id,
        campaign_id=campaign_id,
        target_user_id=target_user_id,
        description=description,
        details=details,
        old_value=old_value,
        new_value=new_value,
    )
    db.add(audit_log)
    await db.commit()


@router.get("/audit-logs", response_model=List[AdminAuditLogRead])
async def list_audit_logs(
    action_type: Optional[str] = Query(default=None),
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _admin_user: User = Depends(get_admin_user),
):
    """List admin audit logs for tracking sensitive actions."""
    query = select(AdminAuditLog)
    if action_type:
        query = query.where(AdminAuditLog.action_type == action_type)
    
    result = await db.execute(query.order_by(AdminAuditLog.created_at.desc()).offset(skip).limit(limit))
    return result.scalars().all()


@router.get("/users/overview", response_model=List[UserOverviewItem])
async def list_users_overview(
    kyc_status: Optional[str] = Query(default=None),
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _admin_user: User = Depends(get_admin_user),
):
    """Get user overview for admin oversight."""
    # Get users with campaign counts and total raised
    query = select(User)
    if kyc_status:
        query = query.where(User.kyc_status == kyc_status)
    
    result = await db.execute(query.offset(skip).limit(limit))
    users = result.scalars().all()
    
    overview = []
    for user in users:
        # Get campaign count
        campaign_result = await db.execute(select(func.count(Campaign.id)).where(Campaign.user_id == user.id))
        campaign_count = campaign_result.scalar() or 0
        
        # Get total raised
        total_result = await db.execute(select(func.sum(Campaign.amount_raised)).where(Campaign.user_id == user.id))
        total_raised = total_result.scalar() or 0.0
        
        # Get last activity timestamp (either campaign or donation)
        last_campaign = await db.execute(
            select(Campaign.created_at).where(Campaign.user_id == user.id).order_by(Campaign.created_at.desc()).limit(1)
        )
        last_activity = last_campaign.scalars().first()
        
        overview.append(UserOverviewItem(
            id=user.id,
            full_name=user.full_name,
            email=user.email,
            wave_number=user.wave_number,
            role=user.role,
            is_active=user.is_active,
            kyc_status=user.kyc_status,
            created_at=user.created_at,
            campaign_count=campaign_count,
            total_raised=total_raised,
            last_activity=last_activity,
        ))
    
    return overview


@router.get("/users/{user_id}", response_model=UserOverviewItem)
async def get_user_detail(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _admin_user: User = Depends(get_admin_user),
):
    """Get user details by ID."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get campaign count
    campaign_result = await db.execute(select(func.count(Campaign.id)).where(Campaign.user_id == user.id))
    campaign_count = campaign_result.scalar() or 0
    
    # Get total raised
    total_result = await db.execute(select(func.sum(Campaign.amount_raised)).where(Campaign.user_id == user.id))
    total_raised = total_result.scalar() or 0.0
    
    # Get last activity timestamp
    last_campaign = await db.execute(
        select(Campaign.created_at).where(Campaign.user_id == user.id).order_by(Campaign.created_at.desc()).limit(1)
    )
    last_activity = last_campaign.scalars().first()
    
    return UserOverviewItem(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        wave_number=user.wave_number,
        role=user.role,
        is_active=user.is_active,
        kyc_status=user.kyc_status,
        created_at=user.created_at,
        campaign_count=campaign_count,
        total_raised=total_raised,
        last_activity=last_activity,
    )


@router.patch("/users/{user_id}/status", response_model=UserOverviewItem)
async def update_user_status(
    user_id: int,
    status: str = Query(...),
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user),
):
    """Activate or suspend a user account."""
    if status not in ["ACTIVE", "SUSPENDED"]:
        raise HTTPException(status_code=400, detail="Invalid status")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    old_status = "ACTIVE" if user.is_active else "SUSPENDED"
    user.is_active = status == "ACTIVE"
    await db.commit()
    await db.refresh(user)

    campaign_count_result = await db.execute(select(func.count(Campaign.id)).where(Campaign.user_id == user.id))
    campaign_count = campaign_count_result.scalar() or 0

    total_raised_result = await db.execute(select(func.sum(Campaign.amount_raised)).where(Campaign.user_id == user.id))
    total_raised = total_raised_result.scalar() or 0.0

    last_activity_result = await db.execute(
        select(Campaign.created_at).where(Campaign.user_id == user.id).order_by(Campaign.created_at.desc()).limit(1)
    )
    last_activity = last_activity_result.scalars().first()

    await _log_audit_action(
        db=db,
        action_type=AuditActionType.USER_ENABLED if user.is_active else AuditActionType.USER_DISABLED,
        performed_by_admin_id=admin_user.id,
        target_entity_type="User",
        target_entity_id=user.id,
        target_user_id=user.id,
        description=f"User '{user.full_name}' account status changed from {old_status} to {status}",
        old_value=old_status,
        new_value=status,
    )

    return UserOverviewItem(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        wave_number=user.wave_number,
        role=user.role,
        is_active=user.is_active,
        kyc_status=user.kyc_status,
        created_at=user.created_at,
        campaign_count=campaign_count,
        total_raised=total_raised,
        last_activity=last_activity,
    )


@router.patch("/users/{user_id}", response_model=UserRead)
async def admin_update_user(
    user_id: int,
    payload: AdminUserUpdate,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user),
):
    """Admin: update any field on a user account."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    changes: dict = {}

    if payload.full_name is not None:
        changes["full_name"] = (user.full_name, payload.full_name.strip())
        user.full_name = payload.full_name.strip()

    if payload.email is not None and payload.email != user.email:
        existing = await db.execute(select(User).where(User.email == payload.email, User.id != user_id))
        if existing.scalars().first():
            raise HTTPException(status_code=409, detail="Email already in use by another account.")
        changes["email"] = (user.email, payload.email)
        user.email = payload.email

    if payload.wave_number is not None and payload.wave_number != user.wave_number:
        existing = await db.execute(select(User).where(User.wave_number == payload.wave_number, User.id != user_id))
        if existing.scalars().first():
            raise HTTPException(status_code=409, detail="Wave number already in use by another account.")
        changes["wave_number"] = (user.wave_number, payload.wave_number.strip())
        user.wave_number = payload.wave_number.strip()

    if payload.role is not None:
        if payload.role not in ("USER", "ADMIN"):
            raise HTTPException(status_code=400, detail="Role must be USER or ADMIN.")
        changes["role"] = (user.role, payload.role)
        user.role = payload.role

    if payload.is_active is not None:
        changes["is_active"] = (user.is_active, payload.is_active)
        user.is_active = payload.is_active

    if payload.kyc_status is not None:
        valid_kyc = ("NOT_SUBMITTED", "SUBMITTED", "REVIEWING", "APPROVED", "REJECTED")
        if payload.kyc_status not in valid_kyc:
            raise HTTPException(status_code=400, detail=f"kyc_status must be one of: {', '.join(valid_kyc)}")
        changes["kyc_status"] = (user.kyc_status, payload.kyc_status)
        user.kyc_status = payload.kyc_status
        if payload.kyc_status == "APPROVED":
            user.kyc_verified_at = datetime.now(UTC)
            user.kyc_rejection_reason = None
        elif payload.kyc_status == "REJECTED":
            user.kyc_verified_at = None

    await db.commit()
    await db.refresh(user)

    change_desc = ", ".join(f"{k}: {v[0]!r} → {v[1]!r}" for k, v in changes.items()) or "no changes"
    await _log_audit_action(
        db=db,
        action_type=AuditActionType.USER_ENABLED,  # reuse closest action type
        performed_by_admin_id=admin_user.id,
        target_entity_type="User",
        target_entity_id=user_id,
        target_user_id=user_id,
        description=f"Admin updated user #{user_id} ({user.full_name}): {change_desc}",
    )

    return user


@router.get("/payouts/overview", response_model=List[PayoutOverviewItem])
async def list_payouts_overview(
    status: Optional[str] = Query(default=None),
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _admin_user: User = Depends(get_admin_user),
):
    """Get recent payouts for oversight."""
    query = select(Payout)
    if status:
        query = query.where(Payout.status == status)
    
    result = await db.execute(query.order_by(Payout.created_at.desc()).offset(skip).limit(limit))
    payouts = result.scalars().all()
    
    overview = []
    for payout in payouts:
        # Get campaign and user info
        campaign_result = await db.execute(select(Campaign).where(Campaign.id == payout.campaign_id))
        campaign = campaign_result.scalars().first()
        
        if campaign:
            user_result = await db.execute(select(User).where(User.id == campaign.user_id))
            user = user_result.scalars().first()
            
            overview.append(PayoutOverviewItem(
                payout_id=payout.id,
                client_reference=payout.client_reference,
                campaign_id=campaign.id,
                campaign_title=campaign.title,
                user_id=user.id if user else 0,
                user_name=user.full_name if user else "Unknown",
                gross_amount=payout.gross_amount or payout.amount or 0.0,
                hexai_fee=payout.hexai_fee or 0.0,
                platform_commission=payout.platform_commission or 0.0,
                net_amount=payout.net_amount or payout.amount or 0.0,
                status=payout.status,
                created_at=payout.created_at,
            ))
    
    return overview


@router.post("/payouts/{payout_id}/verify")
async def verify_payout_with_gateway(
    payout_id: int,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user),
):
    """Guard rail: ask HPG for the payout's real status and reconcile ours.
    Applies the transition only when the gateway reports a terminal state."""
    result = await db.execute(select(Payout).where(Payout.id == payout_id))
    payout = result.scalars().first()
    if not payout:
        raise HTTPException(status_code=404, detail="Payout not found")

    try:
        gateway_response = await hexai_service.get_payout_status(payout.client_reference)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Payout Gateway Error: {exc}")

    if not gateway_response:
        return {
            "payout_id": payout.id,
            "client_reference": payout.client_reference,
            "gateway_status": "NOT_FOUND",
            "previous_status": payout.status,
            "status": payout.status,
            "applied": False,
        }

    gateway_data = gateway_response.get("data") or gateway_response
    raw_status = gateway_data.get("status")
    normalized = normalize_gateway_status(raw_status)

    previous_status = payout.status
    applied = False
    if normalized:
        applied = await apply_payout_status(db, payout, normalized, source="VERIFY")

    logger.info(
        "Payout verified against gateway",
        extra={
            "action": "payout_gateway_verified",
            "payout_id": payout.id,
            "client_reference": payout.client_reference,
            "gateway_status": raw_status,
            "applied": applied,
            "admin_id": admin_user.id,
        },
    )

    return {
        "payout_id": payout.id,
        "client_reference": payout.client_reference,
        "gateway_status": raw_status,
        "previous_status": previous_status,
        "status": payout.status,
        "applied": applied,
    }


@router.post("/payouts/{payout_id}/mark-succeeded")
async def mark_payout_succeeded(
    payout_id: int,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user),
):
    """Guard rail: manually move a PENDING payout to SUCCEEDED when the money
    verifiably left but the webhook never arrived. Audited."""
    result = await db.execute(select(Payout).where(Payout.id == payout_id))
    payout = result.scalars().first()
    if not payout:
        raise HTTPException(status_code=404, detail="Payout not found")

    if payout.status != "PENDING":
        raise HTTPException(status_code=409, detail=f"Payout is {payout.status}; only PENDING payouts can be manually marked succeeded")

    await apply_payout_status(db, payout, "SUCCEEDED", source="MANUAL")

    await _log_audit_action(
        db,
        action_type=AuditActionType.PAYOUT_MANUAL_OVERRIDE,
        performed_by_admin_id=admin_user.id,
        target_entity_type="payout",
        target_entity_id=payout.id,
        description=f"Manually marked payout {payout.client_reference} as SUCCEEDED",
        campaign_id=payout.campaign_id,
        old_value="PENDING",
        new_value="SUCCEEDED",
    )

    return {
        "payout_id": payout.id,
        "client_reference": payout.client_reference,
        "previous_status": "PENDING",
        "status": payout.status,
    }


@router.post("/payouts/{payout_id}/reverse")
async def reverse_payout(
    payout_id: int,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user),
):
    """Reverse a dispatched Wave payout via HPG (3-day window from send).
    Idempotent on HPG's side; restores the campaign's available balance by
    moving the payout out of SUCCEEDED/PENDING (both of which are deducted
    from available_balance — see get_campaign_withdrawal_summary)."""
    result = await db.execute(select(Payout).where(Payout.id == payout_id))
    payout = result.scalars().first()
    if not payout:
        raise HTTPException(status_code=404, detail="Payout not found")
    if not payout.gateway_transaction_id:
        raise HTTPException(status_code=400, detail="This payout has no gateway transaction id on file — it predates reversal support or was never dispatched")
    if payout.status == "REVERSED":
        return {"payout_id": payout.id, "client_reference": payout.client_reference, "status": "REVERSED", "already_reversed": True}

    try:
        gateway_response = await hexai_service.reverse_payout(payout.gateway_transaction_id)
    except HexAIGatewayError as exc:
        raise HTTPException(status_code=exc.status_code if exc.status_code < 500 else 502, detail=exc.message)

    previous_status = payout.status
    payout.status = "REVERSED"
    payout.reversed_at = datetime.now(UTC)

    db.add(TransactionLedger(
        campaign_id=payout.campaign_id,
        transaction_type=TransactionType.REFUND,
        status=TransactionStatus.SUCCEEDED,
        gross_amount=payout.gross_amount,
        net_amount=payout.net_amount,
        external_reference=payout.client_reference,
        description=f"Payout reversed by {admin_user.email}",
        created_by_user_id=admin_user.id,
        confirmed_at=payout.reversed_at,
    ))

    await _log_audit_action(
        db,
        action_type=AuditActionType.PAYOUT_REVERSED,
        performed_by_admin_id=admin_user.id,
        target_entity_type="payout",
        target_entity_id=payout.id,
        description=f"Reversed payout {payout.client_reference} via gateway",
        campaign_id=payout.campaign_id,
        old_value=previous_status,
        new_value="REVERSED",
    )
    await db.commit()

    return {
        "payout_id": payout.id,
        "client_reference": payout.client_reference,
        "previous_status": previous_status,
        "status": "REVERSED",
        "gateway_response": gateway_response.get("data", gateway_response),
    }


@router.get("/donations/pending")
async def list_pending_donations(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _admin_user: User = Depends(get_admin_user),
):
    """Return recent donations that are still pending reconciliation for admin review."""
    query = select(Donation).where(Donation.status == "PENDING")
    result = await db.execute(query.order_by(Donation.created_at.desc()).offset(skip).limit(limit))
    donations = result.scalars().all()

    out = []
    for d in donations:
        campaign_title = None
        if d.campaign_id:
            camp_res = await db.execute(select(Campaign).where(Campaign.id == d.campaign_id))
            camp = camp_res.scalars().first()
            campaign_title = camp.title if camp else None

        out.append({
            "id": d.id,
            "campaign_id": d.campaign_id,
            "campaign_title": campaign_title,
            "donor_id": None,
            "donor_name": d.donor_name,
            "amount": d.amount,
            "status": d.status,
            "client_reference": d.client_reference,
            "created_at": d.created_at,
            "reconciliation_source": d.reconciliation_source,
            "reconciliation_reason": d.reconciliation_reason,
            "reconciled_by_admin_id": d.reconciled_by_admin_id,
            "reconciled_at": d.reconciled_at,
        })

    return out


@router.get("/donations/successful")
async def list_successful_donations(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _admin_user: User = Depends(get_admin_user),
):
    """Return successful donations for the admin donations overview."""
    query = select(Donation).where(Donation.status == "SUCCEEDED")
    result = await db.execute(query.order_by(Donation.created_at.desc()).offset(skip).limit(limit))
    donations = result.scalars().all()

    out = []
    for d in donations:
        campaign_title = None
        if d.campaign_id:
            camp_res = await db.execute(select(Campaign).where(Campaign.id == d.campaign_id))
            camp = camp_res.scalars().first()
            campaign_title = camp.title if camp else None

        out.append({
            "id": d.id,
            "campaign_id": d.campaign_id,
            "campaign_title": campaign_title,
            "donor_id": None,
            "donor_name": d.donor_name,
            "amount": d.amount,
            "status": d.status,
            "client_reference": d.client_reference,
            "created_at": d.created_at,
            "reconciliation_source": d.reconciliation_source,
            "reconciliation_reason": d.reconciliation_reason,
            "reconciled_by_admin_id": d.reconciled_by_admin_id,
            "reconciled_at": d.reconciled_at,
        })

    return out


@router.get("/system/stats", response_model=AdminSystemStats)
async def get_system_stats(
    db: AsyncSession = Depends(get_db),
    _admin_user: User = Depends(get_admin_user),
):
    """Get overall system statistics."""
    # Total users
    users_result = await db.execute(select(func.count(User.id)))
    total_users = users_result.scalar() or 0
    
    # Total campaigns
    campaigns_result = await db.execute(select(func.count(Campaign.id)))
    total_campaigns = campaigns_result.scalar() or 0
    
    # KYC status breakdown
    kyc_approved = await db.execute(select(func.count(User.id)).where(User.kyc_status == "APPROVED"))
    kyc_approved_count = kyc_approved.scalar() or 0
    
    kyc_pending = await db.execute(select(func.count(User.id)).where(User.kyc_status.in_(["SUBMITTED", "REVIEWING"])))
    kyc_pending_count = kyc_pending.scalar() or 0
    
    kyc_rejected = await db.execute(select(func.count(User.id)).where(User.kyc_status == "REJECTED"))
    kyc_rejected_count = kyc_rejected.scalar() or 0
    
    # Platform revenue (sum of platform commissions)
    revenue_result = await db.execute(
        select(func.sum(TransactionLedger.platform_commission)).where(
            and_(
                cast(TransactionLedger.transaction_type, String) == TransactionType.WITHDRAWAL.value,
                cast(TransactionLedger.status, String) == TransactionStatus.SUCCEEDED.value
            )
        )
    )
    total_platform_revenue = revenue_result.scalar() or 0.0
    
    # Active vs suspended campaigns
    active_campaigns = await db.execute(select(func.count(Campaign.id)).where(Campaign.status == CampaignStatus.ACTIVE.value))
    active_count = active_campaigns.scalar() or 0
    
    suspended_campaigns = await db.execute(select(func.count(Campaign.id)).where(Campaign.status == CampaignStatus.SUSPENDED.value))
    suspended_count = suspended_campaigns.scalar() or 0
    
    # Last audit entry
    audit_result = await db.execute(select(AdminAuditLog).order_by(AdminAuditLog.created_at.desc()).limit(1))
    last_audit = audit_result.scalars().first()
    last_audit_date = last_audit.created_at if last_audit else None
    
    return AdminSystemStats(
        total_users=total_users,
        total_campaigns=total_campaigns,
        kyc_approved_count=kyc_approved_count,
        kyc_pending_count=kyc_pending_count,
        kyc_rejected_count=kyc_rejected_count,
        total_platform_revenue=total_platform_revenue,
        active_campaigns=active_count,
        suspended_campaigns=suspended_count,
        last_audit_entry_date=last_audit_date,
    )


# ===== Commissions & Revenue Management =====

@router.get("/commissions", response_model=CommissionSummary)
async def get_commissions_summary(
    db: AsyncSession = Depends(get_db),
    _admin_user: User = Depends(get_admin_user),
):
    """Get platform commissions summary and breakdown by source."""
    # Count only SUCCEEDED campaign payouts — failed payouts earned nothing.
    # Avoid NULL > 0 trap by using isnot(None) alongside the positivity check.
    payouts_result = await db.execute(
        select(Payout).where(
            and_(
                Payout.campaign_id.isnot(None),
                Payout.platform_commission.isnot(None),
                Payout.platform_commission > 0,
                cast(Payout.status, String) == "SUCCEEDED",
            )
        ).order_by(Payout.created_at.desc())
    )
    payouts = payouts_result.scalars().all()

    total_commissions = sum((p.platform_commission or 0.0) for p in payouts)
    
    # Get already withdrawn commissions (admin withdrawal payouts with SUCCEEDED status)
    withdrawn_result = await db.execute(
        select(func.sum(Payout.platform_commission)).where(
            and_(
                Payout.platform_commission > 0,
                Payout.campaign_id.is_(None),
                cast(Payout.status, String) == "SUCCEEDED"
            )
        )
    )
    withdrawn_commissions = withdrawn_result.scalar() or 0.0
    
    # Get pending commissions (admin withdrawal payouts in flight)
    pending_result = await db.execute(
        select(func.sum(Payout.platform_commission)).where(
            and_(
                Payout.platform_commission > 0,
                Payout.campaign_id.is_(None),
                cast(Payout.status, String) == "PENDING"
            )
        )
    )
    pending_commissions = pending_result.scalar() or 0.0
    
    available_commissions = total_commissions - withdrawn_commissions - pending_commissions
    commission_count = len(payouts)
    
    await db.commit()
    
    await _log_audit_action(
        db=db,
        action_type=AuditActionType.COMMISSIONS_VIEWED,
        performed_by_admin_id=_admin_user.id,
        target_entity_type="COMMISSIONS",
        target_entity_id=0,
        description=f"Admin viewed commissions summary. Available: {available_commissions}"
    )
    
    return CommissionSummary(
        total_commissions=total_commissions,
        withdrawn_commissions=withdrawn_commissions,
        pending_commissions=pending_commissions,
        available_commissions=available_commissions,
        commission_count=commission_count,
        last_updated=datetime.now(UTC)
    )


@router.get("/commissions/sources", response_model=List[CommissionSourceItem])
async def get_commission_sources(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _admin_user: User = Depends(get_admin_user),
):
    """Get detailed breakdown of commissions by payout source."""
    payouts_result = await db.execute(
        select(Payout).where(
            and_(
                Payout.campaign_id.isnot(None),
                Payout.platform_commission.isnot(None),
                Payout.platform_commission > 0,
                cast(Payout.status, String) == "SUCCEEDED",
            )
        ).order_by(Payout.created_at.desc()).offset(skip).limit(limit)
    )
    payouts = payouts_result.scalars().all()
    
    sources = []
    for payout in payouts:
        campaign_result = await db.execute(
            select(Campaign).where(Campaign.id == payout.campaign_id)
        )
        campaign = campaign_result.scalars().first()
        if not campaign:
            continue
        
        user_result = await db.execute(
            select(User).where(User.id == campaign.user_id)
        )
        user = user_result.scalars().first()
        
        sources.append(CommissionSourceItem(
            payout_id=payout.id,
            campaign_id=campaign.id,
            campaign_title=campaign.title,
            user_id=user.id if user else 0,
            user_name=user.full_name if user else "Unknown",
            gross_amount=payout.gross_amount or 0.0,
            platform_commission=payout.platform_commission or 0.0,
            status=payout.status,
            created_at=payout.created_at,
        ))
    
    return sources


@router.post("/commissions/withdraw", response_model=AdminCommissionWithdrawalResponse)
async def withdraw_commissions(
    request: AdminCommissionWithdrawalRequest,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user),
):
    """Send earned commissions to the platform Wave account via HexAI."""
    import uuid

    if request.amount <= 0:
        raise HTTPException(status_code=400, detail="Withdrawal amount must be positive")

    commissions = await get_commissions_summary(db=db, _admin_user=admin_user)
    if request.amount > commissions.available_commissions:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient available commissions. Available: {commissions.available_commissions:.2f} GMD",
        )

    # Decide destination Wave number:
    # Use the configured platform account if set; fall back to the requesting admin's number.
    recipient_wave = settings.ADMIN_COMMISSION_WAVE_NUMBER.strip() or admin_user.wave_number
    if not recipient_wave:
        raise HTTPException(
            status_code=400,
            detail="No payout Wave number configured. Set ADMIN_COMMISSION_WAVE_NUMBER in .env or update your profile.",
        )

    # Normalise to +220 format
    if not recipient_wave.startswith("+220"):
        recipient_wave = f"+220{recipient_wave.lstrip('0')}"

    # HexAI charges 2% on payouts — deduct before sending
    hexai_fee = round(request.amount * settings.HEXAI_WITHDRAWAL_FEE_PERCENT, 2)
    net_amount = round(request.amount - hexai_fee, 2)

    if net_amount <= 0:
        raise HTTPException(
            status_code=400,
            detail=f"Amount too small. After HexAI fee ({hexai_fee:.2f} GMD) you would receive {net_amount:.2f} GMD.",
        )

    withdrawal_ref = f"ADMIN-COMM-{uuid.uuid4().hex[:12].upper()}"

    # Call HexAI FIRST — don't write to DB until we know it accepted the request
    try:
        await hexai_service.initiate_payout(
            requested_amount=net_amount,
            recipient_mobile=recipient_wave,
            payout_reference=withdrawal_ref,
            recipient_name=admin_user.full_name or "Kambeng Admin",
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"HexAI payout failed: {exc}") from exc

    # Persist the payout record (PENDING until webhook confirms)
    commission_payout = Payout(
        campaign_id=None,
        client_reference=withdrawal_ref,
        gross_amount=request.amount,
        hexai_fee=hexai_fee,
        platform_commission=request.amount,
        net_amount=net_amount,
        status="PENDING",
    )
    db.add(commission_payout)
    await db.flush()

    await _log_audit_action(
        db=db,
        action_type=AuditActionType.COMMISSION_WITHDRAWAL_INITIATED,
        performed_by_admin_id=admin_user.id,
        target_entity_type="COMMISSION_WITHDRAWAL",
        target_entity_id=commission_payout.id,
        description=(
            f"Commission withdrawal of {request.amount:.2f} GMD initiated "
            f"to {recipient_wave} (net {net_amount:.2f} GMD after {hexai_fee:.2f} GMD HexAI fee)"
        ),
        details=request.reason or "No reason provided",
        new_value=withdrawal_ref,
    )

    await db.commit()

    return AdminCommissionWithdrawalResponse(
        withdrawal_id=withdrawal_ref,
        amount=request.amount,
        status="PENDING",
        created_at=datetime.now(UTC),
        message=(
            f"Payout of {net_amount:.2f} GMD initiated to {recipient_wave}. "
            f"Reference: {withdrawal_ref}"
        ),
    )


@router.get("/commissions/payout-account")
async def get_commission_payout_account(
    admin_user: User = Depends(get_admin_user),
):
    """Return the Wave number that will receive commission withdrawals."""
    configured = settings.ADMIN_COMMISSION_WAVE_NUMBER.strip()
    wave = configured or admin_user.wave_number or ""
    return {
        "wave_number": wave,
        "source": "config" if configured else "admin_profile",
        "admin_name": admin_user.full_name,
    }
