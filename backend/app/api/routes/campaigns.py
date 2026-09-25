from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, or_
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
import re
import time
import uuid

from app.services.campaign_access import can_manage_campaign
from app.db.database import get_db
from app.models.campaign import Campaign, CampaignTag
from app.models.donation import Donation
from app.models.fraud_report import FraudReport
from app.models.fraud_report_notification_email import FraudReportNotificationEmail
from app.models.organization import MemberStatus, Organization, OrganizationMember
from app.services.spending import spending_summary
from app.models.payout import Payout
from app.models.user import User
from app.schemas.campaign import CampaignClassification, CampaignCreate, CampaignDetailRead, CampaignOwner, CampaignRead, ClassBoard, ClassBoardEntry, SpendingSummary, normalize_tags
from app.schemas.donation import DonationRead
from app.schemas.fraud_report import FraudReportCreate, FraudReportRead
from app.api.routes.auth import get_current_user
from app.services.email_service import send_email
from app.services.hexai_service import HexAIPaymentService
from app.services.qrcode_service import generate_and_upload_qr
from app.core.config import settings
from app.core.logging_config import get_logger

hexai_service = HexAIPaymentService()

router = APIRouter(prefix="/campaigns", tags=["Campaigns"])
logger = get_logger("campaigns")

SELF_DECLARABLE_ORGANISER_TYPES = {"individual", "diaspora"}

async def resolve_beneficiary(db: AsyncSession, body: CampaignCreate, user: User) -> dict:
    """Beneficiary columns for a campaign. Organization campaigns get
    organiser_type "ngo" from the linked profile; everyone else picks
    "individual" or "diaspora"."""
    if body.beneficiary_type != "organization":
        organiser_type = body.organiser_type if body.organiser_type in SELF_DECLARABLE_ORGANISER_TYPES else "individual"
        return {"beneficiary_type": body.beneficiary_type, "organization_id": None, "organiser_type": organiser_type}

    org = (await db.execute(select(Organization).where(Organization.id == body.organization_id))).scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    if user.id not in org.active_manager_ids():
        raise HTTPException(status_code=403, detail="You can only raise money for an organization you represent or help manage")
    return {"beneficiary_type": "organization", "organization_id": org.id, "organiser_type": "ngo", "_org_type": org.org_type}

CLASS_BOARD_ORG_TYPES = {"SCHOOL", "ALUMNI_ASSOCIATION"}

def default_class_board(body: CampaignCreate, beneficiary: dict) -> bool:
    if body.class_board_enabled is not None:
        return body.class_board_enabled
    return beneficiary.get("_org_type") in CLASS_BOARD_ORG_TYPES

def generate_slug(title: str) -> str:
    """Converts 'Save The Turtles!' to 'save-the-turtles'"""
    slug = re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')
    return slug

