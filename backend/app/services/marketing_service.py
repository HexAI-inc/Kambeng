"""Marketing module services: nurture sequences and campaign event emails.

Two automated sequences (per the growth playbook):
  - Donor welcome (4 emails)   — sources: homepage, campaign_follow, post_donation
  - Organiser waitlist (5 emails) — sources: waitlist, guide

`process_marketing_sequences` runs daily from the scheduler worker and sends
each confirmed subscriber the next email in their sequence once its day
offset (measured from confirmation) has passed. `sequence_stage` on the
subscriber row is the index of the next email due, so nothing is ever sent
twice.

Campaign event emails (milestone completed / campaign fully funded) fan out
to campaign followers: guest subscribers captured via the on-page follow
prompt AND registered users following via campaign_subscriptions.
"""

import logging
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.database import AsyncSessionLocal
from app.models.campaign import Campaign, CampaignStatus
from app.models.campaign_subscription import CampaignSubscription
from app.models.donation import Donation
from app.models.subscriber import DONOR_SOURCES, Subscriber, SubscriberSource
from app.models.user import User
from app.services.email_service import render_template, send_email

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class SequenceEmail:
    day: int  # days after confirmation
    template: str
    subject: str


DONOR_SEQUENCE = [
    SequenceEmail(0, "marketing_donor_1.html", "Welcome to Kambeng — here's how it works"),
    SequenceEmail(3, "marketing_donor_2.html", "What fundraising with full transparency looks like"),
    SequenceEmail(7, "marketing_donor_3.html", "Campaigns that need support this week"),
    SequenceEmail(14, "marketing_donor_4.html", "Do you know someone raising money for their community?"),
]

ORGANISER_SEQUENCE = [
    SequenceEmail(0, "marketing_waitlist_1.html", "You're on the list — here's what happens next"),
    SequenceEmail(2, "marketing_waitlist_2.html", "The #1 thing successful campaigns do differently"),
    SequenceEmail(5, "marketing_waitlist_3.html", '"Will people really trust online fundraising?"'),
    SequenceEmail(8, "marketing_waitlist_4.html", "How money actually reaches you (Wave, fees, timing)"),
    SequenceEmail(12, "marketing_waitlist_5.html", "Your campaign could be live tomorrow"),
]


def sequence_for(source: str) -> list[SequenceEmail]:
    try:
        member = SubscriberSource(source)
    except ValueError:
        return DONOR_SEQUENCE
    return DONOR_SEQUENCE if member in DONOR_SOURCES else ORGANISER_SEQUENCE


def unsubscribe_url(subscriber: Subscriber) -> str:
    return f"{settings.FRONTEND_URL.rstrip('/')}/unsubscribe?token={subscriber.unsubscribe_token}"


def _campaign_percent(campaign: Campaign) -> int:
    if not campaign.target_amount:
        return 0
    return int(round(min(campaign.amount_raised / campaign.target_amount, 1.0) * 100))


async def _sequence_context(db: AsyncSession, subscriber: Subscriber, email: SequenceEmail) -> dict | None:
    """Extra template context for sequence emails that show live data.

    Returns None when the email should be skipped entirely (e.g. no live
    campaigns to feature) — the caller still advances the stage.
    """
    context: dict = {"name": subscriber.name, "unsubscribe_url": unsubscribe_url(subscriber)}

    if email.template == "marketing_donor_2.html":
        # Feature the active campaign closest to (or past) its target.
        result = await db.execute(
            select(Campaign)
            .where(Campaign.status == CampaignStatus.ACTIVE, Campaign.target_amount.isnot(None), Campaign.target_amount > 0)
            .order_by((Campaign.amount_raised / Campaign.target_amount).desc())
            .limit(1)
        )
        featured = result.scalars().first()
        if featured:
            context.update(
                campaign_title=featured.title,
                percent_funded=_campaign_percent(featured),
                campaign_link=f"{settings.FRONTEND_URL.rstrip('/')}/campaigns/{featured.slug}",
            )

    elif email.template == "marketing_donor_3.html":
        result = await db.execute(
            select(Campaign)
            .where(Campaign.status == CampaignStatus.ACTIVE)
            .order_by(Campaign.created_at.desc())
            .limit(3)
        )
        campaigns = result.scalars().all()
        if not campaigns:
            return None  # nothing to feature; skip this email
        context["campaigns"] = [
            {
                "title": c.title,
                "description": (c.description or "")[:140],
                "percent_funded": _campaign_percent(c),
            }
            for c in campaigns
        ]

    return context


