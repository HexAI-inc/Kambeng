"""Admin one-page overviews of a campaign and a user, and public campaign facts."""

import pytest
from sqlalchemy.future import select

from app.core.security import get_password_hash
from app.models.campaign import Campaign, CampaignMode
from app.models.campaign_update import CampaignUpdate
from app.models.donation import Donation
from app.models.kyc import KYC
from app.models.payout import Payout
from app.models.user import User


async def _admin_headers(async_client, db_session, wave="+2207096001"):
    db_session.add(User(
        full_name="Overview Admin", email="overview-admin@example.com", wave_number=wave,
        password_hash=get_password_hash("AdminPass123!"), role="ADMIN", is_email_verified=True,
    ))
    await db_session.commit()
    login = await async_client.post("/api/auth/login", json={"username": wave, "password": "AdminPass123!"})
    return {"Authorization": f"Bearer {login.json()['data']['tokens']['accessToken']}"}


async def _seed(db_session):
    owner = User(full_name="Awa Owner", email="awa@example.com", wave_number="+2207096100", password_hash="x", kyc_status="APPROVED")
    donor = User(full_name="Musa Donor", email="musa@example.com", wave_number="+2207096101", password_hash="x")
    db_session.add_all([owner, donor])
    await db_session.commit()
    campaign = Campaign(user_id=owner.id, title="School roof", slug="school-roof", description="Fix it", mode=CampaignMode.ONGOING, amount_raised=148.0)
    db_session.add(campaign)
    await db_session.commit()
    db_session.add_all([
        KYC(user_id=owner.id, document_type="NATIONAL_ID", document_file_url="kyc/1/id.jpg", status="APPROVED"),
        # Two gifts from Musa (account and the same email), one anonymous, one failed.
        Donation(campaign_id=campaign.id, client_reference="DON-OV-1", amount=100.0, status="SUCCEEDED", provider="wave", user_id=donor.id, donor_name="Musa"),
        Donation(campaign_id=campaign.id, client_reference="DON-OV-2", amount=25.0, status="SUCCEEDED", provider="aps", donor_email="MUSA@example.com"),
        Donation(campaign_id=campaign.id, client_reference="DON-OV-3", amount=25.0, status="SUCCEEDED", provider="wave"),
        Donation(campaign_id=campaign.id, client_reference="DON-OV-4", amount=500.0, status="FAILED", provider="wave"),
        Payout(campaign_id=campaign.id, client_reference="PAYOUT-OV-1", gross_amount=60.0, hexai_fee=2.0, platform_commission=10.0,
               net_amount=48.0, amount=48.0, status="SUCCEEDED", requested_by_user_id=owner.id),
        CampaignUpdate(campaign_id=campaign.id, user_id=owner.id, text="Bought sheets", amount_spent=48.0),
    ])
    await db_session.commit()
    return owner, donor, campaign


@pytest.mark.asyncio
async def test_campaign_overview_gathers_everything(async_client, db_session):
    headers = await _admin_headers(async_client, db_session)
    owner, _, campaign = await _seed(db_session)

    resp = await async_client.get(f"/api/admin/campaigns/{campaign.id}/overview", headers=headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert data["campaign"]["slug"] == "school-roof"
    assert data["owner"]["email"] == "awa@example.com"
    assert data["owner"]["kyc_submissions"][0]["status"] == "APPROVED"
    stats = data["donation_stats"]
    assert (stats["succeeded"], stats["failed"], stats["gross"]) == (3, 1, 150.0)
    assert len(data["donations"]) == 4
    assert data["payouts"][0]["debit"] == 60.0
    m = data["money"]
    # 98 + 25 + 25 net, matching what is stored.
    assert (m["expected"], m["withdrawn"], m["issues"]) == (148.0, 60.0, [])
    assert m["spending"]["accounted_for"] == 48.0
    assert len(data["updates"]) == 1

    assert (await async_client.get("/api/admin/campaigns/99999/overview", headers=headers)).status_code == 404
    assert (await async_client.get(f"/api/admin/campaigns/{campaign.id}/overview")).status_code == 401


@pytest.mark.asyncio
async def test_user_overview_shows_both_sides_of_their_money(async_client, db_session):
    headers = await _admin_headers(async_client, db_session)
    owner, donor, campaign = await _seed(db_session)

    owner_view = (await async_client.get(f"/api/admin/users/{owner.id}/overview", headers=headers)).json()
    assert owner_view["user"]["email"] == "awa@example.com"
    assert owner_view["kyc_submissions"][0]["document_type"] == "NATIONAL_ID"
    assert owner_view["campaigns"][0]["withdrawn"] == 60.0
    t = owner_view["totals"]
    assert (t["campaigns"], t["donations_received"], t["withdrawn"], t["sent_to_wave"]) == (1, 3, 60.0, 48.0)
    assert owner_view["withdrawals"][0]["campaign_title"] == "School roof"

    donor_view = (await async_client.get(f"/api/admin/users/{donor.id}/overview", headers=headers)).json()
    # Matched by account and by email.
    assert {d["client_reference"] for d in donor_view["donations_made"]} == {"DON-OV-1", "DON-OV-2"}
    assert donor_view["totals"]["given"] == 125.0
    assert donor_view["donations_made"][0]["campaign_title"] == "School roof"


@pytest.mark.asyncio
async def test_public_campaign_stats_and_card_counts(async_client, db_session):
    await _seed(db_session)
    stats = (await async_client.get("/api/campaigns/school-roof/stats")).json()
    # Musa (account + email are separate identities here) and one anonymous gift.
    assert stats["donations_count"] == 3
    assert stats["donors_count"] == 3
    assert stats["largest_donation"] == 100.0
    assert (stats["updates_count"], stats["receipts_count"], stats["organizer_campaigns"]) == (1, 1, 1)
    assert stats["created_at"] and stats["organizer_since"]
    # No donor identities leak.
    assert not any(k in stats for k in ("donors", "donations", "emails"))

    cards = (await async_client.get("/api/utils/frontend/campaign-cards")).json()
    card = next(c for c in (cards if isinstance(cards, list) else cards.get("items", [])) if c["slug"] == "school-roof")
    assert card["donations_count"] == 3