@router.post("/", response_model=CampaignRead, status_code=status.HTTP_201_CREATED)
@router.post("", response_model=CampaignRead, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def create_campaign(
    campaign_in: CampaignCreate, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user) # 👈 Requires user to be logged in!
):
    beneficiary = await resolve_beneficiary(db, campaign_in, current_user)
    class_board_enabled = default_class_board(campaign_in, beneficiary)
    beneficiary.pop("_org_type", None)

    base_slug = generate_slug(campaign_in.title)
    
    # Check if slug already exists. If yes, add a random string.
    result = await db.execute(select(Campaign).where(Campaign.slug == base_slug))
    if result.scalars().first():
        slug = f"{base_slug}-{str(uuid.uuid4())[:6]}"
    else:
        slug = base_slug

    # Frontend URLs (Where the QR codes will point to)
    # We will change localhost to your real domain later
    frontend_url = settings.FRONTEND_URL 
    page_url = f"{frontend_url}/campaigns/{slug}"
    direct_pay_url = f"{frontend_url}/quick-pay/{slug}"

    # Generate the two QR Codes
    qr_page_url = generate_and_upload_qr(page_url, f"page_{slug}")
    qr_direct_url = generate_and_upload_qr(direct_pay_url, f"direct_{slug}")

    # Save to Database
    new_campaign = Campaign(
        user_id=current_user.id,
        title=campaign_in.title,
        slug=slug,
        description=campaign_in.description,
        mode=campaign_in.mode,
        target_amount=campaign_in.target_amount,
        **beneficiary,
        class_board_enabled=class_board_enabled,
        category=campaign_in.category,
        tags=campaign_in.tags,
        qr_code_page_url=qr_page_url,
        qr_code_direct_url=qr_direct_url
    )

    db.add(new_campaign)
    await db.commit()
    await db.refresh(new_campaign)

    try:
        from app.services.promotions import notify_referrer_of_new_campaign

        await notify_referrer_of_new_campaign(db, new_campaign)
    except Exception:
        logger.exception("Failed to process referral notification", extra={"campaign_id": new_campaign.id})

    logger.info(
        "Campaign created",
        extra={
            "action": "create_campaign",
            "user_id": current_user.id,
            "email": current_user.email,
            "role": current_user.role,
            "campaign_id": new_campaign.id,
            "campaign_title": new_campaign.title,
        },
    )
    return new_campaign

def apply_classification_filters(query, category: Optional[str], tag: Optional[str]):
    """Narrow a Campaign query to one category and/or one tag."""
    if category:
        query = query.where(Campaign.category == category.strip().lower())
    if tag:
        normalized = normalize_tags([tag])
        if normalized:
            query = query.where(
                Campaign.id.in_(select(CampaignTag.campaign_id).where(CampaignTag.tag == normalized[0]))
            )
    return query

