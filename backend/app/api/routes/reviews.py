from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.routes.auth import get_current_user, get_admin_user
from app.db.database import get_db
from app.models.campaign import Campaign
from app.models.review import Review
from app.models.user import User
from app.schemas.review import ReviewBase, ReviewRead
from app.core.logging_config import get_logger


router = APIRouter(prefix="/reviews", tags=["Reviews"])
logger = get_logger("reviews")


@router.post("/campaigns/{slug}", response_model=ReviewRead, status_code=status.HTTP_201_CREATED)
async def create_review(
    slug: str,
    review_in: ReviewBase,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Campaign).where(Campaign.slug == slug))
    campaign = result.scalars().first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    new_review = Review(
        campaign_id=campaign.id,
        donor_name=current_user.full_name,
        comment=review_in.comment,
        rating=review_in.rating,
    )
    db.add(new_review)
    await db.commit()
    await db.refresh(new_review)
    logger.info(
        "Review created",
        extra={
            "action": "create_review",
            "user_id": current_user.id,
            "email": current_user.email,
            "campaign_id": campaign.id,
            "review_id": new_review.id,
            "rating": review_in.rating,
        },
    )
    return new_review


@router.get("/campaigns/{slug}", response_model=List[ReviewRead])
async def list_campaign_reviews(slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Campaign).where(Campaign.slug == slug))
    campaign = result.scalars().first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    reviews_result = await db.execute(
        select(Review)
        .where(Review.campaign_id == campaign.id)
        .order_by(Review.created_at.desc())
    )
    return reviews_result.scalars().all()


@router.delete("/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_review(
    review_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Review).where(Review.id == review_id))
    review = result.scalars().first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    if review.donor_name != current_user.full_name and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized to delete this review")

    await db.delete(review)
    await db.commit()
    logger.info(
        "Review deleted",
        extra={
            "action": "delete_review",
            "user_id": current_user.id,
            "email": current_user.email,
            "review_id": review_id,
            "is_admin": current_user.role == "ADMIN",
        },
    )


@router.delete("/admin/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_review(
    review_id: int,
    db: AsyncSession = Depends(get_db),
    _admin_user: User = Depends(get_admin_user),
):
    result = await db.execute(select(Review).where(Review.id == review_id))
    review = result.scalars().first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    await db.delete(review)
    await db.commit()
    logger.info(
        "Review deleted by admin",
        extra={
            "action": "admin_delete_review",
            "admin_user_id": _admin_user.id,
            "admin_email": _admin_user.email,
            "review_id": review_id,
        },
    )
