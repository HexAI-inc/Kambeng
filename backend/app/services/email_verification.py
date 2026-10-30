"""Admin-sent email verification: a one-click link instead of a 10-minute code.

Users who never verified are nudged by an admin, often long after signing up,
so the email carries a signed link that stays valid for a week. The link is
tied to the address it was sent to and is useless as a login token (it has
its own token type).
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
from datetime import UTC, datetime, timedelta
from urllib.parse import quote

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_access_token
from app.models.audit_log import AdminAuditLog, AuditActionType
from app.models.user import User

logger = logging.getLogger(__name__)

LINK_VALID_FOR = timedelta(days=7)
# Don't email the same person again within this window.
RESEND_COOLDOWN = timedelta(hours=24)
# Resend accepts about two requests a second.
SEND_INTERVAL_SECONDS = 0.6
TOKEN_TYPE = "email_verify"


def email_fingerprint(email: str | None) -> str:
    return hashlib.sha256((email or "").strip().lower().encode("utf-8")).hexdigest()[:16]


def verification_link(user: User) -> str:
    token = create_access_token(
        {"sub": user.wave_number, "type": TOKEN_TYPE, "em": email_fingerprint(user.email)},
        expires_delta=LINK_VALID_FOR,
    )
    return f"{settings.FRONTEND_URL.rstrip('/')}/auth/verify-email/confirm?token={quote(token)}"


def send_verification_link(user: User) -> bool:
    from app.services.email_service import render_template, send_email

    html = render_template(
        "verify_email_link.html",
        full_name=user.full_name or "there",
        verify_url=verification_link(user),
        valid_days=LINK_VALID_FOR.days,
    )
    return send_email(user.email, "Confirm your email for Kambeng", html)


def _needs_verification(query):
    return query.where(User.is_email_verified.isnot(True), User.is_active.is_(True), User.email.isnot(None), User.email != "")


async def _recently_emailed_ids(db: AsyncSession) -> set[int]:
    since = datetime.now(UTC) - RESEND_COOLDOWN
    rows = await db.execute(
        select(AdminAuditLog.target_user_id).where(
            AdminAuditLog.action_type == AuditActionType.EMAIL_VERIFICATION_SENT.value,
            AdminAuditLog.created_at >= since,
        )
    )
    return {user_id for user_id in rows.scalars().all() if user_id}


async def unverified_summary(db: AsyncSession) -> dict:
    ids = (await db.execute(_needs_verification(select(User.id)))).scalars().all()
    recent = await _recently_emailed_ids(db)
    emailed_recently = sum(1 for i in ids if i in recent)
    return {"unverified": len(ids), "emailed_recently": emailed_recently, "will_send": len(ids) - emailed_recently}


def _audit(user: User, admin: User, *, bulk: bool) -> AdminAuditLog:
    return AdminAuditLog(
        action_type=AuditActionType.EMAIL_VERIFICATION_SENT.value,
        performed_by_admin_id=admin.id,
        target_entity_type="User",
        target_entity_id=user.id,
        target_user_id=user.id,
        description=f"Sent email verification link to {user.email}" + (" (bulk)" if bulk else ""),
    )


async def queue_bulk_verification_emails(db: AsyncSession, admin: User) -> list[int]:
    """Record who will be emailed (so a second click skips them) and return their ids."""
    recent = await _recently_emailed_ids(db)
    users = [u for u in (await db.execute(_needs_verification(select(User)))).scalars().all() if u.id not in recent]
    for user in users:
        db.add(_audit(user, admin, bulk=True))
    await db.commit()
    return [u.id for u in users]


async def send_bulk_verification_emails(user_ids: list[int]) -> None:
    """Background task: send one at a time, paced for the email provider."""
    from app.db.database import AsyncSessionLocal

    sent = failed = 0
    async with AsyncSessionLocal() as db:
        users = (await db.execute(select(User).where(User.id.in_(user_ids)))).scalars().all()
    for user in users:
        if user.is_email_verified:
            continue
        ok = await asyncio.to_thread(send_verification_link, user)
        sent += ok
        failed += not ok
        await asyncio.sleep(SEND_INTERVAL_SECONDS)
    logger.info("Bulk verification emails sent", extra={"action": "bulk_verification_emails", "sent": sent, "failed": failed})


async def send_one(db: AsyncSession, user: User, admin: User) -> bool:
    ok = await asyncio.to_thread(send_verification_link, user)
    if ok:
        db.add(_audit(user, admin, bulk=False))
        await db.commit()
    return ok