async def send_next_sequence_email(db: AsyncSession, subscriber: Subscriber) -> bool:
    """Send the subscriber's next due sequence email and advance their stage.

    Returns True if an email was sent (or intentionally skipped), False if
    nothing was due.
    """
    sequence = sequence_for(subscriber.source)
    if subscriber.sequence_stage >= len(sequence) or not subscriber.confirmed or subscriber.unsubscribed:
        return False

    email = sequence[subscriber.sequence_stage]
    reference = subscriber.confirmed_at or subscriber.created_at
    if reference is None:
        return False
    if reference.tzinfo is None:
        reference = reference.replace(tzinfo=UTC)
    if (datetime.now(UTC) - reference).days < email.day:
        return False

    context = await _sequence_context(db, subscriber, email)
    if context is not None:
        html = render_template(email.template, **context)
        if html:
            send_email(subscriber.email, email.subject, html)
            logger.info(
                "Marketing sequence email sent",
                extra={
                    "action": "marketing_sequence_sent",
                    "subscriber_id": subscriber.id,
                    "template": email.template,
                    "stage": subscriber.sequence_stage,
                },
            )
    subscriber.sequence_stage += 1
    return True


async def process_marketing_sequences() -> None:
    """Daily job: send every confirmed subscriber their next due nurture email."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Subscriber).where(
                Subscriber.confirmed.is_(True),
                Subscriber.unsubscribed.is_(False),
                Subscriber.sequence_stage < len(ORGANISER_SEQUENCE),  # upper bound of both sequences
            )
        )
        subscribers = result.scalars().all()

        # One sequence per email address: if the same address subscribed from
        # several capture points, only the earliest row drives the sequence.
        seen_emails: set[str] = set()
        sent_count = 0
        for subscriber in sorted(subscribers, key=lambda s: s.id):
            if subscriber.email in seen_emails:
                continue
            seen_emails.add(subscriber.email)
            try:
                if await send_next_sequence_email(session, subscriber):
                    sent_count += 1
            except Exception:
                logger.exception(
                    "Failed to process sequence for subscriber",
                    extra={"action": "marketing_sequence_failed", "subscriber_id": subscriber.id},
                )
        await session.commit()
        logger.info(
            "Marketing sequences processed",
            extra={"action": "marketing_sequences_done", "candidates": len(subscribers), "sent": sent_count},
        )


async def _campaign_follower_recipients(db: AsyncSession, campaign_id: int) -> list[tuple[str, str | None]]:
    """(email, unsubscribe_url|None) for everyone following a campaign, deduped."""
    recipients: dict[str, str | None] = {}

    guest_result = await db.execute(
        select(Subscriber).where(
            Subscriber.campaign_id == campaign_id,
            Subscriber.source == SubscriberSource.CAMPAIGN_FOLLOW.value,
            Subscriber.confirmed.is_(True),
            Subscriber.unsubscribed.is_(False),
        )
    )
    for subscriber in guest_result.scalars().all():
        recipients[subscriber.email] = unsubscribe_url(subscriber)

    user_result = await db.execute(
        select(User)
        .join(CampaignSubscription, CampaignSubscription.user_id == User.id)
        .where(CampaignSubscription.campaign_id == campaign_id, User.is_active.is_(True))
    )
    for user in user_result.scalars().all():
        if user.email and user.email not in recipients:
            recipients[user.email] = None

    return list(recipients.items())


async def notify_campaign_milestone(db: AsyncSession, campaign: Campaign, milestone_name: str) -> None:
    """Email campaign followers when a milestone (goal) completes."""
    campaign_link = f"{settings.FRONTEND_URL.rstrip('/')}/campaigns/{campaign.slug}"
    for email, unsub in await _campaign_follower_recipients(db, campaign.id):
        try:
            send_email(
                email,
                f"{campaign.title} just hit a milestone 🎉",
                render_template(
                    "marketing_milestone.html",
                    campaign_title=campaign.title,
                    milestone_name=milestone_name,
                    amount_raised=f"{campaign.amount_raised:,.0f}",
                    percent_funded=_campaign_percent(campaign),
                    campaign_link=campaign_link,
                    unsubscribe_url=unsub or f"{settings.FRONTEND_URL.rstrip('/')}/dashboard",
                ),
            )
        except Exception:
            logger.exception(
                "Failed to send milestone email",
                extra={"action": "marketing_milestone_failed", "campaign_id": campaign.id, "recipient": email},
            )


async def notify_campaign_completed(db: AsyncSession, campaign: Campaign) -> None:
    """Email campaign followers when a campaign reaches its target."""
    campaign_link = f"{settings.FRONTEND_URL.rstrip('/')}/campaigns/{campaign.slug}"
    donor_count_result = await db.execute(
        select(func.count(Donation.id)).where(Donation.campaign_id == campaign.id, Donation.status == "SUCCEEDED")
    )
    donor_count = donor_count_result.scalar() or 0

    for email, unsub in await _campaign_follower_recipients(db, campaign.id):
        try:
            send_email(
                email,
                f"{campaign.title} reached its goal — thank you",
                render_template(
                    "marketing_completed.html",
                    campaign_title=campaign.title,
                    amount_raised=f"{campaign.amount_raised:,.0f}",
                    donor_count=donor_count,
                    campaign_link=campaign_link,
                    unsubscribe_url=unsub or f"{settings.FRONTEND_URL.rstrip('/')}/dashboard",
                ),
            )
        except Exception:
            logger.exception(
                "Failed to send completion email",
                extra={"action": "marketing_completed_failed", "campaign_id": campaign.id, "recipient": email},
            )
