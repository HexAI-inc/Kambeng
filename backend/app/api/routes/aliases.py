from typing import List
import secrets
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.routes.auth import get_current_user, get_admin_user
from app.db.database import get_db
from app.models.alias import CampaignAlias
from app.models.campaign import Campaign
from app.models.user import User
from app.schemas.alias import CampaignAliasCreate, CampaignAliasRead, AliasRedirectResponse
from app.core.config import settings
from app.core.logging_config import get_logger

router = APIRouter(prefix="/aliases", tags=["Aliases"])
logger = get_logger("aliases")


def _generate_short_code(length: int = 8) -> str:
    """Generate a random short code for an alias."""
    return secrets.token_urlsafe(length)[:length].lower()


@router.post("/campaigns/{campaign_id}", response_model=CampaignAliasRead, status_code=status.HTTP_201_CREATED)
async def create_campaign_alias(
    campaign_id: int,
    alias_in: CampaignAliasCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a short-link alias for a campaign. Owner or admin only."""
    
    # Verify campaign exists
    campaign_result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = campaign_result.scalars().first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Verify authorization (owner or admin)
    if campaign.user_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Only campaign owner or admin can create aliases")
    
    # Generate short code if not provided
    short_code = alias_in.short_code or _generate_short_code()
    
    # Check uniqueness
    existing = await db.execute(select(CampaignAlias).where(CampaignAlias.short_code == short_code))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail=f"Short code '{short_code}' already in use. Please try another.")
    
    # Create alias
    new_alias = CampaignAlias(
        campaign_id=campaign_id,
        short_code=short_code
    )
    db.add(new_alias)
    await db.commit()
    await db.refresh(new_alias)
    logger.info(
        "Campaign alias created",
        extra={
            "action": "create_campaign_alias",
            "user_id": current_user.id,
            "email": current_user.email,
            "campaign_id": campaign_id,
            "alias_id": new_alias.id,
            "short_code": short_code,
        },
    )
    
    return new_alias


@router.get("/campaigns/{campaign_id}", response_model=List[CampaignAliasRead])
async def list_campaign_aliases(
    campaign_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all aliases for a campaign. Owner or admin only."""
    
    # Verify campaign exists and get owner
    campaign_result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = campaign_result.scalars().first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Verify authorization
    if campaign.user_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Only campaign owner or admin can view aliases")
    
    # Get aliases
    result = await db.execute(
        select(CampaignAlias)
        .where(CampaignAlias.campaign_id == campaign_id)
        .order_by(CampaignAlias.created_at.desc())
    )
    return result.scalars().all()


@router.delete("/campaigns/{campaign_id}/{alias_id}")
async def delete_campaign_alias(
    campaign_id: int,
    alias_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an alias. Owner or admin only."""
    
    # Verify campaign exists
    campaign_result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = campaign_result.scalars().first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Verify authorization
    if campaign.user_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Only campaign owner or admin can delete aliases")
    
    # Verify alias belongs to campaign
    alias_result = await db.execute(
        select(CampaignAlias).where(
            (CampaignAlias.id == alias_id) & (CampaignAlias.campaign_id == campaign_id)
        )
    )
    alias = alias_result.scalars().first()
    if not alias:
        raise HTTPException(status_code=404, detail="Alias not found for this campaign")
    
    await db.delete(alias)
    await db.commit()
    logger.info(
        "Campaign alias deleted",
        extra={
            "action": "delete_campaign_alias",
            "user_id": current_user.id,
            "email": current_user.email,
            "campaign_id": campaign_id,
            "alias_id": alias_id,
            "short_code": alias.short_code,
        },
    )
    
    return {"message": f"Alias '{alias.short_code}' deleted"}


@router.get("/redirect/{short_code}")
async def redirect_alias(
    short_code: str,
    db: AsyncSession = Depends(get_db),
):
    """Redirect from short alias to campaign slug. Public endpoint."""
    
    # Find alias
    result = await db.execute(select(CampaignAlias).where(CampaignAlias.short_code == short_code))
    alias = result.scalars().first()
    if not alias:
        raise HTTPException(status_code=404, detail="Short code not found")
    
    # Get campaign
    campaign_result = await db.execute(select(Campaign).where(Campaign.id == alias.campaign_id))
    campaign = campaign_result.scalars().first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Return redirect response
    redirect_url = f"{settings.FRONTEND_URL}/campaigns/{campaign.slug}"
    logger.info(
        "Alias redirect resolved",
        extra={
            "action": "redirect_alias",
            "campaign_id": campaign.id,
            "short_code": short_code,
            "slug": campaign.slug,
        },
    )
    
    return AliasRedirectResponse(
        campaign_id=campaign.id,
        slug=campaign.slug,
        redirect_url=redirect_url
    )
