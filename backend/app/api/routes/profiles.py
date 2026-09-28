from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.routes.auth import get_current_user, get_current_user_optional
from app.db.database import get_db
from app.models.campaign import Campaign, CampaignStatus
from app.models.donation import Donation
from app.models.user import User
from app.models.user_follow import UserFollow
from app.schemas.profile import (
    FollowedProfile,
    HandleAvailability,
    PublicProfileCampaign,
    PublicProfileRead,
    SupportedCampaign,
)
from app.services.donor_identity import is_attributed
from app.services.profile_handles import handle_problem, normalize_handle

router = APIRouter(prefix="/profiles", tags=["Public Profiles"])

# Campaign states that are publicly visible on an organizer's profile
PUBLIC_CAMPAIGN_STATUSES = [CampaignStatus.ACTIVE, CampaignStatus.CLOSED]
MAX_SUPPORTED_CAMPAIGNS = 12


async def _get_active_user(db: AsyncSession, user_id: int) -> User:
    result = await db.execute(select(User).where(User.id == user_id, User.is_active.is_(True)))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Profile not found")
    return user


async def _supported_campaigns(db: AsyncSession, user: User) -> list[SupportedCampaign]:
    """Public campaigns (not their own) the user gave to under their own name,
    most recent gift first."""
    rows = (await db.execute(
        select(Donation, Campaign)
        .join(Campaign, Campaign.id == Donation.campaign_id)
        .where(
            Donation.user_id == user.id,
            Donation.status == "SUCCEEDED",
            Campaign.status.in_(PUBLIC_CAMPAIGN_STATUSES),
            Campaign.user_id != user.id,
        )
        .order_by(Donation.created_at.desc())
    )).all()
    # Attribution is checked in Python so it matches the supporters list exactly
    seen: dict[int, Campaign] = {}
    for donation, campaign in rows:
        if campaign.id not in seen and is_attributed(donation, user):
            seen[campaign.id] = campaign
            if len(seen) == MAX_SUPPORTED_CAMPAIGNS:
                break
    return [SupportedCampaign.model_validate(c) for c in seen.values()]


# Literal paths are declared before /{user_id} so they aren't swallowed by it.

@router.get("/me/following", response_model=list[FollowedProfile])
async def list_my_following(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Organizers the current user follows, most recent first."""
    rows = (await db.execute(
        select(User, UserFollow.created_at)
        .join(UserFollow, UserFollow.followed_id == User.id)
        .where(UserFollow.follower_id == current_user.id, User.is_active.is_(True))
        .order_by(UserFollow.created_at.desc())
    )).all()
    return [
        FollowedProfile(
            id=u.id, full_name=u.full_name, handle=u.handle, avatar_url=u.avatar_url,
            kyc_verified=u.kyc_status == "APPROVED", followed_at=followed_at,
        )
        for u, followed_at in rows
    ]


@router.get("/handle-available", response_model=HandleAvailability)
async def check_handle_available(
    handle: str = Query(..., max_length=40),
    db: AsyncSession = Depends(get_db),
    viewer: User | None = Depends(get_current_user_optional),
):
    """Live check for the handle picker. Your own current handle counts as available."""
    normalized = normalize_handle(handle)
    if problem := handle_problem(normalized):
        return HandleAvailability(handle=normalized, available=False, reason=problem)
    owner = (await db.execute(select(User.id).where(User.handle == normalized))).scalar_one_or_none()
    if owner is not None and (viewer is None or owner != viewer.id):
        return HandleAvailability(handle=normalized, available=False, reason="That handle is already taken")
    return HandleAvailability(handle=normalized, available=True)


@router.get("/handle/{handle}", response_model=PublicProfileRead)
async def get_public_profile_by_handle(
    handle: str,
    db: AsyncSession = Depends(get_db),
    viewer: User | None = Depends(get_current_user_optional),
):
    """Same as GET /profiles/{user_id}, looked up by custom handle (kambeng.gm/@handle)."""
    result = await db.execute(
        select(User).where(User.handle == normalize_handle(handle), User.is_active.is_(True))
    )
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Profile not found")
    return await _build_public_profile(db, user, viewer)


@router.get("/{user_id}", response_model=PublicProfileRead)
async def get_public_profile(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    viewer: User | None = Depends(get_current_user_optional),
):
    """Public organizer profile: who they are, whether they're KYC-verified,
    and the campaigns they run. No contact details are exposed."""
    return await _build_public_profile(db, await _get_active_user(db, user_id), viewer)


async def _build_public_profile(db: AsyncSession, user: User, viewer: User | None) -> PublicProfileRead:
    campaigns_result = await db.execute(
        select(Campaign)
        .where(Campaign.user_id == user.id, Campaign.status.in_(PUBLIC_CAMPAIGN_STATUSES))
        .order_by(Campaign.created_at.desc())
    )
    campaigns = campaigns_result.scalars().all()

    supporters_count = 0
    if campaigns:
        supporters_count = (await db.execute(
            select(func.count(Donation.id)).where(
                Donation.campaign_id.in_([c.id for c in campaigns]),
                Donation.status == "SUCCEEDED",
            )
        )).scalar_one()

    followers_count = (await db.execute(
        select(func.count(UserFollow.id)).where(UserFollow.followed_id == user.id)
    )).scalar_one()
    is_following = False
    if viewer and viewer.id != user.id:
        is_following = (await db.execute(
            select(UserFollow.id).where(UserFollow.follower_id == viewer.id, UserFollow.followed_id == user.id)
        )).first() is not None

    return PublicProfileRead(
        id=user.id,
        full_name=user.full_name,
        handle=user.handle,
        bio=user.bio,
        avatar_url=user.avatar_url,
        cover_url=user.cover_url,
        favorite_causes=user.favorite_causes or [],
        location=user.location,
        social_links=user.social_links or {},
        kyc_verified=user.kyc_status == "APPROVED",
        member_since=user.created_at,
        total_raised=sum(c.amount_raised or 0 for c in campaigns),
        supporters_count=supporters_count,
        followers_count=followers_count,
        is_following=is_following,
        supported_campaigns=await _supported_campaigns(db, user) if user.show_supported_campaigns else [],
        campaigns=[PublicProfileCampaign.model_validate(c) for c in campaigns],
    )


@router.post("/{user_id}/follow", status_code=status.HTTP_204_NO_CONTENT)
async def follow_profile(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Follow an organizer to be emailed when they launch a campaign. Idempotent."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You can't follow yourself")
    await _get_active_user(db, user_id)

    existing = await db.execute(
        select(UserFollow.id).where(UserFollow.follower_id == current_user.id, UserFollow.followed_id == user_id)
    )
    if existing.first() is None:
        db.add(UserFollow(follower_id=current_user.id, followed_id=user_id))
        try:
            await db.commit()
        except IntegrityError:  # a concurrent request already followed
            await db.rollback()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/{user_id}/follow", status_code=status.HTTP_204_NO_CONTENT)
async def unfollow_profile(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(UserFollow).where(UserFollow.follower_id == current_user.id, UserFollow.followed_id == user_id)
    )
    follow = result.scalars().first()
    if follow:
        await db.delete(follow)
        await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
