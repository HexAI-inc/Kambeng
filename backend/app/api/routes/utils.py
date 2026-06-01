from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.auth import get_admin_user, get_current_user
from app.core.config import settings
from app.core.logging_config import get_logger
from app.db.database import get_db
from app.models.campaign import Campaign, CampaignMode, CampaignStatus
from app.models.donation import Donation
from app.models.kyc import KYC, KYCStatus, KYCDocumentType
from app.models.ledger import TransactionStatus, TransactionType
from app.models.moderation import ModerationReport, ReportReason, ReportStatus
from app.models.payout import Payout
from app.models.review import Review
from app.models.user import User
from app.services.storage_strategy import get_storage_strategy
from app.services.qrcode_service import QRCodeService

router = APIRouter(prefix="/utils", tags=["Utils"])
logger = get_logger("utils")
storage_strategy = get_storage_strategy()


def _to_public_media_url(path_or_url: str | None) -> str | None:
    if not path_or_url:
        return None
    if path_or_url.startswith("http://") or path_or_url.startswith("https://"):
        return path_or_url

    base = settings.BACKEND_PUBLIC_URL.rstrip("/")
    if path_or_url.startswith("/"):
        return f"{base}{path_or_url}"
    return f"{base}/{path_or_url}"


def _resolve_campaign_cover_image_url(campaign_id: int) -> str | None:
    images = storage_strategy.list_campaign_images(campaign_id=campaign_id)
    if not images:
        return None
    return _to_public_media_url(str(images[0].get("url")))


async def _build_home_feed_payload(db: AsyncSession, featured_limit: int, recent_limit: int):
    featured_result = await db.execute(
        select(
            Campaign.id,
            Campaign.title,
            Campaign.slug,
            cast(Campaign.status, String).label("status"),
            cast(Campaign.mode, String).label("mode"),
            Campaign.amount_raised,
            Campaign.target_amount,
            Campaign.created_at,
        )
        .where(cast(Campaign.status, String) == CampaignStatus.ACTIVE.value)
        .order_by(Campaign.amount_raised.desc(), Campaign.created_at.desc())
        .limit(featured_limit)
    )

    featured_campaigns = [
        {
            "id": row.id,
            "title": row.title,
            "slug": row.slug,
            "status": row.status,
            "mode": row.mode,
            "amount_raised": row.amount_raised,
            "target_amount": row.target_amount,
            "created_at": row.created_at,
            "cover_image_url": _resolve_campaign_cover_image_url(row.id),
        }
        for row in featured_result.all()
    ]

    recent_donations_result = await db.execute(
        select(
            Donation.id,
            Donation.amount,
            Donation.donor_name,
            Donation.client_reference,
            Donation.created_at,
            Campaign.id.label("campaign_id"),
            Campaign.title.label("campaign_title"),
            Campaign.slug.label("campaign_slug"),
        )
        .join(Campaign, Campaign.id == Donation.campaign_id)
        .where(cast(Donation.status, String) == "SUCCEEDED")
        .order_by(Donation.created_at.desc())
        .limit(recent_limit)
    )

    recent_donations = [
        {
            "id": row.id,
            "amount": row.amount,
            "donor_name": row.donor_name,
            "client_reference": row.client_reference,
            "created_at": row.created_at,
            "campaign": {
                "id": row.campaign_id,
                "title": row.campaign_title,
                "slug": row.campaign_slug,
            },
        }
        for row in recent_donations_result.all()
    ]

    total_campaigns_result = await db.execute(select(func.count(Campaign.id)))
    total_campaigns = total_campaigns_result.scalar() or 0

    active_campaigns_result = await db.execute(
        select(func.count(Campaign.id)).where(cast(Campaign.status, String) == CampaignStatus.ACTIVE.value)
    )
    active_campaigns = active_campaigns_result.scalar() or 0

    successful_donations_result = await db.execute(
        select(func.count(Donation.id)).where(cast(Donation.status, String) == "SUCCEEDED")
    )
    successful_donations = successful_donations_result.scalar() or 0

    total_raised_result = await db.execute(
        select(func.coalesce(func.sum(Campaign.amount_raised), 0.0))
    )
    total_raised = float(total_raised_result.scalar() or 0.0)

    return {
        "featured_campaigns": featured_campaigns,
        "recent_donations": recent_donations,
        "stats": {
            "total_campaigns": total_campaigns,
            "active_campaigns": active_campaigns,
            "successful_donations": successful_donations,
            "total_raised": total_raised,
        },
    }


