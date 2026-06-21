from typing import List, Optional
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import cast, String

from app.api.routes.auth import get_admin_user
from app.api.routes.auth import get_current_user_optional
from app.db.database import get_db
from app.models.moderation import ModerationReport, ReportStatus, ReportEntityType
from app.models.user import User
from app.models.campaign import Campaign
from app.models.campaign_update import CampaignUpdate
from app.models.review import Review
from app.models.audit_log import AdminAuditLog, AuditActionType
from app.schemas.moderation import ModerationReportCreate, ModerationReportRead, ModerationReportResolve
from app.services.email_service import send_email, render_moderation_warning_email
from app.core.config import settings
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
    
    # Apply side effects based on action_taken
    warn_user: Optional[User] = None  # set when action is user_warned, used to send email after commit

    if resolution.action_taken == "campaign_suspended" and report.campaign_id:
        campaign_result = await db.execute(select(Campaign).where(Campaign.id == report.campaign_id))
        campaign = campaign_result.scalars().first()
        if campaign:
            campaign.status = "SUSPENDED"

    elif resolution.action_taken in ("user_suspended", "user_warned"):
        # Resolve the target user from entity type (shared for both actions)
        target_user_id: Optional[int] = None
        if report.reported_entity_type == ReportEntityType.USER:
            target_user_id = report.reported_entity_id
        elif report.campaign_id:
            camp_res = await db.execute(select(Campaign).where(Campaign.id == report.campaign_id))
            camp = camp_res.scalars().first()
            if camp:
                target_user_id = camp.user_id
        elif report.reported_entity_type == ReportEntityType.UPDATE:
            upd_res = await db.execute(select(CampaignUpdate).where(CampaignUpdate.id == report.reported_entity_id))
            upd = upd_res.scalars().first()
            if upd:
                target_user_id = upd.user_id
        elif report.reported_entity_type == ReportEntityType.REVIEW:
            rev_res = await db.execute(select(Review).where(Review.id == report.reported_entity_id))
            rev = rev_res.scalars().first()
            if rev:
                target_user_id = rev.user_id

        if target_user_id:
            usr_res = await db.execute(select(User).where(User.id == target_user_id))
            found_user = usr_res.scalars().first()
            if found_user:
                if resolution.action_taken == "user_suspended":
                    found_user.is_active = False
                else:
                    warn_user = found_user

    elif resolution.action_taken == "content_removed":
        if report.reported_entity_type == ReportEntityType.UPDATE:
            upd_res = await db.execute(select(CampaignUpdate).where(CampaignUpdate.id == report.reported_entity_id))
            upd = upd_res.scalars().first()
            if upd:
                await db.delete(upd)
        elif report.reported_entity_type == ReportEntityType.REVIEW:
            rev_res = await db.execute(select(Review).where(Review.id == report.reported_entity_id))
            rev = rev_res.scalars().first()
            if rev:
                await db.delete(rev)

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

    # Send warning email after all DB work is done
    if warn_user and warn_user.email:
        reason_label = report.reason.value.replace("_", " ").capitalize()
        warning_message = resolution.moderation_note or ""
        dashboard_link = f"{settings.FRONTEND_URL.rstrip('/')}/dashboard"
        html = render_moderation_warning_email(
            full_name=warn_user.full_name or warn_user.email,
            reason=reason_label,
            warning_message=warning_message,
            dashboard_link=dashboard_link,
        )
        send_email(warn_user.email, "Account Warning — Kambeng", html)

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


from app.models.fraud_report import FraudReport  # noqa: E402
from fastapi import Query  # noqa: E402


@router.get("/fraud-reports/queue")
async def list_fraud_reports(
    db: AsyncSession = Depends(get_db),
    _admin_user: User = Depends(get_admin_user),
):
    """List all fraud reports for admin review."""
    result = await db.execute(select(FraudReport).order_by(FraudReport.created_at.desc()))
    reports = result.scalars().all()
    return [
        {
            "id": r.id,
            "campaign_id": r.campaign_id,
            "reported_by_user_id": r.reported_by_user_id,
            "reason": r.reason,
            "details": r.details,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in reports
    ]


@router.post("/fraud-reports/{report_id}/resolve")
async def resolve_fraud_report(
    report_id: int,
    action: str = Query(...),
    db: AsyncSession = Depends(get_db),
    _admin_user: User = Depends(get_admin_user),
):
    """Resolve a fraud report with the given action."""
    result = await db.execute(select(FraudReport).where(FraudReport.id == report_id))
    report = result.scalars().first()
    if not report:
        raise HTTPException(status_code=404, detail="Fraud report not found")

    report.status = "ACTIONED" if action in ("suspend_campaign", "ban_user", "remove_content") else "REVIEWED"
    await db.commit()
    await db.refresh(report)

    return {
        "id": report.id,
        "campaign_id": report.campaign_id,
        "reported_by_user_id": report.reported_by_user_id,
        "reason": report.reason,
        "details": report.details,
        "status": report.status,
        "created_at": report.created_at.isoformat() if report.created_at else None,
    }
