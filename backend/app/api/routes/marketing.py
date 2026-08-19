"""Marketing module routes.

Public: email capture (double opt-in), confirmation, one-click unsubscribe.
Admin:  subscriber list, capture-point stats, weekly broadcast sender.
"""

import secrets
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.auth import get_admin_user
from app.core.config import settings
from app.core.logging_config import get_logger
from app.db.database import get_db
from app.models.campaign import Campaign
from app.models.subscriber import Subscriber, SubscriberSource
from app.models.user import User
from app.schemas.subscriber import (
    BroadcastRequest,
    BroadcastResponse,
    MarketingStats,
    SubscribeRequest,
    SubscribeResponse,
    SubscriberListResponse,
    SubscriberRead,
)
from app.services.email_service import render_template, send_email
from app.services.marketing_service import send_next_sequence_email, unsubscribe_url

router = APIRouter(tags=["Marketing"])
logger = get_logger("marketing")


@router.post("/subscribe", response_model=SubscribeResponse, status_code=status.HTTP_201_CREATED)
async def subscribe(payload: SubscribeRequest, db: AsyncSession = Depends(get_db)):
    """Capture an email from one of the on-platform capture points.

    Deduplicates on (email, source, campaign) and sends a double opt-in
    confirmation email. Idempotent: re-subscribing an existing address
    returns success without creating a duplicate.
    """
    campaign_id = None
    if payload.campaign_slug:
        campaign_result = await db.execute(select(Campaign).where(Campaign.slug == payload.campaign_slug))
        campaign = campaign_result.scalars().first()
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        campaign_id = campaign.id

    if payload.source == SubscriberSource.CAMPAIGN_FOLLOW and campaign_id is None:
        raise HTTPException(status_code=422, detail="campaign_slug is required to follow a campaign")

    existing_result = await db.execute(
        select(Subscriber).where(
            Subscriber.email == payload.email,
            Subscriber.source == payload.source.value,
            Subscriber.campaign_id.is_(None) if campaign_id is None else Subscriber.campaign_id == campaign_id,
        )
    )
    existing = existing_result.scalars().first()
    if existing:
        if existing.unsubscribed:
            # Explicit re-subscribe: reset and re-confirm.
            existing.unsubscribed = False
            existing.unsubscribed_at = None
            existing.confirmed = False
            await db.commit()
            _send_confirmation(existing)
        return SubscribeResponse(subscribed=True, already_subscribed=True, message="You're already on the list.")

    subscriber = Subscriber(
        email=payload.email,
        source=payload.source.value,
        campaign_id=campaign_id,
        name=payload.name,
        phone=payload.phone,
        fundraising_goal=payload.fundraising_goal,
        confirm_token=secrets.token_urlsafe(32),
        unsubscribe_token=secrets.token_urlsafe(32),
    )
    db.add(subscriber)
    await db.commit()

    _send_confirmation(subscriber)
    logger.info(
        "Subscriber captured",
        extra={"action": "subscribe", "source": payload.source.value, "campaign_id": campaign_id},
    )
    return SubscribeResponse(subscribed=True, message="Check your inbox to confirm your subscription.")


def _send_confirmation(subscriber: Subscriber) -> None:
    confirm_url = f"{settings.FRONTEND_URL.rstrip('/')}/subscribe/confirm?token={subscriber.confirm_token}"
    html = render_template(
        "marketing_confirm.html",
        name=subscriber.name,
        confirm_url=confirm_url,
        unsubscribe_url=unsubscribe_url(subscriber),
    )
    if html:
        send_email(subscriber.email, "Confirm your Kambeng subscription", html)


@router.get("/subscribe/confirm")
async def confirm_subscription(token: str = Query(..., min_length=10), db: AsyncSession = Depends(get_db)):
    """Double opt-in confirmation. Also fires the day-0 welcome email."""
    result = await db.execute(select(Subscriber).where(Subscriber.confirm_token == token))
    subscriber = result.scalars().first()
    if not subscriber:
        raise HTTPException(status_code=404, detail="Invalid or expired confirmation link")

    if subscriber.unsubscribed:
        raise HTTPException(status_code=410, detail="This subscription was cancelled")

    if not subscriber.confirmed:
        subscriber.confirmed = True
        subscriber.confirmed_at = datetime.now(UTC)

        # Day-0 welcome — but never start a second sequence for an address
        # that is already confirmed via another capture point.
        other_confirmed = await db.execute(
            select(func.count(Subscriber.id)).where(
                Subscriber.email == subscriber.email,
                Subscriber.confirmed.is_(True),
                Subscriber.id != subscriber.id,
            )
        )
        if (other_confirmed.scalar() or 0) == 0:
            await send_next_sequence_email(db, subscriber)
        else:
            subscriber.sequence_stage = 99  # sequence already running on another row

        await db.commit()
        logger.info("Subscriber confirmed", extra={"action": "subscribe_confirm", "subscriber_id": subscriber.id})

    return {"confirmed": True, "email": subscriber.email}


