from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.api.routes.auth import get_current_user, get_current_user_optional
from app.db.database import get_db
from app.models.campaign import Campaign
from app.models.campaign_update import CampaignUpdate
from app.models.update_attachment import UpdateAttachment
from app.models.user import User
from app.services.storage_service import StorageService
from app.core.config import settings
from app.core.logging_config import get_logger

router = APIRouter(tags=["Campaign Updates"])
logger = get_logger("campaign_updates")
storage = StorageService()


def _media_url(path: str | None) -> str | None:
    if not path:
        return None
    if path.startswith("http://") or path.startswith("https://"):
        return path
    base = settings.BACKEND_PUBLIC_URL.rstrip("/")
    return f"{base}/{path.lstrip('/')}"


class AttachmentOut(BaseModel):
    id: int
    file_url: str
    file_name: str | None
    content_type: str | None
    model_config = ConfigDict(from_attributes=True)


class UpdateOut(BaseModel):
    id: int
    campaign_id: int
    title: str | None
    text: str
    category: str | None
    amount_spent: float | None
    created_at: datetime
    author_name: str | None
    attachments: List[AttachmentOut]
    model_config = ConfigDict(from_attributes=True)


def _serialize_update(u: CampaignUpdate) -> dict:
    return {
        "id": u.id,
        "campaign_id": u.campaign_id,
        "title": u.title,
        "text": u.text,
        "category": u.category,
        "amount_spent": u.amount_spent,
        "created_at": u.created_at,
        "author_name": u.author.full_name if u.author else None,
        "attachments": [
            {
                "id": a.id,
                "file_url": a.file_url,
                "file_name": a.file_name,
                "content_type": a.content_type,
            }
            for a in u.attachments
        ],
    }


@router.get("/campaigns/{slug}/updates", response_model=List[UpdateOut])
async def list_campaign_updates(
    slug: str,
    db: AsyncSession = Depends(get_db),
    _current_user: User | None = Depends(get_current_user_optional),
):
    result = await db.execute(select(Campaign).where(Campaign.slug == slug))
    campaign = result.scalars().first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    updates_result = await db.execute(
        select(CampaignUpdate)
        .where(CampaignUpdate.campaign_id == campaign.id)
        .options(selectinload(CampaignUpdate.attachments), selectinload(CampaignUpdate.author))
        .order_by(CampaignUpdate.created_at.desc())
    )
    updates = updates_result.scalars().all()
    return [_serialize_update(u) for u in updates]


@router.post("/campaigns/{slug}/updates", status_code=status.HTTP_201_CREATED)
async def create_campaign_update(
    slug: str,
    title: Optional[str] = Form(default=None),
    text: str = Form(...),
    category: Optional[str] = Form(default=None),
    amount_spent: Optional[float] = Form(default=None),
    files: List[UploadFile] = File(default=[]),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Campaign).where(Campaign.slug == slug))
    campaign = result.scalars().first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.user_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Only the campaign owner can post updates")

    update = CampaignUpdate(
        campaign_id=campaign.id,
        user_id=current_user.id,
        title=title.strip() if title else None,
        text=text.strip(),
        category=category,
        amount_spent=amount_spent,
    )
    db.add(update)
    await db.flush()

    for file in files:
        if not file.filename:
            continue
        content = await file.read()
        if not content:
            continue
        file_url = storage.upload_file(content, file.filename, file.content_type or "application/octet-stream")
        if file_url:
            attachment = UpdateAttachment(
                update_id=update.id,
                campaign_id=campaign.id,
                file_url=file_url,
                file_name=file.filename,
                content_type=file.content_type,
                uploaded_by_user_id=current_user.id,
            )
            db.add(attachment)

    await db.commit()

    fresh_result = await db.execute(
        select(CampaignUpdate)
        .where(CampaignUpdate.id == update.id)
        .options(selectinload(CampaignUpdate.attachments), selectinload(CampaignUpdate.author))
    )
    fresh = fresh_result.scalars().first()
    return _serialize_update(fresh)


@router.delete("/campaigns/{slug}/updates/{update_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_campaign_update(
    slug: str,
    update_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Campaign).where(Campaign.slug == slug))
    campaign = result.scalars().first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    update_result = await db.execute(
        select(CampaignUpdate).where(
            CampaignUpdate.id == update_id,
            CampaignUpdate.campaign_id == campaign.id,
        )
    )
    update = update_result.scalars().first()
    if not update:
        raise HTTPException(status_code=404, detail="Update not found")

    if update.user_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized to delete this update")

    await db.delete(update)
    await db.commit()


@router.post("/campaigns/{slug}/cover", status_code=status.HTTP_200_OK)
async def upload_campaign_cover(
    slug: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Campaign).where(Campaign.slug == slug))
    campaign = result.scalars().first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.user_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized to update this campaign")

    allowed = {"image/jpeg", "image/png", "image/webp"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, and WebP images are supported")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(content) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Cover image must be 8MB or smaller")

    file_url = storage.upload_file(content, file.filename or "cover.jpg", file.content_type or "image/jpeg")
    if not file_url:
        raise HTTPException(status_code=500, detail="Failed to store cover image")

    campaign.cover_image_url = _media_url(file_url) or file_url
    await db.commit()

    logger.info("Campaign cover updated", extra={"campaign_id": campaign.id, "user_id": current_user.id})
    return {"cover_image_url": campaign.cover_image_url}
