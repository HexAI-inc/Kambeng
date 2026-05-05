from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.routes.auth import get_current_user
from app.core.logging_config import get_logger
from app.db.database import get_db
from app.models.campaign import Campaign
from app.models.campaign_goal import CampaignGoal, GoalStatus
from app.models.user import User
from app.schemas.campaign_goal import CampaignGoalCreate, CampaignGoalRead, CampaignGoalUpdate


router = APIRouter(prefix="/goals", tags=["Goals"])
logger = get_logger("goals")


async def _get_campaign_by_slug(db: AsyncSession, slug: str) -> Campaign | None:
    result = await db.execute(select(Campaign).where(Campaign.slug == slug))
    return result.scalars().first()


async def _get_campaign_by_id(db: AsyncSession, campaign_id: int) -> Campaign | None:
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    return result.scalars().first()


async def _get_goal_by_id(db: AsyncSession, goal_id: int) -> CampaignGoal | None:
    result = await db.execute(select(CampaignGoal).where(CampaignGoal.id == goal_id))
    return result.scalars().first()


@router.get("/campaigns/{slug}", response_model=List[CampaignGoalRead])
async def list_campaign_goals(slug: str, db: AsyncSession = Depends(get_db)):
    campaign = await _get_campaign_by_slug(db, slug)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    result = await db.execute(
        select(CampaignGoal)
        .where(CampaignGoal.campaign_id == campaign.id)
        .where(CampaignGoal.status != GoalStatus.DRAFT)
        .order_by(CampaignGoal.sort_order.asc(), CampaignGoal.created_at.asc())
    )
    return result.scalars().all()


@router.get("/campaigns/{slug}/manage", response_model=List[CampaignGoalRead])
async def list_campaign_goals_for_owner(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    campaign = await _get_campaign_by_slug(db, slug)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.user_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized to manage goals for this campaign")

    result = await db.execute(
        select(CampaignGoal)
        .where(CampaignGoal.campaign_id == campaign.id)
        .order_by(CampaignGoal.sort_order.asc(), CampaignGoal.created_at.asc())
    )
    return result.scalars().all()


@router.post("/campaigns/{slug}", response_model=CampaignGoalRead, status_code=status.HTTP_201_CREATED)
async def create_campaign_goal(
    slug: str,
    goal_in: CampaignGoalCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    campaign = await _get_campaign_by_slug(db, slug)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.user_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized to create goals for this campaign")

    goal = CampaignGoal(
        campaign_id=campaign.id,
        title=goal_in.title.strip(),
        description=goal_in.description.strip() if goal_in.description else None,
        target_amount=goal_in.target_amount,
        due_date=goal_in.due_date,
        status=goal_in.status,
        sort_order=goal_in.sort_order,
    )
    db.add(goal)
    await db.commit()
    await db.refresh(goal)

    logger.info(
        "Campaign goal created",
        extra={
            "action": "create_campaign_goal",
            "user_id": current_user.id,
            "email": current_user.email,
            "campaign_id": campaign.id,
            "goal_id": goal.id,
            "target_amount": goal.target_amount,
        },
    )
    return goal


@router.put("/{goal_id}", response_model=CampaignGoalRead)
async def update_campaign_goal(
    goal_id: int,
    goal_in: CampaignGoalUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    goal = await _get_goal_by_id(db, goal_id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    campaign = await _get_campaign_by_id(db, goal.campaign_id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.user_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized to update this goal")

    if goal_in.title is not None:
        goal.title = goal_in.title.strip()
    if goal_in.description is not None:
        goal.description = goal_in.description.strip() if goal_in.description else None
    if goal_in.target_amount is not None:
        goal.target_amount = goal_in.target_amount
    if goal_in.due_date is not None:
        goal.due_date = goal_in.due_date
    if goal_in.sort_order is not None:
        goal.sort_order = goal_in.sort_order
    if goal_in.status is not None:
        goal.status = goal_in.status

    await db.commit()
    await db.refresh(goal)
    return goal