@router.get("/unsubscribe")
async def unsubscribe(token: str = Query(..., min_length=10), db: AsyncSession = Depends(get_db)):
    """One-click unsubscribe. Removes the address from the whole list."""
    result = await db.execute(select(Subscriber).where(Subscriber.unsubscribe_token == token))
    subscriber = result.scalars().first()
    if not subscriber:
        raise HTTPException(status_code=404, detail="Invalid unsubscribe link")

    now = datetime.now(UTC)
    all_rows = await db.execute(select(Subscriber).where(Subscriber.email == subscriber.email))
    for row in all_rows.scalars().all():
        if not row.unsubscribed:
            row.unsubscribed = True
            row.unsubscribed_at = now
    await db.commit()
    logger.info("Subscriber unsubscribed", extra={"action": "unsubscribe", "subscriber_id": subscriber.id})
    return {"unsubscribed": True, "email": subscriber.email}


# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------


@router.get("/admin/marketing/subscribers", response_model=SubscriberListResponse)
async def list_subscribers(
    source: SubscriberSource | None = None,
    confirmed: bool | None = None,
    q: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    filters = []
    if source is not None:
        filters.append(Subscriber.source == source.value)
    if confirmed is not None:
        filters.append(Subscriber.confirmed.is_(confirmed))
    if q:
        like = f"%{q.strip().lower()}%"
        filters.append(func.lower(Subscriber.email).like(like))

    total_result = await db.execute(select(func.count(Subscriber.id)).where(*filters))
    total = total_result.scalar() or 0

    rows_result = await db.execute(
        select(Subscriber, Campaign.title)
        .outerjoin(Campaign, Subscriber.campaign_id == Campaign.id)
        .where(*filters)
        .order_by(Subscriber.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    items = []
    for subscriber, campaign_title in rows_result.all():
        item = SubscriberRead.model_validate(subscriber)
        item.campaign_title = campaign_title
        items.append(item)
    return SubscriberListResponse(total=total, items=items)


@router.get("/admin/marketing/stats", response_model=MarketingStats)
async def marketing_stats(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    week_ago = datetime.now(UTC) - timedelta(days=7)

    total = (await db.execute(select(func.count(Subscriber.id)))).scalar() or 0
    confirmed = (await db.execute(select(func.count(Subscriber.id)).where(Subscriber.confirmed.is_(True)))).scalar() or 0
    unsubscribed = (await db.execute(select(func.count(Subscriber.id)).where(Subscriber.unsubscribed.is_(True)))).scalar() or 0
    last_7 = (await db.execute(select(func.count(Subscriber.id)).where(Subscriber.created_at >= week_ago))).scalar() or 0

    by_source_rows = await db.execute(select(Subscriber.source, func.count(Subscriber.id)).group_by(Subscriber.source))
    by_source = {source: count for source, count in by_source_rows.all()}

    recent_rows = await db.execute(
        select(Subscriber.source, func.count(Subscriber.id))
        .where(Subscriber.created_at >= week_ago)
        .group_by(Subscriber.source)
    )
    last_7_by_source = {source: count for source, count in recent_rows.all()}

    return MarketingStats(
        total=total,
        confirmed=confirmed,
        unsubscribed=unsubscribed,
        last_7_days=last_7,
        by_source=by_source,
        last_7_days_by_source=last_7_by_source,
    )


@router.post("/admin/marketing/broadcast", response_model=BroadcastResponse)
async def send_broadcast(
    payload: BroadcastRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Send the weekly broadcast to the confirmed list (or a test address)."""
    paragraphs = [p.strip() for p in payload.body.splitlines() if p.strip()]

    if payload.test_recipient:
        html = render_template(
            "marketing_broadcast.html",
            heading=payload.heading,
            paragraphs=paragraphs,
            cta_label=payload.cta_label,
            cta_url=payload.cta_url,
            unsubscribe_url=f"{settings.FRONTEND_URL.rstrip('/')}",
        )
        ok = send_email(payload.test_recipient, payload.subject, html)
        return BroadcastResponse(recipients=1, sent=1 if ok else 0, failed=0 if ok else 1, test=True)

    filters = [Subscriber.confirmed.is_(True), Subscriber.unsubscribed.is_(False)]
    if payload.sources:
        filters.append(Subscriber.source.in_([s.value for s in payload.sources]))

    result = await db.execute(select(Subscriber).where(*filters).order_by(Subscriber.id.asc()))
    subscribers = result.scalars().all()

    # One email per address even if subscribed at several capture points.
    unique: dict[str, Subscriber] = {}
    for subscriber in subscribers:
        unique.setdefault(subscriber.email, subscriber)

    sent = failed = 0
    for subscriber in unique.values():
        html = render_template(
            "marketing_broadcast.html",
            heading=payload.heading,
            paragraphs=paragraphs,
            cta_label=payload.cta_label,
            cta_url=payload.cta_url,
            unsubscribe_url=unsubscribe_url(subscriber),
        )
        try:
            if send_email(subscriber.email, payload.subject, html):
                sent += 1
            else:
                failed += 1
        except Exception:
            failed += 1
            logger.exception(
                "Broadcast send failed",
                extra={"action": "broadcast_failed", "recipient": subscriber.email},
            )

    logger.info(
        "Broadcast sent",
        extra={"action": "broadcast", "admin_id": admin.id, "recipients": len(unique), "sent": sent, "failed": failed},
    )
    return BroadcastResponse(recipients=len(unique), sent=sent, failed=failed)
