import pytest

from app.models.campaign import Campaign, CampaignMode, CampaignStatus
from app.models.user import User


async def _make_user(db_session, **overrides):
    defaults = dict(
        full_name="Awa Organizer",
        email="awa-organizer@example.com",
        wave_number="+2207001111",
        password_hash="x",
        kyc_status="APPROVED",
        bio="Community fundraiser in Banjul.",
    )
    defaults.update(overrides)
    user = User(**defaults)
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.mark.asyncio
async def test_public_profile_shows_organizer_and_campaigns(async_client, db_session):
    user = await _make_user(db_session)

    active = Campaign(user_id=user.id, title="Clean Water", slug="clean-water", description="", mode=CampaignMode.ONGOING, status=CampaignStatus.ACTIVE)
    suspended = Campaign(user_id=user.id, title="Hidden", slug="hidden-camp", description="", mode=CampaignMode.ONGOING, status=CampaignStatus.SUSPENDED)
    db_session.add_all([active, suspended])
    await db_session.commit()

    resp = await async_client.get(f"/api/profiles/{user.id}")
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["id"] == user.id
    assert body["full_name"] == "Awa Organizer"
    assert body["bio"] == "Community fundraiser in Banjul."
    assert body["kyc_verified"] is True
    assert body["member_since"] is not None
    # no contact details leaked
    assert "email" not in body
    assert "wave_number" not in body
    # suspended campaigns are hidden from the public profile
    slugs = [c["slug"] for c in body["campaigns"]]
    assert "clean-water" in slugs
    assert "hidden-camp" not in slugs


@pytest.mark.asyncio
async def test_public_profile_unverified_user_and_404(async_client, db_session):
    user = await _make_user(
        db_session,
        email="unverified@example.com",
        wave_number="+2207002222",
        kyc_status="NOT_SUBMITTED",
        bio=None,
    )

    resp = await async_client.get(f"/api/profiles/{user.id}")
    assert resp.status_code == 200
    assert resp.json()["kyc_verified"] is False

    missing = await async_client.get("/api/profiles/999999")
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_campaign_detail_includes_owner_attribution(async_client, db_session):
    user = await _make_user(db_session, email="owner@example.com", wave_number="+2207003333")

    campaign = Campaign(user_id=user.id, title="Owner Attribution", slug="owner-attribution", description="", mode=CampaignMode.ONGOING, status=CampaignStatus.ACTIVE)
    db_session.add(campaign)
    await db_session.commit()

    resp = await async_client.get("/api/campaigns/owner-attribution")
    assert resp.status_code == 200, resp.text
    owner = resp.json()["owner"]
    assert owner["id"] == user.id
    assert owner["full_name"] == "Awa Organizer"
    assert owner["kyc_verified"] is True
    # attribution must not leak contact details
    assert "email" not in owner
    assert "wave_number" not in owner


@pytest.mark.asyncio
async def test_update_own_bio_via_me(async_client):
    register = await async_client.post(
        "/api/auth/register",
        json={
            "full_name": "Bio Editor",
            "email": "bio-editor@example.com",
            "wave_number": "+2207004444",
            "password": "StrongPass123!",
        },
    )
    assert register.status_code == 201, register.text

    login = await async_client.post(
        "/api/auth/login",
        json={"username": "+2207004444", "password": "StrongPass123!"},
    )
    assert login.status_code == 200, login.text
    token = login.json()["data"]["tokens"]["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}

    resp = await async_client.patch("/api/auth/me", json={"bio": "  I run school fundraisers.  "}, headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["bio"] == "I run school fundraisers."

    cleared = await async_client.patch("/api/auth/me", json={"bio": "   "}, headers=headers)
    assert cleared.status_code == 200
    assert cleared.json()["bio"] is None

    too_long = await async_client.patch("/api/auth/me", json={"bio": "x" * 501}, headers=headers)
    assert too_long.status_code == 422