async def _build_campaign_cards_payload(db: AsyncSession, limit: int, q: str | None):
    query = (
        select(
            Campaign.id,
            Campaign.user_id,
            Campaign.title,
            Campaign.slug,
            Campaign.description,
            cast(Campaign.mode, String).label("mode"),
            Campaign.target_amount,
            Campaign.amount_raised,
            cast(Campaign.status, String).label("status"),
            Campaign.created_at,
        )
        .where(cast(Campaign.status, String) == CampaignStatus.ACTIVE.value)
    )

    if q and q.strip():
        query_text = q.strip()
        query = query.where(
            or_(
                Campaign.title.ilike(f"%{query_text}%"),
                Campaign.slug.ilike(f"%{query_text}%"),
                Campaign.description.ilike(f"%{query_text}%"),
            )
        )

    result = await db.execute(query.order_by(Campaign.created_at.desc()).limit(limit))
    rows = result.all()

    return [
        {
            "id": row.id,
            "user_id": row.user_id,
            "title": row.title,
            "slug": row.slug,
            "description": row.description,
            "mode": row.mode,
            "target_amount": row.target_amount,
            "amount_raised": row.amount_raised,
            "status": row.status,
            "created_at": row.created_at,
            "cover_image_url": _resolve_campaign_cover_image_url(row.id),
        }
        for row in rows
    ]


@router.get("/frontend/bootstrap")
async def get_frontend_bootstrap():
    """Public bootstrap config for frontend apps (React, mobile, etc.)."""
    return {
        "project": {
            "name": settings.PROJECT_NAME,
            "environment": settings.ENVIRONMENT,
            "frontend_url": settings.FRONTEND_URL,
        },
        "docs": {
            "openapi_url": settings.API_OPENAPI_URL,
            "docs_url": settings.API_DOCS_URL,
            "redoc_url": settings.API_REDOC_URL,
        },
        "limits": {
            "max_campaign_images": settings.MAX_CAMPAIGN_IMAGES,
            "max_campaign_image_size_mb": settings.MAX_CAMPAIGN_IMAGE_SIZE_MB,
        },
    }


@router.get("/frontend/filter-options")
async def get_filter_options():
    """Frontend UI dropdown/options payload from backend enums/constants."""
    return {
        "campaign": {
            "status": [item.value for item in CampaignStatus],
            "mode": [item.value for item in CampaignMode],
        },
        "kyc": {
            "status": [item.value for item in KYCStatus],
            "document_types": [item.value for item in KYCDocumentType],
        },
        "moderation": {
            "status": [item.value for item in ReportStatus],
            "reasons": [item.value for item in ReportReason],
        },
        "transactions": {
            "type": [item.value for item in TransactionType],
            "status": [item.value for item in TransactionStatus],
        },
        "users": {
            "role": ["USER", "ADMIN"],
            "kyc_status": ["NOT_SUBMITTED", "SUBMITTED", "REVIEWING", "APPROVED", "REJECTED"],
        },
    }


