import logging
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.db.database import engine as async_engine
from app.models.kyc import KYC, KYCStatus
from app.models.kyc_notification_email import KYCNotificationEmail
from app.models.user import User
from app.services.email_service import render_kyc_pending_reminder, send_email

logger = logging.getLogger(__name__)

PENDING_STATUSES = [KYCStatus.SUBMITTED.value, KYCStatus.REVIEWING.value]


async def send_pending_kyc_reminders() -> None:
    """Email active KYC notification recipients a digest of submissions still awaiting review."""
    AsyncSessionLocal = sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(KYC, User)
            .join(User, KYC.user_id == User.id)
            .where(KYC.status.in_(PENDING_STATUSES))
            .order_by(KYC.created_at.asc())
        )
        rows = result.all()
        if not rows:
            logger.info("No pending KYC submissions; skipping reminder emails", extra={"action": "kyc_pending_reminder"})
            return

        recipients_result = await session.execute(
            select(KYCNotificationEmail).where(KYCNotificationEmail.is_active.is_(True))
        )
        recipients = recipients_result.scalars().all()
        if not recipients:
            logger.warning(
                "Pending KYC submissions exist but no active notification recipients are configured",
                extra={"action": "kyc_pending_reminder", "pending_count": len(rows)},
            )
            return

    frontend = settings.FRONTEND_URL.rstrip("/")
    now = datetime.now(UTC)
    submissions = []
    for kyc, user in rows:
        created_at = kyc.created_at
        if created_at is not None and created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=UTC)
        days_pending = (now - created_at).days if created_at else 0
        submissions.append(
            {
                "full_name": user.full_name or "(no name)",
                "user_email": user.email,
                "document_type": kyc.document_type,
                "status": kyc.status,
                "days_pending": days_pending,
                "review_link": f"{frontend}/admin/kyc-queue/{kyc.id}/review",
            }
        )

    count = len(submissions)
    subject = f"Reminder: {count} KYC submission{'s' if count != 1 else ''} awaiting review"
    html = render_kyc_pending_reminder(
        pending_count=count,
        submissions=submissions,
        queue_link=f"{frontend}/admin/kyc-queue",
    )

    sent = 0
    for recipient in recipients:
        try:
            if send_email(recipient.email, subject, html):
                sent += 1
        except Exception:
            logger.exception(
                "Failed to send pending KYC reminder",
                extra={"action": "kyc_pending_reminder", "recipient": recipient.email},
            )

    logger.info(
        "Pending KYC reminders sent",
        extra={"action": "kyc_pending_reminder", "pending_count": count, "recipients_notified": sent},
    )
