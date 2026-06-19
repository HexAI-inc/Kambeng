import asyncio

from sqlalchemy import select

from app.db.database import AsyncSessionLocal
from app.core.security import get_password_hash
# Import all models so SQLAlchemy can resolve every relationship before queries run
from app.models.user import User
from app.models.campaign import Campaign, CampaignMode, CampaignStatus
from app.models.campaign_goal import CampaignGoal  # noqa: F401
from app.models.campaign_update import CampaignUpdate  # noqa: F401
from app.models.update_attachment import UpdateAttachment  # noqa: F401
from app.models.donation import Donation  # noqa: F401
from app.models.payout import Payout  # noqa: F401
from app.models.proof import Proof  # noqa: F401
from app.models.review import Review  # noqa: F401
from app.models.kyc import KYC  # noqa: F401
from app.models.ledger import TransactionLedger  # noqa: F401
from app.models.audit_log import AdminAuditLog  # noqa: F401
from app.models.alias import CampaignAlias  # noqa: F401
from app.models.moderation import ModerationReport  # noqa: F401
from app.models.fraud_report import FraudReport  # noqa: F401
from app.models.fraud_report_notification_email import FraudReportNotificationEmail  # noqa: F401
from app.models.kyc_notification_email import KYCNotificationEmail  # noqa: F401
from app.models.recurring_donation import RecurringDonation  # noqa: F401


def _seed_users() -> list[dict]:
    return [
        {
            "full_name": "Kambeng Admin",
            "email": "admin@kambeng.local",
            "wave_number": "+2207000000",
            "password": "AdminPass123!",
            "role": "ADMIN",
            "is_email_verified": True,
        },
        {
            "full_name": "Awa Bah",
            "email": "awa@kambeng.local",
            "wave_number": "+2207000001",
            "password": "StrongPass123!",
            "role": "USER",
            "is_email_verified": True,
        },
        {
            "full_name": "Musa Jallow",
            "email": "musa@kambeng.local",
            "wave_number": "+2207000002",
            "password": "StrongPass123!",
            "role": "USER",
            "is_email_verified": True,
        },
    ]


async def seed_users() -> dict[str, int]:
    created = 0
    existing = 0
    user_ids_by_email: dict[str, int] = {}

    async with AsyncSessionLocal() as session:
        for data in _seed_users():
            result = await session.execute(select(User).where(User.email == data["email"]))
            user = result.scalar_one_or_none()

            if user is None:
                user = User(
                    full_name=data["full_name"],
                    email=data["email"],
                    wave_number=data["wave_number"],
                    password_hash=get_password_hash(data["password"]),
                    role=data["role"],
                    is_email_verified=data["is_email_verified"],
                    kyc_status="APPROVED" if data["role"] == "USER" else "NOT_SUBMITTED",
                )
                session.add(user)
                await session.flush()
                created += 1
            else:
                existing += 1

            user_ids_by_email[user.email] = user.id

        await session.commit()

    print(f"Users: created={created}, existing={existing}")
    return user_ids_by_email


async def seed_campaigns(user_ids_by_email: dict[str, int]) -> None:
    campaign_rows = [
        {
            "title": "Books For Basse Schools",
            "slug": "books-for-basse-schools",
            "description": "Fund books and classroom materials for students in Basse.",
            "mode": CampaignMode.TARGET,
            "target_amount": 50000.0,
            "amount_raised": 12500.0,
            "status": CampaignStatus.ACTIVE,
            "owner_email": "awa@kambeng.local",
        },
        {
            "title": "Serrekunda Clinic Equipment",
            "slug": "serrekunda-clinic-equipment",
            "description": "Raise funds to buy essential diagnostic tools for a community clinic.",
            "mode": CampaignMode.ONGOING,
            "target_amount": None,
            "amount_raised": 8000.0,
            "status": CampaignStatus.ACTIVE,
            "owner_email": "musa@kambeng.local",
        },
    ]

    created = 0
    existing = 0

    async with AsyncSessionLocal() as session:
        for row in campaign_rows:
            result = await session.execute(select(Campaign).where(Campaign.slug == row["slug"]))
            campaign = result.scalar_one_or_none()
            if campaign is not None:
                existing += 1
                continue

            owner_id = user_ids_by_email[row["owner_email"]]
            campaign = Campaign(
                user_id=owner_id,
                title=row["title"],
                slug=row["slug"],
                description=row["description"],
                mode=row["mode"],
                target_amount=row["target_amount"],
                amount_raised=row["amount_raised"],
                status=row["status"],
            )
            session.add(campaign)
            created += 1

        await session.commit()

    print(f"Campaigns: created={created}, existing={existing}")


async def main() -> None:
    print("Seeding database...")
    user_ids_by_email = await seed_users()
    await seed_campaigns(user_ids_by_email)
    print("Seed complete.")
    print("Demo credentials:")
    print("- Admin: +2207000000 / AdminPass123!")
    print("- User: +2207000001 / StrongPass123!")


if __name__ == "__main__":
    asyncio.run(main())
