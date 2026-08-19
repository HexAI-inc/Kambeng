import pytest
from sqlalchemy.future import select

from app.core.security import get_password_hash
from app.models.campaign import Campaign, CampaignMode, CampaignStatus
from app.models.subscriber import Subscriber
from app.models.user import User


async def _seed_campaign(db_session, *, slug="mkt-camp"):
    owner = User(full_name="Mkt Owner", email=f"owner-{slug}@example.com", wave_number=f"+2207088{abs(hash(slug)) % 1000:03d}", password_hash="x")
    db_session.add(owner)
    await db_session.commit()
    await db_session.refresh(owner)

    campaign = Campaign(user_id=owner.id, title=f"Camp {slug}", slug=slug, description="d", mode=CampaignMode.ONGOING, status=CampaignStatus.ACTIVE)
    db_session.add(campaign)
    await db_session.commit()
    await db_session.refresh(campaign)
    return campaign


async def _admin_headers(async_client, db_session, *, wave="+2207999911"):
    admin = User(
        full_name="Mkt Admin",
        email="mkt-admin@example.com",
        wave_number=wave,
        password_hash=get_password_hash("AdminPass123!"),
        role="ADMIN",
        is_email_verified=True,
    )
    db_session.add(admin)
    await db_session.commit()
    login = await async_client.post("/api/auth/login", json={"username": wave, "password": "AdminPass123!"})
    assert login.status_code == 200, login.text
    token = login.json()["data"]["tokens"]["accessToken"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_subscribe_confirm_and_unsubscribe_flow(async_client, db_session):
    # Capture from the homepage
    resp = await async_client.post("/api/subscribe", json={"email": "Fan@Example.com", "source": "homepage"})
    assert resp.status_code == 201, resp.text
    assert resp.json()["subscribed"] is True

    row = (await db_session.execute(select(Subscriber).where(Subscriber.email == "fan@example.com"))).scalars().first()
    assert row is not None
    assert row.source == "homepage"
    assert row.confirmed is False
    assert row.confirm_token and row.unsubscribe_token

    # Re-subscribing is idempotent
    resp = await async_client.post("/api/subscribe", json={"email": "fan@example.com", "source": "homepage"})
    assert resp.status_code == 201
    assert resp.json()["already_subscribed"] is True

    # Double opt-in confirmation fires the day-0 welcome email (stage advances)
    resp = await async_client.get(f"/api/subscribe/confirm?token={row.confirm_token}")
    assert resp.status_code == 200
    assert resp.json()["confirmed"] is True
    await db_session.refresh(row)
    assert row.confirmed is True
    assert row.sequence_stage == 1

    # One-click unsubscribe
    resp = await async_client.get(f"/api/unsubscribe?token={row.unsubscribe_token}")
    assert resp.status_code == 200
    await db_session.refresh(row)
    assert row.unsubscribed is True

    # Bad tokens are rejected
    assert (await async_client.get("/api/subscribe/confirm?token=not-a-real-token")).status_code == 404
    assert (await async_client.get("/api/unsubscribe?token=not-a-real-token")).status_code == 404


@pytest.mark.asyncio
async def test_campaign_follow_requires_campaign(async_client, db_session):
    resp = await async_client.post("/api/subscribe", json={"email": "f@example.com", "source": "campaign_follow"})
    assert resp.status_code == 422

    campaign = await _seed_campaign(db_session, slug="mkt-follow")
    resp = await async_client.post(
        "/api/subscribe",
        json={"email": "f@example.com", "source": "campaign_follow", "campaign_slug": "mkt-follow"},
    )
    assert resp.status_code == 201
    row = (await db_session.execute(select(Subscriber).where(Subscriber.email == "f@example.com"))).scalars().first()
    assert row.campaign_id == campaign.id

    resp = await async_client.post(
        "/api/subscribe",
        json={"email": "x@example.com", "source": "campaign_follow", "campaign_slug": "does-not-exist"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_waitlist_capture_stores_lead_details(async_client, db_session):
    resp = await async_client.post(
        "/api/subscribe",
        json={
            "email": "organiser@example.com",
            "source": "waitlist",
            "name": "Fatou",
            "phone": "+2207001122",
            "fundraising_goal": "New roof for Latrikunda school",
        },
    )
    assert resp.status_code == 201
    row = (await db_session.execute(select(Subscriber).where(Subscriber.email == "organiser@example.com"))).scalars().first()
    assert row.name == "Fatou"
    assert row.fundraising_goal == "New roof for Latrikunda school"


@pytest.mark.asyncio
async def test_admin_stats_list_and_broadcast(async_client, db_session):
    headers = await _admin_headers(async_client, db_session)

    # Admin endpoints reject non-admins
    assert (await async_client.get("/api/admin/marketing/stats")).status_code in (401, 403)

    for i, source in enumerate(["homepage", "waitlist", "guide"]):
        resp = await async_client.post("/api/subscribe", json={"email": f"s{i}@example.com", "source": source})
        assert resp.status_code == 201

    # Confirm one subscriber so the broadcast has an audience
    row = (await db_session.execute(select(Subscriber).where(Subscriber.email == "s0@example.com"))).scalars().first()
    resp = await async_client.get(f"/api/subscribe/confirm?token={row.confirm_token}")
    assert resp.status_code == 200

    stats = (await async_client.get("/api/admin/marketing/stats", headers=headers)).json()
    assert stats["total"] == 3
    assert stats["confirmed"] == 1
    assert stats["by_source"]["homepage"] == 1

    listing = (await async_client.get("/api/admin/marketing/subscribers", headers=headers, params={"source": "waitlist"})).json()
    assert listing["total"] == 1
    assert listing["items"][0]["email"] == "s1@example.com"

    broadcast = await async_client.post(
        "/api/admin/marketing/broadcast",
        headers=headers,
        json={"subject": "Weekly update", "heading": "One community, fully funded", "body": "This week a campaign hit its target.\nSee the proof on the campaign page."},
    )
    assert broadcast.status_code == 200, broadcast.text
    body = broadcast.json()
    assert body["recipients"] == 1
    assert body["sent"] == 1
