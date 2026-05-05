from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
import re
import uuid

from app.db.database import get_db
from app.models.campaign import Campaign
from app.models.donation import Donation
from app.models.user import User
from app.schemas.campaign import CampaignCreate, CampaignRead
from app.schemas.donation import DonationRead
from app.api.routes.auth import get_current_user
from app.services.qrcode_service import generate_and_upload_qr
from app.core.config import settings
from app.core.logging_config import get_logger

router = APIRouter(prefix="/campaigns", tags=["Campaigns"])
logger = get_logger("campaigns")

def generate_slug(title: str) -> str:
    """Converts 'Save The Turtles!' to 'save-the-turtles'"""
    slug = re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')
    return slug

@router.post("/", response_model=CampaignRead, status_code=status.HTTP_201_CREATED)
async def create_campaign(
    campaign_in: CampaignCreate, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user) # 👈 Requires user to be logged in!
):
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
    page_url = f"{frontend_url}/campaign/{slug}"
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
        qr_code_page_url=qr_page_url,
        qr_code_direct_url=qr_direct_url
    )

    db.add(new_campaign)
    await db.commit()
    await db.refresh(new_campaign)
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

@router.get("/{slug}", response_model=CampaignRead)
async def get_campaign_by_slug(slug: str, db: AsyncSession = Depends(get_db)):
    """Get a specific campaign using its URL slug"""
    result = await db.execute(select(Campaign).where(Campaign.slug == slug))
    campaign = result.scalars().first()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign

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
