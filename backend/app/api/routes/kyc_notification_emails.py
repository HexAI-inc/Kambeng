from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

from app.api.routes.auth import get_admin_user
from app.db.database import get_db
from app.models.kyc_notification_email import KYCNotificationEmail
from app.models.user import User
from app.schemas.kyc_notification_email import (
    KYCNotificationEmailCreate,
    KYCNotificationEmailRead,
    KYCNotificationEmailUpdate,
)


router = APIRouter(prefix="/admin/kyc-notification-emails", tags=["Admin KYC Notification Emails"])


def _normalize_email(email: str) -> str:
    return email.strip().lower()


@router.get("", response_model=List[KYCNotificationEmailRead])
async def list_kyc_notification_emails(
    include_inactive: bool = Query(default=True),
    search: Optional[str] = Query(default=None),
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _admin_user: User = Depends(get_admin_user),
):
    query = select(KYCNotificationEmail)
    if not include_inactive:
        query = query.where(KYCNotificationEmail.is_active.is_(True))
    if search:
        query = query.where(KYCNotificationEmail.email.ilike(f"%{search.strip()}%"))

    result = await db.execute(query.order_by(KYCNotificationEmail.created_at.desc()).offset(skip).limit(limit))
    return result.scalars().all()


@router.post("", response_model=KYCNotificationEmailRead, status_code=status.HTTP_201_CREATED)
async def create_kyc_notification_email(
    payload: KYCNotificationEmailCreate,
    db: AsyncSession = Depends(get_db),
    _admin_user: User = Depends(get_admin_user),
):
    email = _normalize_email(payload.email)
    if "@" not in email or "." not in email:
        raise HTTPException(status_code=422, detail="Invalid email address")

    existing = await db.execute(select(KYCNotificationEmail).where(func.lower(KYCNotificationEmail.email) == email))
    if existing.scalars().first():
        raise HTTPException(status_code=409, detail="Notification email already exists")

    record = KYCNotificationEmail(email=email, is_active=payload.is_active)
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


@router.get("/{recipient_id}", response_model=KYCNotificationEmailRead)
async def get_kyc_notification_email(
    recipient_id: int,
    db: AsyncSession = Depends(get_db),
    _admin_user: User = Depends(get_admin_user),
):
    result = await db.execute(select(KYCNotificationEmail).where(KYCNotificationEmail.id == recipient_id))
    record = result.scalars().first()
    if not record:
        raise HTTPException(status_code=404, detail="Notification email not found")
    return record


@router.patch("/{recipient_id}", response_model=KYCNotificationEmailRead)
async def update_kyc_notification_email(
    recipient_id: int,
    payload: KYCNotificationEmailUpdate,
    db: AsyncSession = Depends(get_db),
    _admin_user: User = Depends(get_admin_user),
):
    result = await db.execute(select(KYCNotificationEmail).where(KYCNotificationEmail.id == recipient_id))
    record = result.scalars().first()
    if not record:
        raise HTTPException(status_code=404, detail="Notification email not found")

    if payload.email is not None:
        normalized = _normalize_email(payload.email)
        if "@" not in normalized or "." not in normalized:
            raise HTTPException(status_code=422, detail="Invalid email address")

        duplicate = await db.execute(
            select(KYCNotificationEmail).where(
                func.lower(KYCNotificationEmail.email) == normalized,
                KYCNotificationEmail.id != recipient_id,
            )
        )
        if duplicate.scalars().first():
            raise HTTPException(status_code=409, detail="Notification email already exists")

        record.email = normalized

    if payload.is_active is not None:
        record.is_active = payload.is_active

    await db.commit()
    await db.refresh(record)
    return record


@router.delete("/{recipient_id}")
async def delete_kyc_notification_email(
    recipient_id: int,
    db: AsyncSession = Depends(get_db),
    _admin_user: User = Depends(get_admin_user),
):
    result = await db.execute(select(KYCNotificationEmail).where(KYCNotificationEmail.id == recipient_id))
    record = result.scalars().first()
    if not record:
        raise HTTPException(status_code=404, detail="Notification email not found")

    await db.delete(record)
    await db.commit()
    return {"message": "Notification email deleted"}