@router.get("/frontend/me-summary")
async def get_my_ui_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Utility summary for the logged-in user dashboard cards/widgets."""
    campaign_count_result = await db.execute(
        select(func.count(Campaign.id)).where(Campaign.user_id == current_user.id)
    )
    total_campaigns = campaign_count_result.scalar() or 0

    active_campaign_count_result = await db.execute(
        select(func.count(Campaign.id)).where(
            Campaign.user_id == current_user.id,
            Campaign.status == CampaignStatus.ACTIVE,
        )
    )
    active_campaigns = active_campaign_count_result.scalar() or 0

    total_raised_result = await db.execute(
        select(func.sum(Campaign.amount_raised)).where(Campaign.user_id == current_user.id)
    )
    total_raised = float(total_raised_result.scalar() or 0.0)

    latest_campaign_result = await db.execute(
        select(Campaign.id, Campaign.title, Campaign.slug, Campaign.status, Campaign.amount_raised, Campaign.created_at)
        .where(Campaign.user_id == current_user.id)
        .order_by(Campaign.created_at.desc())
        .limit(5)
    )

    latest_campaigns = [
        {
            "id": row.id,
            "title": row.title,
            "slug": row.slug,
            "status": row.status.value if hasattr(row.status, "value") else row.status,
            "amount_raised": row.amount_raised,
            "created_at": row.created_at,
        }
        for row in latest_campaign_result.all()
    ]

    logger.info(
        "UI summary fetched for user",
        extra={
            "action": "frontend_me_summary",
            "user_id": current_user.id,
            "email": current_user.email,
        },
    )

    return {
        "user": {
            "id": current_user.id,
            "full_name": current_user.full_name,
            "email": current_user.email,
            "role": current_user.role,
            "kyc_status": current_user.kyc_status,
            "is_email_verified": current_user.is_email_verified,
        },
        "metrics": {
            "total_campaigns": total_campaigns,
            "active_campaigns": active_campaigns,
            "total_raised": total_raised,
        },
        "latest_campaigns": latest_campaigns,
    }


@router.get("/frontend/admin-summary")
async def get_admin_ui_summary(
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user),
):
    """Utility summary payload for admin React dashboard widgets."""
    users_result = await db.execute(select(func.count(User.id)))
    total_users = users_result.scalar() or 0

    campaigns_result = await db.execute(select(func.count(Campaign.id)))
    total_campaigns = campaigns_result.scalar() or 0

    active_campaigns_result = await db.execute(
        select(func.count(Campaign.id)).where(Campaign.status == CampaignStatus.ACTIVE)
    )
    active_campaigns = active_campaigns_result.scalar() or 0

    suspended_campaigns_result = await db.execute(
        select(func.count(Campaign.id)).where(Campaign.status == CampaignStatus.SUSPENDED)
    )
    suspended_campaigns = suspended_campaigns_result.scalar() or 0

    pending_kyc_result = await db.execute(
        select(func.count(KYC.id)).where(cast(KYC.status, String).in_([KYCStatus.SUBMITTED.value, KYCStatus.REVIEWING.value]))
    )
    pending_kyc = pending_kyc_result.scalar() or 0

    open_reports_result = await db.execute(
        select(func.count(ModerationReport.id)).where(cast(ModerationReport.status, String) == ReportStatus.OPEN.value)
    )
    open_reports = open_reports_result.scalar() or 0

    logger.info(
        "UI summary fetched for admin",
        extra={
            "action": "frontend_admin_summary",
            "admin_user_id": admin_user.id,
            "admin_email": admin_user.email,
        },
    )

    return {
        "metrics": {
            "total_users": total_users,
            "total_campaigns": total_campaigns,
            "active_campaigns": active_campaigns,
            "suspended_campaigns": suspended_campaigns,
            "pending_kyc": pending_kyc,
            "open_reports": open_reports,
        }
    }


@router.get("/frontend/suggestions")
async def get_frontend_suggestions(
    q: str = Query(..., min_length=1),
    limit: int = Query(default=8, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Typeahead suggestions across campaigns and users for rich UI search bars."""
    query_text = q.strip()

    campaign_query = (
        select(
            Campaign.id.label("id"),
            Campaign.title.label("label"),
            Campaign.slug.label("sub_label"),
            cast(Campaign.status, String).label("status"),
            func.cast("campaign", String).label("type"),
        )
        .where(
            or_(
                Campaign.title.ilike(f"%{query_text}%"),
                Campaign.slug.ilike(f"%{query_text}%"),
            )
        )
        .limit(limit)
    )

    campaigns = await db.execute(campaign_query)
    campaign_items = [
        {
            "id": row.id,
            "type": row.type,
            "label": row.label,
            "sub_label": row.sub_label,
            "status": row.status,
        }
        for row in campaigns.all()
    ]

    user_items = []
    if current_user.role == "ADMIN":
        user_query = (
            select(
                User.id.label("id"),
                User.full_name.label("label"),
                User.email.label("sub_label"),
                User.role.label("status"),
                func.cast("user", String).label("type"),
            )
            .where(
                or_(
                    User.full_name.ilike(f"%{query_text}%"),
                    User.email.ilike(f"%{query_text}%"),
                )
            )
            .limit(limit)
        )
        users = await db.execute(user_query)
        user_items = [
            {
                "id": row.id,
                "type": row.type,
                "label": row.label,
                "sub_label": row.sub_label,
                "status": row.status,
            }
            for row in users.all()
        ]

    return {
        "query": query_text,
        "limit": limit,
        "items": (campaign_items + user_items)[:limit],
    }


