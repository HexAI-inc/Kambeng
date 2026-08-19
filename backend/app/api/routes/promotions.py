"""Promotions engine routes.

Admin: create/list/update promotions, view applications, assign a campaign
to a promo (cap-enforced). Public: active-promo badge for a campaign,
a user's referral code + share link, and share-click tracking for the
Campaign Champion attribution window.
"""

import secrets
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.auth import get_admin_user, get_current_user
from app.core.config import settings
from app.core.logging_config import get_logger
from app.db.database import get_db
from app.models.campaign import Campaign
from app.models.promotion import PromoApplication, Promotion, PromoType
from app.models.referral import CampaignShareClick
from app.models.user import User
from app.schemas.promotion import (
    ActivePromoResponse,
    AssignPromoRequest,
    PromoApplicationListResponse,
    PromoApplicationRead,
    PromotionCreate,
    PromotionListResponse,
    PromotionRead,
    PromotionUpdate,
    RecordShareClickRequest,
    ReferralInfoResponse,
)
from app.services.promotions import ensure_referral_code, is_promo_live

router = APIRouter(tags=["Promotions"])
logger = get_logger("promotions")


async def _get_campaign_or_404(db: AsyncSession, slug: str) -> Campaign:
    result = await db.execute(select(Campaign).where(Campaign.slug == slug))
    campaign = result.scalars().first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


def _with_total_waived(promo: Promotion, totals: dict[int, float]) -> PromotionRead:
    item = PromotionRead.model_validate(promo)
    item.total_fee_waived = round(totals.get(promo.id, 0.0), 2)
    return item


# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------


