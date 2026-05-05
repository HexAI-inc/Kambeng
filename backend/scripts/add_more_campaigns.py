import asyncio
import sys
from pathlib import Path
from typing import Any

from sqlalchemy import select

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import models as _models  # noqa: F401
from app.db.database import AsyncSessionLocal
from app.models.alias import CampaignAlias  # noqa: F401
from app.models.audit_log import AdminAuditLog  # noqa: F401
from app.models.campaign import Campaign, CampaignMode, CampaignStatus
from app.models.kyc import KYC  # noqa: F401
from app.models.ledger import TransactionLedger  # noqa: F401
from app.models.moderation import ModerationReport  # noqa: F401
from app.models.user import User


CAMPAIGNS_TO_SEED: list[dict[str, Any]] = [
    {
        "title": "Clean Water for Bakau",
        "slug": "clean-water-for-bakau",
        "description": "Support a borehole and water storage system for families in Bakau.",
        "mode": CampaignMode.TARGET,
        "target_amount": 15000.0,
        "amount_raised": 6500.0,
        "status": CampaignStatus.ACTIVE,
        "owner_email": "awa@kambeng.local",
    },
    {
        "title": "School Meals for Farafenni",
        "slug": "school-meals-for-farafenni",
        "description": "Help provide daily nutritious meals for primary school children in Farafenni.",
        "mode": CampaignMode.TARGET,
        "target_amount": 25000.0,
        "amount_raised": 9800.0,
        "status": CampaignStatus.ACTIVE,
        "owner_email": "musa@kambeng.local",
    },
    {
        "title": "Community Solar Lights",
        "slug": "community-solar-lights",
        "description": "Install solar street lights to improve safety and extend evening activity.",
        "mode": CampaignMode.ONGOING,
        "target_amount": None,
        "amount_raised": 4200.0,
        "status": CampaignStatus.ACTIVE,
        "owner_email": "awa@kambeng.local",
    },
    {
        "title": "Women's Tailoring Hub",
        "slug": "womens-tailoring-hub",
        "description": "Equip a shared tailoring workshop with machines and starter materials.",
        "mode": CampaignMode.TARGET,
        "target_amount": 18000.0,
        "amount_raised": 3000.0,
        "status": CampaignStatus.ACTIVE,
        "owner_email": "musa@kambeng.local",
    },
    {
        "title": "Library Renovation Drive",
        "slug": "library-renovation-drive",
        "description": "Renovate the community library, add shelves, and expand reading space.",
        "mode": CampaignMode.TARGET,
        "target_amount": 12000.0,
        "amount_raised": 5400.0,
        "status": CampaignStatus.ACTIVE,
        "owner_email": "admin@kambeng.local",
    },
]


def normalize_slug(value: str) -> str:
    slug = "".join(char.lower() if char.isalnum() else "-" for char in value)
    while "--" in slug:
        slug = slug.replace("--", "-")
    return slug.strip("-")


async def load_users() -> dict[str, int]:
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User))
        users = result.scalars().all()
        return {user.email: user.id for user in users}


async def seed_campaigns() -> None:
    user_ids_by_email = await load_users()
    created = 0
    existing = 0
    skipped = 0

    async with AsyncSessionLocal() as session:
        for row in CAMPAIGNS_TO_SEED:
            owner_id = user_ids_by_email.get(row["owner_email"])
            if owner_id is None:
                skipped += 1
                print(f"Skipping {row['title']!r}: owner {row['owner_email']!r} was not found")
                continue

            result = await session.execute(select(Campaign).where(Campaign.slug == row["slug"]))
            campaign = result.scalar_one_or_none()
            if campaign is not None:
                existing += 1
                continue

            slug = normalize_slug(row["slug"] or row["title"])
            result = await session.execute(select(Campaign).where(Campaign.slug == slug))
            if result.scalar_one_or_none() is not None:
                suffix = row["title"].lower().replace(" ", "-")[:6]
                slug = f"{slug}-{suffix}"

            campaign = Campaign(
                user_id=owner_id,
                title=row["title"],
                slug=slug,
                description=row["description"],
                mode=row["mode"],
                target_amount=row["target_amount"],
                amount_raised=row["amount_raised"],
                status=row["status"],
            )
            session.add(campaign)
            created += 1

        await session.commit()

    print(f"Campaigns: created={created}, existing={existing}, skipped={skipped}")


async def main() -> None:
    print("Adding more campaigns...")
    await seed_campaigns()
    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
