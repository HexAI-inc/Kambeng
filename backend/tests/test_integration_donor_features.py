import pytest
from sqlalchemy.future import select

from app.models.campaign import Campaign, CampaignMode, CampaignStatus
from app.models.campaign_subscription import CampaignSubscription
from app.models.donation import Donation
from app.models.user import User
import app.api.routes.payments as payments_router


async def _register_and_login(async_client, *, name, email, wave):
    register = await async_client.post(
        "/api/auth/register",
        json={"full_name": name, "email": email, "wave_number": wave, "password": "StrongPass123!"},
    )
    assert register.status_code == 201, register.text
    login = await async_client.post("/api/auth/login", json={"username": wave, "password": "StrongPass123!"})
    assert login.status_code == 200, login.text
    token = login.json()["data"]["tokens"]["accessToken"]
    return {"Authorization": f"Bearer {token}"}, register.json()["id"]


async def _seed_campaign(db_session, *, slug="donor-feat-camp", owner_wave="+2207020001", owner_email="owner-donor-feat@example.com"):
    owner = User(full_name="Camp Owner", email=owner_email, wave_number=owner_wave, password_hash="x")
    db_session.add(owner)
    await db_session.commit()
    await db_session.refresh(owner)

    campaign = Campaign(user_id=owner.id, title=f"Camp {slug}", slug=slug, description="", mode=CampaignMode.ONGOING, status=CampaignStatus.ACTIVE)
    db_session.add(campaign)
    await db_session.commit()
    await db_session.refresh(campaign)
    return owner, campaign


@pytest.mark.asyncio
async def test_logged_in_donation_links_account_and_history(async_client, db_session, monkeypatch):
    _, campaign = await _seed_campaign(db_session)
    headers, donor_id = await _register_and_login(
        async_client, name="Donor One", email="donor1@example.com", wave="+2207020002"
    )

    async def fake_initiate_donation(**kwargs):
        return {"data": {"redirect_url": "https://pay.example/x"}}

    monkeypatch.setattr(payments_router.hexai_service, "initiate_donation", fake_initiate_donation)

    # logged-in donation gets linked
    resp = await async_client.post(
        "/api/payments/donate",
        json={"campaign_id": campaign.id, "amount": 100.0, "donor_name": "Donor One"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    ref = resp.json()["client_reference"]

    donation = (await db_session.execute(select(Donation).where(Donation.client_reference == ref))).scalars().first()
    assert donation.user_id == donor_id

    # anonymous donation stays unlinked
    anon = await async_client.post(
        "/api/payments/donate",
        json={"campaign_id": campaign.id, "amount": 50.0},
    )
    assert anon.status_code == 200, anon.text
    anon_ref = anon.json()["client_reference"]
    anon_donation = (await db_session.execute(select(Donation).where(Donation.client_reference == anon_ref))).scalars().first()
    assert anon_donation.user_id is None

    # giving history shows only the linked donation
    history = await async_client.get("/api/payments/donations/me", headers=headers)
    assert history.status_code == 200
    items = history.json()
    assert len(items) == 1
    assert items[0]["client_reference"] == ref
    assert items[0]["campaign_slug"] == campaign.slug


@pytest.mark.asyncio
async def test_subscribe_unsubscribe_and_list(async_client, db_session):
    _, campaign = await _seed_campaign(db_session, slug="sub-camp", owner_wave="+2207020003", owner_email="owner-sub@example.com")
    headers, user_id = await _register_and_login(
        async_client, name="Follower", email="follower@example.com", wave="+2207020004"
    )

    # subscribe (idempotent)
    first = await async_client.post(f"/api/campaigns/{campaign.slug}/subscribe", headers=headers)
    assert first.status_code == 201
    again = await async_client.post(f"/api/campaigns/{campaign.slug}/subscribe", headers=headers)
    assert again.status_code == 201
    count = (await db_session.execute(
        select(CampaignSubscription).where(CampaignSubscription.user_id == user_id)
    )).scalars().all()
    assert len(count) == 1

    status_resp = await async_client.get(f"/api/campaigns/{campaign.slug}/subscription", headers=headers)
    assert status_resp.json()["subscribed"] is True

    listing = await async_client.get("/api/me/subscriptions", headers=headers)
    assert listing.status_code == 200
    assert [c["campaign_slug"] for c in listing.json()] == ["sub-camp"]

    # unsubscribe
    off = await async_client.delete(f"/api/campaigns/{campaign.slug}/subscribe", headers=headers)
    assert off.json()["subscribed"] is False
    status_resp2 = await async_client.get(f"/api/campaigns/{campaign.slug}/subscription", headers=headers)
    assert status_resp2.json()["subscribed"] is False

    # auth required
    anon = await async_client.post(f"/api/campaigns/{campaign.slug}/subscribe")
    assert anon.status_code == 401


@pytest.mark.asyncio
async def test_new_update_emails_subscribers(async_client, db_session, monkeypatch):
    owner, campaign = await _seed_campaign(db_session, slug="notify-camp", owner_wave="+2207020005", owner_email="owner-notify@example.com")
    headers, _ = await _register_and_login(
        async_client, name="Notified Fan", email="fan@example.com", wave="+2207020006"
    )
    sub = await async_client.post(f"/api/campaigns/{campaign.slug}/subscribe", headers=headers)
    assert sub.status_code == 201

    sent = []
    import app.services.email_service as email_service

    monkeypatch.setattr(email_service, "send_email", lambda to, subj, html: sent.append((to, subj)) or True)

    # owner posts an update
    from app.api.routes.auth import get_current_user
    from app.main import app as fastapi_app

    async def _owner_override():
        return owner

    fastapi_app.dependency_overrides[get_current_user] = _owner_override
    try:
        resp = await async_client.post(
            f"/api/campaigns/{campaign.slug}/updates",
            data={"text": "We bought the first batch of books today. Thank you all!"},
        )
        assert resp.status_code == 201, resp.text
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)

    assert len(sent) == 1
    to, subject = sent[0]
    assert to == "fan@example.com"
    assert campaign.title in subject


@pytest.mark.asyncio
async def test_account_purpose_preference(async_client):
    headers, _ = await _register_and_login(
        async_client, name="Purpose User", email="purpose@example.com", wave="+2207020007"
    )

    resp = await async_client.patch("/api/auth/me", json={"account_purpose": "DONATE"}, headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["account_purpose"] == "DONATE"

    invalid = await async_client.patch("/api/auth/me", json={"account_purpose": "OVERLORD"}, headers=headers)
    assert invalid.status_code == 422