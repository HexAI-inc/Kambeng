from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.db.database import get_db
from app.models.campaign import Campaign, CampaignStatus
from app.models.user import User
from app.schemas.profile import PublicProfileCampaign, PublicProfileRead

router = APIRouter(prefix="/profiles", tags=["Public Profiles"])

# Campaign states that are publicly visible on an organizer's profile
PUBLIC_CAMPAIGN_STATUSES = [CampaignStatus.ACTIVE, CampaignStatus.CLOSED]


@router.get("/{user_id}", response_model=PublicProfileRead)
async def get_public_profile(user_id: int, db: AsyncSession = Depends(get_db)):
    """Public organizer profile: who they are, whether they're KYC-verified,
    and the campaigns they run. No contact details are exposed."""
    result = await db.execute(select(User).where(User.id == user_id, User.is_active.is_(True)))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Profile not found")

    campaigns_result = await db.execute(
        select(Campaign)
        .where(Campaign.user_id == user.id, Campaign.status.in_(PUBLIC_CAMPAIGN_STATUSES))
        .order_by(Campaign.created_at.desc())
    )
    campaigns = campaigns_result.scalars().all()

    return PublicProfileRead(
        id=user.id,
        full_name=user.full_name,
        bio=user.bio,
        kyc_verified=user.kyc_status == "APPROVED",
        member_since=user.created_at,
        campaigns=[PublicProfileCampaign.model_validate(c) for c in campaigns],
    )
