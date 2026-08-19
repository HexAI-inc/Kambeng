from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List
import re
import time
import uuid

from app.db.database import get_db
from app.models.campaign import Campaign
from app.models.donation import Donation
from app.models.fraud_report import FraudReport
from app.models.fraud_report_notification_email import FraudReportNotificationEmail
from app.models.payout import Payout
from app.models.user import User
from app.schemas.campaign import CampaignCreate, CampaignDetailRead, CampaignOwner, CampaignRead
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
    allowed_organiser_types = {"individual", "ngo", "diaspora"}
    organiser_type = campaign_in.organiser_type if campaign_in.organiser_type in allowed_organiser_types else "individual"

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
        organiser_type=organiser_type,
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

@router.get("/", response_model=List[CampaignRead])
async def list_active_campaigns(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    """Get all active campaigns for the home page (paginated)"""
    result = await db.execute(select(Campaign).where(Campaign.status == "ACTIVE").offset(skip).limit(limit))
    return result.scalars().all()

@router.get("/me", response_model=List[CampaignRead])
async def get_my_campaigns(
    skip: int = 0, 
    limit: int = 100, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all campaigns created by the current logged-in user"""
    result = await db.execute(
        select(Campaign)
        .where(Campaign.user_id == current_user.id)
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
    result = await db.execute(select(Campaign).where(Campaign.slug == slug))
    campaign = result.scalars().first()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if campaign.user_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized to edit this campaign")
        
    campaign.title = campaign_update.title
    campaign.description = campaign_update.description
    campaign.mode = campaign_update.mode
    campaign.target_amount = campaign_update.target_amount

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
        
    if campaign.user_id != current_user.id and current_user.role != "ADMIN":
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

    if campaign.user_id != current_user.id and current_user.role != "ADMIN":
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