@router.get("/frontend/home-feed")
async def get_frontend_home_feed(
    featured_limit: int = Query(default=6, ge=1, le=20),
    recent_limit: int = Query(default=8, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
):
    """Single endpoint for home page: featured campaigns + recent donations + top stats."""
    payload = await _build_home_feed_payload(db, featured_limit, recent_limit)
    logger.info(
        "Frontend home feed fetched",
        extra={"action": "frontend_home_feed", "featured_limit": featured_limit, "recent_limit": recent_limit},
    )
    return payload


@router.get("/frontend/campaign-cards")
async def get_frontend_campaign_cards(
    limit: int = Query(default=60, ge=1, le=200),
    q: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Public campaign-card payload with cover image and summary fields."""
    payload = await _build_campaign_cards_payload(db, limit, q)
    logger.info(
        "Frontend campaign cards fetched",
        extra={"action": "frontend_campaign_cards", "limit": limit, "has_query": bool(q)},
    )
    return payload


@router.get("/frontend/counts")
async def get_frontend_model_counts(
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user),
):
    """Quick per-model counters for badges/chips in admin and management UIs."""
    counts = {}

    users_result = await db.execute(select(func.count(User.id)))
    counts["users"] = users_result.scalar() or 0

    campaigns_result = await db.execute(select(func.count(Campaign.id)))
    counts["campaigns"] = campaigns_result.scalar() or 0

    donations_result = await db.execute(select(func.count(Donation.id)))
    counts["donations"] = donations_result.scalar() or 0

    reviews_result = await db.execute(select(func.count(Review.id)))
    counts["reviews"] = reviews_result.scalar() or 0

    payouts_result = await db.execute(select(func.count(Payout.id)))
    counts["payouts"] = payouts_result.scalar() or 0

    kyc_result = await db.execute(select(func.count(KYC.id)))
    counts["kyc_submissions"] = kyc_result.scalar() or 0

    moderation_result = await db.execute(select(func.count(ModerationReport.id)))
    counts["moderation_reports"] = moderation_result.scalar() or 0

    logger.info(
        "Frontend model counts fetched",
        extra={"action": "frontend_model_counts", "admin_user_id": admin_user.id, "admin_email": admin_user.email},
    )
    return {"counts": counts}


@router.get("/frontend/v1/contract")
async def get_frontend_v1_contract():
    """Versioned frontend contract descriptor for React client rollout."""
    return {
        "version": "v1",
        "generated_at": datetime.now(UTC).isoformat(),
        "base_path": "/api/utils/frontend/v1",
        "endpoints": {
            "bootstrap": "/api/utils/frontend/v1/bootstrap",
            "filter_options": "/api/utils/frontend/v1/filter-options",
            "home_feed": "/api/utils/frontend/v1/home-feed",
            "campaign_cards": "/api/utils/frontend/v1/campaign-cards",
            "counts": "/api/utils/frontend/v1/counts",
            "me_summary": "/api/utils/frontend/v1/me-summary",
            "admin_summary": "/api/utils/frontend/v1/admin-summary",
            "suggestions": "/api/utils/frontend/v1/suggestions",
        },
        "notes": [
            "Use this contract to pin client behavior during React migration.",
            "v1 endpoints mirror stable utility payloads and are backward compatible.",
        ],
    }


@router.get("/frontend/v1/bootstrap")
async def get_frontend_bootstrap_v1():
    return await get_frontend_bootstrap()


@router.get("/frontend/v1/filter-options")
async def get_filter_options_v1():
    return await get_filter_options()


@router.get("/frontend/v1/home-feed")
async def get_frontend_home_feed_v1(
    featured_limit: int = Query(default=6, ge=1, le=20),
    recent_limit: int = Query(default=8, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
):
    return await _build_home_feed_payload(db, featured_limit, recent_limit)


@router.get("/frontend/v1/campaign-cards")
async def get_frontend_campaign_cards_v1(
    limit: int = Query(default=60, ge=1, le=200),
    q: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    return await _build_campaign_cards_payload(db, limit, q)


@router.get("/frontend/v1/counts")
async def get_frontend_model_counts_v1(
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user),
):
    return await get_frontend_model_counts(db=db, admin_user=admin_user)


@router.get("/frontend/v1/me-summary")
async def get_my_ui_summary_v1(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await get_my_ui_summary(db=db, current_user=current_user)


@router.get("/frontend/v1/admin-summary")
async def get_admin_ui_summary_v1(
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user),
):
    return await get_admin_ui_summary(db=db, admin_user=admin_user)


@router.get("/frontend/v1/suggestions")
async def get_frontend_suggestions_v1(
    q: str = Query(..., min_length=1),
    limit: int = Query(default=8, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await get_frontend_suggestions(q=q, limit=limit, db=db, current_user=current_user)


# ===== QR Code Generation Endpoints =====


@router.get("/qrcode/campaign/{slug}")
async def get_campaign_qr_code(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Generate a QR code for a campaign.
    Returns a PNG image that links to the campaign page.
    """
    # Verify campaign exists
    result = await db.execute(select(Campaign).where(Campaign.slug == slug))
    campaign = result.scalar_one_or_none()
    if not campaign:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Campaign not found")

    qr_bytes = QRCodeService.generate_campaign_qr_code(slug)
    return StreamingResponse(
        iter([qr_bytes]),
        media_type="image/png",
        headers={"Content-Disposition": f'inline; filename="{slug}-qr.png"'},
    )


@router.get("/qrcode/donation/{slug}")
async def get_donation_qr_code(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Generate a QR code for a campaign's donation page.
    Returns a PNG image that links to the quick-pay donation page.
    """
    # Verify campaign exists
    result = await db.execute(select(Campaign).where(Campaign.slug == slug))
    campaign = result.scalar_one_or_none()
    if not campaign:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Campaign not found")

    qr_bytes = QRCodeService.generate_donation_qr_code(slug)
    return StreamingResponse(
        iter([qr_bytes]),
        media_type="image/png",
        headers={"Content-Disposition": f'inline; filename="{slug}-donation-qr.png"'},
    )


@router.get("/qrcode/short/{short_code}")
async def get_short_code_qr(
    short_code: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Generate a QR code for a campaign's short code.
    Returns a PNG image that links to the short URL.
    """
    from app.models.aliases import CampaignAlias

    # Verify short code exists
    result = await db.execute(
        select(CampaignAlias).where(CampaignAlias.short_code == short_code)
    )
    alias = result.scalar_one_or_none()
    if not alias:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Short code not found")

    qr_bytes = QRCodeService.generate_short_code_qr(short_code)
    return StreamingResponse(
        iter([qr_bytes]),
        media_type="image/png",
        headers={"Content-Disposition": f'inline; filename="{short_code}-qr.png"'},
    )


# Endpoint to get QR code as base64 (for inline embedding in JSON)
@router.get("/qrcode/campaign/{slug}/base64")
async def get_campaign_qr_code_base64(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Generate a QR code for a campaign and return as base64 string.
    Useful for embedding in JSON responses or displaying inline.
    """
    import base64

    # Verify campaign exists
    result = await db.execute(select(Campaign).where(Campaign.slug == slug))
    campaign = result.scalar_one_or_none()
    if not campaign:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Campaign not found")

    qr_bytes = QRCodeService.generate_campaign_qr_code(slug)
    b64_qr = base64.b64encode(qr_bytes).decode("utf-8")

    return {
        "campaign_slug": slug,
        "qr_code_base64": f"data:image/png;base64,{b64_qr}",
        "qr_code_url": f"{settings.BACKEND_PUBLIC_URL.rstrip('/')}/utils/qrcode/campaign/{slug}",
    }


@router.post("/qrcode/campaign/{slug}/regenerate")
async def regenerate_campaign_qr_codes(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Regenerate and persist QR codes for a campaign."""
    import base64

    result = await db.execute(select(Campaign).where(Campaign.slug == slug))
    campaign = result.scalar_one_or_none()
    if not campaign:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.user_id != current_user.id and current_user.role != "ADMIN":
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Not authorized to regenerate QR codes for this campaign")

    frontend_url = settings.FRONTEND_URL
    page_url = f"{frontend_url}/campaigns/{slug}"
    direct_pay_url = f"{frontend_url}/quick-pay/{slug}"

    page_qr_bytes = QRCodeService._generate_qr_code_bytes(page_url)
    direct_qr_bytes = QRCodeService._generate_qr_code_bytes(direct_pay_url)

    campaign.qr_code_page_url = f"data:image/png;base64,{base64.b64encode(page_qr_bytes).decode()}"
    campaign.qr_code_direct_url = f"data:image/png;base64,{base64.b64encode(direct_qr_bytes).decode()}"

    await db.commit()
    await db.refresh(campaign)

    return {
        "slug": campaign.slug,
        "qr_code_page_url": campaign.qr_code_page_url,
        "qr_code_direct_url": campaign.qr_code_direct_url,
    }