@router.post("/admin/promotions", response_model=PromotionRead, status_code=status.HTTP_201_CREATED)
async def create_promotion(
    payload: PromotionCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    existing = await db.execute(select(Promotion).where(Promotion.slug == payload.slug))
    if existing.scalars().first():
        raise HTTPException(status_code=409, detail=f"A promotion with slug {payload.slug!r} already exists")

    promo = Promotion(
        slug=payload.slug,
        name=payload.name,
        promo_type=payload.promo_type.value,
        description=payload.description,
        fee_waiver_pct=payload.fee_waiver_pct,
        rebate_pct=payload.rebate_pct,
        match_pool_total=payload.match_pool_total,
        match_pool_remaining=payload.match_pool_total,
        match_ratio=payload.match_ratio,
        max_campaigns=payload.max_campaigns,
        category_filter=payload.category_filter,
        requires_first_donation=payload.requires_first_donation,
        requires_organiser_type=payload.requires_organiser_type,
        starts_at=payload.starts_at or datetime.now(UTC),
        ends_at=payload.ends_at,
        is_active=payload.is_active,
        created_by=admin.id,
    )
    db.add(promo)
    await db.commit()
    await db.refresh(promo)
    logger.info("Promotion created", extra={"action": "promo_created", "promotion_id": promo.id, "promo_type": promo.promo_type, "admin_id": admin.id})
    return _with_total_waived(promo, {})


@router.get("/admin/promotions", response_model=PromotionListResponse)
async def list_promotions(
    is_active: bool | None = None,
    promo_type: PromoType | None = None,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    filters = []
    if is_active is not None:
        filters.append(Promotion.is_active.is_(is_active))
    if promo_type is not None:
        filters.append(Promotion.promo_type == promo_type.value)

    total_result = await db.execute(select(func.count(Promotion.id)).where(*filters))
    total = total_result.scalar() or 0

    rows_result = await db.execute(select(Promotion).where(*filters).order_by(Promotion.created_at.desc()))
    promos = rows_result.scalars().all()

    totals_result = await db.execute(
        select(PromoApplication.promotion_id, func.sum(PromoApplication.fee_waived_amount))
        .where(PromoApplication.reversed.is_(False))
        .group_by(PromoApplication.promotion_id)
    )
    totals = {promo_id: amount or 0.0 for promo_id, amount in totals_result.all()}

    return PromotionListResponse(total=total, items=[_with_total_waived(p, totals) for p in promos])


@router.get("/admin/promotions/{promo_id}", response_model=PromotionRead)
async def get_promotion_detail(
    promo_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    result = await db.execute(select(Promotion).where(Promotion.id == promo_id))
    promo = result.scalars().first()
    if not promo:
        raise HTTPException(status_code=404, detail="Promotion not found")
    total_result = await db.execute(
        select(func.sum(PromoApplication.fee_waived_amount)).where(
            PromoApplication.promotion_id == promo_id, PromoApplication.reversed.is_(False)
        )
    )
    return _with_total_waived(promo, {promo_id: total_result.scalar() or 0.0})


@router.patch("/admin/promotions/{promo_id}", response_model=PromotionRead)
async def update_promotion(
    promo_id: int,
    payload: PromotionUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    result = await db.execute(select(Promotion).where(Promotion.id == promo_id))
    promo = result.scalars().first()
    if not promo:
        raise HTTPException(status_code=404, detail="Promotion not found")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(promo, field, value)

    await db.commit()
    await db.refresh(promo)
    logger.info(
        "Promotion updated",
        extra={"action": "promo_updated", "promotion_id": promo.id, "admin_id": admin.id, "fields": list(updates.keys())},
    )
    total_result = await db.execute(
        select(func.sum(PromoApplication.fee_waived_amount)).where(
            PromoApplication.promotion_id == promo_id, PromoApplication.reversed.is_(False)
        )
    )
    return _with_total_waived(promo, {promo_id: total_result.scalar() or 0.0})


@router.get("/admin/promotions/{promo_id}/applications", response_model=PromoApplicationListResponse)
async def list_promo_applications(
    promo_id: int,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    total_result = await db.execute(select(func.count(PromoApplication.id)).where(PromoApplication.promotion_id == promo_id))
    total = total_result.scalar() or 0

    rows_result = await db.execute(
        select(PromoApplication, Campaign.title)
        .outerjoin(Campaign, PromoApplication.campaign_id == Campaign.id)
        .where(PromoApplication.promotion_id == promo_id)
        .order_by(PromoApplication.applied_at.desc())
        .limit(limit)
        .offset(offset)
    )
    items = []
    for application, campaign_title in rows_result.all():
        item = PromoApplicationRead.model_validate(application)
        item.campaign_title = campaign_title
        items.append(item)
    return PromoApplicationListResponse(total=total, items=items)


@router.post("/admin/campaigns/{campaign_id}/assign-promo", response_model=PromotionRead)
async def assign_campaign_to_promotion(
    campaign_id: int,
    payload: AssignPromoRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Manually curate a campaign onto a promo (e.g. Founding Campaigns).
    Cap enforcement uses a row lock so two concurrent assignments can't both
    slip past a nearly-full cap (§7.3)."""
    campaign_result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = campaign_result.scalars().first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    promo_result = await db.execute(select(Promotion).where(Promotion.id == payload.promotion_id).with_for_update())
    promo = promo_result.scalars().first()
    if not promo:
        raise HTTPException(status_code=404, detail="Promotion not found")
    if not is_promo_live(promo):
        raise HTTPException(status_code=400, detail="This promotion is not currently active")
    if promo.max_campaigns is not None and promo.campaigns_used >= promo.max_campaigns:
        raise HTTPException(status_code=409, detail=f"Promotion cap reached ({promo.campaigns_used}/{promo.max_campaigns})")

    was_already_assigned = campaign.active_promo_id == promo.id
    campaign.active_promo_id = promo.id
    if not was_already_assigned:
        promo.campaigns_used += 1

    await db.commit()
    await db.refresh(promo)
    logger.info(
        "Campaign assigned to promotion",
        extra={"action": "promo_assigned", "promotion_id": promo.id, "campaign_id": campaign.id, "admin_id": admin.id},
    )
    total_result = await db.execute(
        select(func.sum(PromoApplication.fee_waived_amount)).where(
            PromoApplication.promotion_id == promo.id, PromoApplication.reversed.is_(False)
        )
    )
    return _with_total_waived(promo, {promo.id: total_result.scalar() or 0.0})


# ---------------------------------------------------------------------------
# Public
# ---------------------------------------------------------------------------


@router.get("/campaigns/{slug}/active-promo", response_model=ActivePromoResponse)
async def get_campaign_active_promo(slug: str, db: AsyncSession = Depends(get_db)):
    campaign = await _get_campaign_or_404(db, slug)

    promo: Promotion | None = None
    if campaign.active_promo_id:
        result = await db.execute(select(Promotion).where(Promotion.id == campaign.active_promo_id))
        candidate = result.scalars().first()
        if candidate and is_promo_live(candidate):
            promo = candidate

    if promo is None:
        # A platform-wide matched-donation pool also shows on every campaign page.
        from app.services.promotions import get_active_promo_by_type

        promo = await get_active_promo_by_type(db, PromoType.MATCHED_DONATION)

    if promo is None:
        return ActivePromoResponse(active=False)

    return ActivePromoResponse(
        active=True,
        promo_type=promo.promo_type,
        name=promo.name,
        fee_waiver_pct=promo.fee_waiver_pct,
        match_pool_total=promo.match_pool_total,
        match_pool_remaining=promo.match_pool_remaining,
        match_ratio=promo.match_ratio,
        ends_at=promo.ends_at,
    )


@router.post("/campaigns/{slug}/share-click", status_code=status.HTTP_201_CREATED)
async def record_share_click(slug: str, payload: RecordShareClickRequest, db: AsyncSession = Depends(get_db)):
    campaign = await _get_campaign_or_404(db, slug)
    db.add(CampaignShareClick(campaign_id=campaign.id, referral_code=payload.referral_code))
    await db.commit()
    return {"recorded": True}


@router.get("/users/me/referral-code", response_model=ReferralInfoResponse)
async def get_my_referral_code(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    code = await ensure_referral_code(db, current_user)
    await db.commit()
    return ReferralInfoResponse(
        referral_code=code,
        share_link=f"{settings.FRONTEND_URL.rstrip('/')}/start?ref={code}",
    )
