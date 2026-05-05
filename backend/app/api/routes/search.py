from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import String, cast, func, literal, or_, select, union_all
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.auth import get_admin_user
from app.db.database import get_db
from app.models.campaign import Campaign
from app.models.donation import Donation
from app.models.kyc import KYC
from app.models.moderation import ModerationReport
from app.models.payout import Payout
from app.models.review import Review
from app.models.user import User

router = APIRouter(prefix="/search", tags=["Search"])

SUPPORTED_MODELS = {
    "campaigns",
    "users",
    "donations",
    "reviews",
    "payouts",
    "kyc",
    "moderation",
}


def _parse_models(models: Optional[str]) -> list[str]:
    if not models:
        return sorted(SUPPORTED_MODELS)

    selected = [m.strip().lower() for m in models.split(",") if m.strip()]
    invalid = [m for m in selected if m not in SUPPORTED_MODELS]
    if invalid:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid models: {', '.join(invalid)}. Supported: {', '.join(sorted(SUPPORTED_MODELS))}",
        )
    return selected


@router.get("")
async def global_search(
    q: Optional[str] = Query(default=None, description="Text query to search across models"),
    models: Optional[str] = Query(
        default=None,
        description="Comma-separated model list: campaigns,users,donations,reviews,payouts,kyc,moderation",
    ),
    status: Optional[str] = Query(default=None, description="Optional status filter (case-insensitive)"),
    start_date: Optional[datetime] = Query(default=None),
    end_date: Optional[datetime] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _admin_user: User = Depends(get_admin_user),
):
    selected_models = _parse_models(models)
    normalized_status = status.upper() if status else None

    queries = []

    if "campaigns" in selected_models:
        campaign_q = select(
            literal("campaign").label("model"),
            cast(Campaign.id, String).label("entity_id"),
            Campaign.title.label("title"),
            Campaign.slug.label("subtitle"),
            cast(Campaign.status, String).label("status"),
            Campaign.created_at.label("created_at"),
        )
        if q:
            campaign_q = campaign_q.where(
                or_(
                    Campaign.title.ilike(f"%{q}%"),
                    Campaign.slug.ilike(f"%{q}%"),
                    Campaign.description.ilike(f"%{q}%"),
                )
            )
        if normalized_status:
            campaign_q = campaign_q.where(cast(Campaign.status, String) == normalized_status)
        if start_date:
            campaign_q = campaign_q.where(Campaign.created_at >= start_date)
        if end_date:
            campaign_q = campaign_q.where(Campaign.created_at <= end_date)
        queries.append(campaign_q)

    if "users" in selected_models:
        user_q = select(
            literal("user").label("model"),
            cast(User.id, String).label("entity_id"),
            User.full_name.label("title"),
            User.email.label("subtitle"),
            cast(User.role, String).label("status"),
            User.created_at.label("created_at"),
        )
        if q:
            user_q = user_q.where(
                or_(
                    User.full_name.ilike(f"%{q}%"),
                    User.email.ilike(f"%{q}%"),
                    User.wave_number.ilike(f"%{q}%"),
                )
            )
        if normalized_status:
            user_q = user_q.where(or_(User.role == normalized_status, User.kyc_status == normalized_status))
        if start_date:
            user_q = user_q.where(User.created_at >= start_date)
        if end_date:
            user_q = user_q.where(User.created_at <= end_date)
        queries.append(user_q)

    if "donations" in selected_models:
        donation_q = select(
            literal("donation").label("model"),
            cast(Donation.id, String).label("entity_id"),
            Donation.client_reference.label("title"),
            Donation.donor_name.label("subtitle"),
            cast(Donation.status, String).label("status"),
            Donation.created_at.label("created_at"),
        )
        if q:
            donation_q = donation_q.where(
                or_(
                    Donation.client_reference.ilike(f"%{q}%"),
                    Donation.donor_name.ilike(f"%{q}%"),
                    Donation.message.ilike(f"%{q}%"),
                )
            )
        if normalized_status:
            donation_q = donation_q.where(cast(Donation.status, String) == normalized_status)
        if start_date:
            donation_q = donation_q.where(Donation.created_at >= start_date)
        if end_date:
            donation_q = donation_q.where(Donation.created_at <= end_date)
        queries.append(donation_q)

    if "reviews" in selected_models:
        review_q = select(
            literal("review").label("model"),
            cast(Review.id, String).label("entity_id"),
            Review.donor_name.label("title"),
            Review.comment.label("subtitle"),
            literal(None).label("status"),
            Review.created_at.label("created_at"),
        )
        if q:
            review_q = review_q.where(
                or_(
                    Review.donor_name.ilike(f"%{q}%"),
                    Review.comment.ilike(f"%{q}%"),
                )
            )
        if start_date:
            review_q = review_q.where(Review.created_at >= start_date)
        if end_date:
            review_q = review_q.where(Review.created_at <= end_date)
        queries.append(review_q)

    if "payouts" in selected_models:
        payout_q = select(
            literal("payout").label("model"),
            cast(Payout.id, String).label("entity_id"),
            Payout.client_reference.label("title"),
            cast(Payout.net_amount, String).label("subtitle"),
            cast(Payout.status, String).label("status"),
            Payout.created_at.label("created_at"),
        )
        if q:
            payout_q = payout_q.where(Payout.client_reference.ilike(f"%{q}%"))
        if normalized_status:
            payout_q = payout_q.where(cast(Payout.status, String) == normalized_status)
        if start_date:
            payout_q = payout_q.where(Payout.created_at >= start_date)
        if end_date:
            payout_q = payout_q.where(Payout.created_at <= end_date)
        queries.append(payout_q)

    if "kyc" in selected_models:
        kyc_q = select(
            literal("kyc").label("model"),
            cast(KYC.id, String).label("entity_id"),
            cast(KYC.document_type, String).label("title"),
            cast(KYC.user_id, String).label("subtitle"),
            cast(KYC.status, String).label("status"),
            KYC.created_at.label("created_at"),
        )
        if normalized_status:
            kyc_q = kyc_q.where(cast(KYC.status, String) == normalized_status)
        if start_date:
            kyc_q = kyc_q.where(KYC.created_at >= start_date)
        if end_date:
            kyc_q = kyc_q.where(KYC.created_at <= end_date)
        queries.append(kyc_q)

    if "moderation" in selected_models:
        moderation_q = select(
            literal("moderation").label("model"),
            cast(ModerationReport.id, String).label("entity_id"),
            cast(ModerationReport.reason, String).label("title"),
            ModerationReport.description.label("subtitle"),
            cast(ModerationReport.status, String).label("status"),
            ModerationReport.created_at.label("created_at"),
        )
        if q:
            moderation_q = moderation_q.where(
                or_(
                    cast(ModerationReport.reason, String).ilike(f"%{q}%"),
                    ModerationReport.description.ilike(f"%{q}%"),
                )
            )
        if normalized_status:
            moderation_q = moderation_q.where(cast(ModerationReport.status, String) == normalized_status)
        if start_date:
            moderation_q = moderation_q.where(ModerationReport.created_at >= start_date)
        if end_date:
            moderation_q = moderation_q.where(ModerationReport.created_at <= end_date)
        queries.append(moderation_q)

    if not queries:
        return {
            "page": page,
            "page_size": page_size,
            "total": 0,
            "total_pages": 0,
            "items": [],
        }

    unified = union_all(*queries).subquery("search_results")

    total_result = await db.execute(select(func.count()).select_from(unified))
    total = total_result.scalar() or 0

    offset = (page - 1) * page_size
    page_result = await db.execute(
        select(unified)
        .order_by(unified.c.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    rows = page_result.mappings().all()

    total_pages = (total + page_size - 1) // page_size if total > 0 else 0
    return {
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": total_pages,
        "items": [dict(row) for row in rows],
    }