@router.get("/", response_model=List[CampaignRead])
async def list_active_campaigns(
    skip: int = 0,
    limit: int = 100,
    category: Optional[str] = None,
    tag: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Get all active campaigns for the home page (paginated), optionally by category and/or tag"""
    query = apply_classification_filters(select(Campaign).where(Campaign.status == "ACTIVE"), category, tag)
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()

@router.get("/tags")
async def list_popular_tags(limit: int = Query(default=20, ge=1, le=100), db: AsyncSession = Depends(get_db)):
    """Most-used tags across active campaigns, for filter chips."""
    usage = func.count(CampaignTag.campaign_id)
    result = await db.execute(
        select(CampaignTag.tag, usage.label("count"))
        .join(Campaign, Campaign.id == CampaignTag.campaign_id)
        .where(Campaign.status == "ACTIVE")
        .group_by(CampaignTag.tag)
        .order_by(usage.desc(), CampaignTag.tag)
        .limit(limit)
    )
    return [{"tag": row.tag, "count": row.count} for row in result.all()]

@router.get("/me", response_model=List[CampaignRead])
async def get_my_campaigns(
    skip: int = 0, 
    limit: int = 100, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all campaigns created by the current logged-in user"""
    managed_orgs = select(Organization.id).where(
        or_(
            Organization.owner_user_id == current_user.id,
            Organization.id.in_(
                select(OrganizationMember.organization_id).where(
                    OrganizationMember.user_id == current_user.id,
                    OrganizationMember.status == MemberStatus.ACTIVE.value,
                )
            ),
        )
    )
    result = await db.execute(
        select(Campaign)
        .where(or_(Campaign.user_id == current_user.id, Campaign.organization_id.in_(managed_orgs)))
        .order_by(Campaign.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()

@router.get("/{slug}", response_model=CampaignDetailRead)
async def get_campaign_by_slug(slug: str, db: AsyncSession = Depends(get_db)):
    """Get a specific campaign using its URL slug, including public organizer attribution."""
    result = await db.execute(
        select(Campaign).options(selectinload(Campaign.owner)).where(Campaign.slug == slug)
    )
    campaign = result.scalars().first()

    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    detail = CampaignDetailRead.model_validate(campaign)
    if campaign.owner:
        detail.owner = CampaignOwner(
            id=campaign.owner.id,
            full_name=campaign.owner.full_name,
            kyc_verified=campaign.owner.kyc_status == "APPROVED",
        )
    return detail

@router.put("/{slug}", response_model=CampaignRead)
async def update_campaign(
    slug: str,
    campaign_update: CampaignCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a campaign's core details"""
    result = await db.execute(select(Campaign).options(selectinload(Campaign.owner)).where(Campaign.slug == slug))
    campaign = result.scalars().first()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if not can_manage_campaign(campaign, current_user):
        raise HTTPException(status_code=403, detail="Not authorized to edit this campaign")
        
    campaign.title = campaign_update.title
    campaign.description = campaign_update.description
    campaign.mode = campaign_update.mode
    campaign.target_amount = campaign_update.target_amount
    # Only touch classification when the client sent it, so older clients
    # that PUT without these fields don't wipe them.
    if "category" in campaign_update.model_fields_set:
        campaign.category = campaign_update.category
    if "tags" in campaign_update.model_fields_set:
        campaign.tags = campaign_update.tags
    if "beneficiary_type" in campaign_update.model_fields_set:
        beneficiary = await resolve_beneficiary(db, campaign_update, campaign.owner)
        if beneficiary["organization_id"] != campaign.organization_id or beneficiary["beneficiary_type"] != campaign.beneficiary_type:
            # Donors gave to the beneficiary shown on the page — don't let it
            # change underneath them.
            if (campaign.amount_raised or 0) > 0 and current_user.role != "ADMIN":
                raise HTTPException(status_code=409, detail="Who a campaign raises for can't change once it has received donations.")
            beneficiary.pop("_org_type", None)
            for field, value in beneficiary.items():
                setattr(campaign, field, value)
    if campaign_update.class_board_enabled is not None:
        campaign.class_board_enabled = campaign_update.class_board_enabled

    await db.commit()
    await db.refresh(campaign)
    logger.info(
        "Campaign updated",
        extra={
            "action": "update_campaign",
            "user_id": current_user.id,
            "email": current_user.email,
            "role": current_user.role,
            "campaign_id": campaign.id,
            "campaign_title": campaign.title,
        },
    )
    return campaign

@router.patch("/{slug}/classification", response_model=CampaignRead)
async def update_campaign_classification(
    slug: str,
    body: CampaignClassification,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Set a campaign's category and tags (owner or admin)."""
    result = await db.execute(select(Campaign).where(Campaign.slug == slug))
    campaign = result.scalars().first()

    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if not can_manage_campaign(campaign, current_user):
        raise HTTPException(status_code=403, detail="Not authorized to edit this campaign")

    campaign.category = body.category
    campaign.tags = body.tags
    await db.commit()
    await db.refresh(campaign)
    logger.info(
        "Campaign classification updated",
        extra={
            "action": "update_campaign_classification",
            "user_id": current_user.id,
            "role": current_user.role,
            "campaign_id": campaign.id,
            "category": campaign.category,
            "tags": campaign.tags,
        },
    )
    return campaign

@router.patch("/{slug}/status")
async def update_campaign_status(
    slug: str,
    status: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Suspend or change campaign status"""
    if status not in ["ACTIVE", "CLOSED", "SUSPENDED"]:
        raise HTTPException(status_code=400, detail="Invalid status")
        
    result = await db.execute(select(Campaign).where(Campaign.slug == slug))
    campaign = result.scalars().first()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
        
    if not can_manage_campaign(campaign, current_user):
        raise HTTPException(status_code=403, detail="Not authorized to edit this campaign")
        
    campaign.status = status
    await db.commit()
    await db.refresh(campaign)
    logger.info(
        "Campaign status updated",
        extra={
            "action": "update_campaign_status",
            "user_id": current_user.id,
            "email": current_user.email,
            "role": current_user.role,
            "campaign_id": campaign.id,
            "new_status": status,
        },
    )
    return {"message": f"Campaign status updated to {status}"}

@router.get("/{slug}/spending", response_model=SpendingSummary)
async def get_campaign_spending(slug: str, db: AsyncSession = Depends(get_db)):
    """Withdrawn vs. shown with receipts — public, so donors can see it."""
    campaign = (await db.execute(select(Campaign).where(Campaign.slug == slug))).scalars().first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return await spending_summary(db, campaign.id)

@router.get("/{slug}/class-board", response_model=ClassBoard)
async def get_class_board(slug: str, db: AsyncSession = Depends(get_db)):
    """Successful giving grouped by the donor's graduating class."""
    campaign = (await db.execute(select(Campaign).where(Campaign.slug == slug))).scalars().first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if not campaign.class_board_enabled:
        return ClassBoard(enabled=False)

    total = func.sum(Donation.amount)
    rows = (await db.execute(
        select(Donation.graduating_class, total.label("total"), func.count(Donation.id).label("donors"))
        .where(
            Donation.campaign_id == campaign.id,
            Donation.status == "SUCCEEDED",
            Donation.graduating_class.isnot(None),
        )
        .group_by(Donation.graduating_class)
        .order_by(total.desc(), Donation.graduating_class.desc())
    )).all()
    return ClassBoard(
        enabled=True,
        classes=[ClassBoardEntry(graduating_class=r.graduating_class, total=float(r.total or 0), donors=r.donors) for r in rows],
    )

@router.get("/{slug}/donations", response_model=List[DonationRead])
async def get_campaign_donations(slug: str, skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    """Get successful donations for a specific campaign"""
    result = await db.execute(select(Campaign).where(Campaign.slug == slug))
    campaign = result.scalars().first()

    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    donations_result = await db.execute(
        select(Donation)
        .where(Donation.campaign_id == campaign.id)
        .where(Donation.status == "SUCCEEDED")
        .order_by(Donation.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return donations_result.scalars().all()


@router.post("/{slug}/report", response_model=FraudReportRead)
async def report_campaign_fraud(
    slug: str,
    body: FraudReportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit a fraud report for a campaign"""
    result = await db.execute(select(Campaign).where(Campaign.slug == slug))
    campaign = result.scalars().first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    report = FraudReport(
        campaign_id=campaign.id,
        reported_by_user_id=current_user.id,
        reason=body.reason,
        details=body.details,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)

    emails_result = await db.execute(
        select(FraudReportNotificationEmail).where(FraudReportNotificationEmail.is_active.is_(True))
    )
    for email_record in emails_result.scalars().all():
        send_email(
            email_record.email,
            f"Fraud Report: {campaign.title}",
            f"<p>A fraud report was submitted for campaign <b>{campaign.title}</b>.</p>"
            f"<p>Reason: {body.reason}</p>"
            f"<p>Details: {body.details or 'N/A'}</p>",
        )

    return report


# NOTE: the old POST /{slug}/withdraw endpoint was removed deliberately.
# It initiated real payouts without the KYC gate, available-balance check,
# or ledger entry that POST /payments/withdraw enforces. All withdrawals
# must go through /payments/withdraw.


@router.get("/{slug}/withdrawals")
async def list_campaign_withdrawals(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all withdrawals for a campaign"""
    result = await db.execute(select(Campaign).where(Campaign.slug == slug))
    campaign = result.scalars().first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if not can_manage_campaign(campaign, current_user):
        raise HTTPException(status_code=403, detail="Not authorized to view withdrawals for this campaign")

    payouts_result = await db.execute(
        select(Payout).where(Payout.campaign_id == campaign.id).order_by(Payout.created_at.desc())
    )
    payouts = payouts_result.scalars().all()
    return [
        {
            "id": p.id,
            "client_reference": p.client_reference,
            "gross_amount": p.gross_amount,
            "hexai_fee": p.hexai_fee,
            "platform_commission": p.platform_commission,
            "net_amount": p.net_amount,
            "status": p.status,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in payouts
    ]
