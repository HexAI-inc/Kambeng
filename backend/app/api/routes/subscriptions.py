from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.routes.auth import get_current_user
from app.db.database import get_db
from app.models.campaign import Campaign
from app.models.campaign_subscription import CampaignSubscription
from app.models.user import User
from app.core.logging_config import get_logger

router = APIRouter(tags=["Campaign Subscriptions"])
logger = get_logger("subscriptions")


async def _get_campaign(db: AsyncSession, slug: str) -> Campaign:
    result = await db.execute(select(Campaign).where(Campaign.slug == slug))
    campaign = result.scalars().first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


@router.post("/campaigns/{slug}/subscribe", status_code=status.HTTP_201_CREATED)
async def subscribe_to_campaign(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Follow a campaign: receive its updates by email. Idempotent."""
    campaign = await _get_campaign(db, slug)

    existing = await db.execute(
        select(CampaignSubscription).where(
            CampaignSubscription.user_id == current_user.id,
            CampaignSubscription.campaign_id == campaign.id,
        )
    )
    if existing.scalars().first():
        return {"subscribed": True, "campaign_id": campaign.id}

    db.add(CampaignSubscription(user_id=current_user.id, campaign_id=campaign.id))
    await db.commit()
    logger.info(
        "Campaign subscription created",
        extra={"action": "campaign_subscribe", "user_id": current_user.id, "campaign_id": campaign.id},
    )
    return {"subscribed": True, "campaign_id": campaign.id}


@router.delete("/campaigns/{slug}/subscribe")
async def unsubscribe_from_campaign(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stop following a campaign. Idempotent."""
    campaign = await _get_campaign(db, slug)

    result = await db.execute(
        select(CampaignSubscription).where(
            CampaignSubscription.user_id == current_user.id,
            CampaignSubscription.campaign_id == campaign.id,
        )
    )
    subscription = result.scalars().first()
    if subscription:
        await db.delete(subscription)
        await db.commit()
        logger.info(
            "Campaign subscription removed",
            extra={"action": "campaign_unsubscribe", "user_id": current_user.id, "campaign_id": campaign.id},
        )
    return {"subscribed": False, "campaign_id": campaign.id}


@router.get("/campaigns/{slug}/subscription")
async def get_subscription_status(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    campaign = await _get_campaign(db, slug)
    result = await db.execute(
        select(CampaignSubscription).where(
            CampaignSubscription.user_id == current_user.id,
            CampaignSubscription.campaign_id == campaign.id,
        )
    )
    return {"subscribed": result.scalars().first() is not None, "campaign_id": campaign.id}


@router.get("/me/subscriptions")
async def list_my_subscriptions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Campaigns the logged-in user follows."""
    result = await db.execute(
        select(CampaignSubscription, Campaign)
        .join(Campaign, CampaignSubscription.campaign_id == Campaign.id)
        .where(CampaignSubscription.user_id == current_user.id)
        .order_by(CampaignSubscription.created_at.desc())
    )
    return [
        {
            "campaign_id": campaign.id,
            "campaign_title": campaign.title,
            "campaign_slug": campaign.slug,
            "campaign_status": campaign.status.value if hasattr(campaign.status, "value") else campaign.status,
            "cover_image_url": campaign.cover_image_url,
            "subscribed_at": subscription.created_at.isoformat() if subscription.created_at else None,
        }
        for subscription, campaign in result.all()
    ]
