import asyncio
import sys
from pathlib import Path
from urllib.request import Request, urlopen

from sqlalchemy import select

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import models as _models  # noqa: F401
from app.db.database import AsyncSessionLocal
from app.models.alias import CampaignAlias  # noqa: F401
from app.models.audit_log import AdminAuditLog  # noqa: F401
from app.models.campaign import Campaign
from app.models.kyc import KYC  # noqa: F401
from app.models.ledger import TransactionLedger  # noqa: F401
from app.models.moderation import ModerationReport  # noqa: F401
from app.models.recurring_donation import RecurringDonation  # noqa: F401

# Curated campaign descriptions keyed by slug. Fallback is generated when missing.
CAMPAIGN_DESCRIPTION_UPDATES: dict[str, str] = {
    "books-for-basse-schools": (
        "This campaign supports students in Basse with textbooks, exercise books, and core classroom supplies. "
        "Funds are used transparently for term-by-term procurement, teacher resource packs, and shared reading corners "
        "so pupils can study consistently both in class and at home."
    ),
    "serrekunda-clinic-equipment": (
        "This fundraiser equips a community clinic in Serrekunda with essential diagnostic tools and basic care equipment. "
        "Donations help purchase blood pressure monitors, thermometers, weighing scales, and emergency first-response materials "
        "to improve early diagnosis and day-to-day patient care."
    ),
    "clean-water-for-bakau": (
        "This project provides reliable clean water access for families in Bakau through borehole upgrades and safe storage. "
        "Support goes toward filtration materials, maintenance training, and community-managed water points to reduce shortages "
        "and improve household health outcomes."
    ),
    "school-meals-for-farafenni": (
        "This campaign helps serve nutritious school meals for children in Farafenni, especially during high-cost periods. "
        "Contributions fund rice, protein, vegetables, and meal preparation logistics so students can stay focused, "
        "attend regularly, and perform better throughout the academic term."
    ),
    "community-solar-lights": (
        "This initiative installs and maintains solar street lights in high-footfall community areas. "
        "Funding covers durable solar units, installation hardware, and local technician support so roads, markets, "
        "and shared spaces remain safer and usable after dark."
    ),
    "womens-tailoring-hub": (
        "This campaign supports a shared tailoring hub for women-led microbusinesses and trainees. "
        "Donations are used to purchase sewing machines, starter materials, and practical training supplies "
        "that help participants build income-generating skills and stable livelihoods."
    ),
    "library-renovation-drive": (
        "This drive renovates a local library to create a brighter and more functional learning environment. "
        "Funds support shelf repairs, reading tables, lighting, and updated learning resources so students and families "
        "can access a safer, more welcoming space for study and research."
    ),
}


def _image_url_for_campaign(campaign: Campaign) -> str:
    # picsum provides deterministic images by seed, useful for repeatable local dev data.
    return f"https://picsum.photos/seed/{campaign.slug}-kambeng/1400/900.jpg"


def _image_path_for_campaign(campaign: Campaign, uploads_root: Path) -> Path:
    campaign_dir = uploads_root / "campaigns" / str(campaign.id)
    campaign_dir.mkdir(parents=True, exist_ok=True)
    return campaign_dir / f"{campaign.slug}-cover.jpg"


def _download_image(url: str, destination: Path) -> None:
    request = Request(url, headers={"User-Agent": "kambeng-dev-seeder/1.0"})
    with urlopen(request, timeout=30) as response:
        data = response.read()
    destination.write_bytes(data)


async def enrich_campaigns() -> None:
    uploads_root = Path(__file__).resolve().parents[1] / "uploads"

    updated_descriptions = 0
    downloaded_images = 0
    skipped_images = 0

    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Campaign))
        campaigns = result.scalars().all()

        for campaign in campaigns:
            description = CAMPAIGN_DESCRIPTION_UPDATES.get(campaign.slug)
            if description and campaign.description != description:
                campaign.description = description
                updated_descriptions += 1

            image_path = _image_path_for_campaign(campaign, uploads_root)
            if image_path.exists():
                skipped_images += 1
                continue

            try:
                _download_image(_image_url_for_campaign(campaign), image_path)
                downloaded_images += 1
            except Exception as exc:
                print(f"Failed to download image for {campaign.slug}: {exc}")

        await session.commit()

    print(f"Updated descriptions: {updated_descriptions}")
    print(f"Downloaded images: {downloaded_images}")
    print(f"Skipped existing images: {skipped_images}")


async def main() -> None:
    print("Enriching campaigns with stock images and richer descriptions...")
    await enrich_campaigns()
    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
