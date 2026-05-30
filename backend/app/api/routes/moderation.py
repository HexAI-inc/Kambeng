from typing import List, Optional
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import cast, String

from app.api.routes.auth import get_admin_user
from app.api.routes.auth import get_current_user_optional
from app.db.database import get_db
from app.models.moderation import ModerationReport, ReportStatus
from app.models.user import User
from app.models.campaign import Campaign
from app.models.audit_log import AdminAuditLog, AuditActionType
from app.schemas.moderation import ModerationReportCreate, ModerationReportRead, ModerationReportResolve
from sqlalchemy import func
from app.core.logging_config import get_logger

router = APIRouter(prefix="/moderation", tags=["Moderation"])
logger = get_logger("moderation")


@router.post("/reports", response_model=ModerationReportRead, status_code=status.HTTP_201_CREATED)
async def submit_report(
    report_in: ModerationReportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """Submit a moderation report. Anonymous reports allowed."""
    
    # Create report (no user requirement)
    new_report = ModerationReport(
        reported_entity_type=report_in.reported_entity_type,
        reported_entity_id=report_in.reported_entity_id,
        campaign_id=report_in.campaign_id,
        reported_by_user_id=current_user.id if current_user else None,
        reason=report_in.reason,
        description=report_in.description,
        status=ReportStatus.OPEN
    )
    db.add(new_report)
    await db.commit()
    await db.refresh(new_report)
    logger.info(
        "Moderation report submitted",
        extra={
            "action": "submit_report",
            "report_id": new_report.id,
            "reported_entity_type": report_in.reported_entity_type,
            "reported_entity_id": report_in.reported_entity_id,
            "campaign_id": report_in.campaign_id,
        },
    )
    
    return new_report


@router.get("/reports/queue", response_model=List[ModerationReportRead])
async def get_moderation_queue(
    status_filter: Optional[str] = Query(default="OPEN"),
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _admin_user: User = Depends(get_admin_user),
):
    """Get moderation queue for admin review."""
    query = select(ModerationReport)
    
    if status_filter:
        query = query.where(cast(ModerationReport.status, String) == status_filter.upper())
    
    result = await db.execute(query.order_by(ModerationReport.created_at.asc()).offset(skip).limit(limit))
    return result.scalars().all()


@router.get("/reports/{report_id}", response_model=ModerationReportRead)
async def get_report(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    _admin_user: User = Depends(get_admin_user),
):
    """Get details of a specific report."""
    result = await db.execute(select(ModerationReport).where(ModerationReport.id == report_id))
    report = result.scalars().first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@router.post("/reports/{report_id}/resolve", response_model=ModerationReportRead)
async def resolve_report(
    report_id: int,
    resolution: ModerationReportResolve,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user),
):
    """Resolve a moderation report with action."""
    result = await db.execute(select(ModerationReport).where(ModerationReport.id == report_id))
    report = result.scalars().first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Update report
    report.status = resolution.status
    report.moderation_note = resolution.moderation_note
    report.resolved_by_admin_id = admin_user.id
    report.resolved_at = datetime.now(UTC)
    report.action_taken = resolution.action_taken
    
    # If resolving with campaign suspension action, suspend the campaign
    if resolution.action_taken == "campaign_suspended" and report.campaign_id:
        campaign_result = await db.execute(select(Campaign).where(Campaign.id == report.campaign_id))
        campaign = campaign_result.scalars().first()
        if campaign:
            campaign.status = "SUSPENDED"
    
    await db.commit()
    await db.refresh(report)
    
    # Log to audit trail
    audit_log = AdminAuditLog(
        action_type=AuditActionType.CAMPAIGN_SUSPENDED.value if resolution.action_taken == "campaign_suspended" else "MODERATION_ACTION",
        performed_by_admin_id=admin_user.id,
        target_entity_type="ModerationReport",
        target_entity_id=report.id,
        campaign_id=report.campaign_id,
        description=f"Moderation report resolved: {report.reason.value}",
        details=resolution.moderation_note,
        new_value=resolution.action_taken or "dismissed"
    )
    db.add(audit_log)
    await db.commit()

    logger.info(
        "Moderation report resolved",
        extra={
            "action": "resolve_report",
            "admin_user_id": admin_user.id,
            "admin_email": admin_user.email,
            "report_id": report.id,
            "status": resolution.status,
            "action_taken": resolution.action_taken,
            "campaign_id": report.campaign_id,
        },
    )
    
    return report


@router.get("/stats", status_code=200)
async def get_moderation_stats(
    db: AsyncSession = Depends(get_db),
    _admin_user: User = Depends(get_admin_user),
):
    """Get overall moderation statistics."""
    # Total reports
    total_result = await db.execute(select(func.count(ModerationReport.id)))
    total_reports = total_result.scalar() or 0
    
    # Open reports
    open_result = await db.execute(
        select(func.count(ModerationReport.id)).where(cast(ModerationReport.status, String) == ReportStatus.OPEN.value)
    )
    open_reports = open_result.scalar() or 0
    
    # Resolved reports
    resolved_result = await db.execute(
        select(func.count(ModerationReport.id)).where(cast(ModerationReport.status, String) == ReportStatus.RESOLVED.value)
    )
    resolved_reports = resolved_result.scalar() or 0
    
    # Dismissed reports
    dismissed_result = await db.execute(
        select(func.count(ModerationReport.id)).where(cast(ModerationReport.status, String) == ReportStatus.DISMISSED.value)
    )
    dismissed_reports = dismissed_result.scalar() or 0
    
    return {
        "total_reports": total_reports,
        "open_reports": open_reports,
        "resolved_reports": resolved_reports,
        "dismissed_reports": dismissed_reports,
    }
