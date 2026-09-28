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


PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


async def _login(async_client, db_session, wave_number, **overrides):
    from app.core.security import get_password_hash

    await _make_user(
        db_session, email=f"{wave_number}@example.com", wave_number=wave_number,
        password_hash=get_password_hash("secret-pass-1"), **overrides,
    )
    resp = await async_client.post(
        "/api/auth/login",
        data={"username": wave_number, "password": "secret-pass-1"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert resp.status_code == 200, resp.text
    payload = resp.json()
    token = payload.get("access_token") or payload["data"]["tokens"]["accessToken"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_avatar_upload_shows_on_profile_and_campaign(async_client, db_session):
    headers = await _login(async_client, db_session, "+2207004444")

    resp = await async_client.post(
        "/api/auth/me/avatar", headers=headers, files={"file": ("me.png", PNG, "image/png")},
    )
    assert resp.status_code == 200, resp.text
    me = resp.json()
    assert me["avatar_url"] and "/avatars/" in me["avatar_url"]

    campaign = Campaign(user_id=me["id"], title="With Photo", slug="with-photo", description="", mode=CampaignMode.ONGOING, status=CampaignStatus.ACTIVE)
    db_session.add(campaign)
    await db_session.commit()

    profile = (await async_client.get(f"/api/profiles/{me['id']}")).json()
    assert profile["avatar_url"] == me["avatar_url"]
    owner = (await async_client.get("/api/campaigns/with-photo")).json()["owner"]
    assert owner["avatar_url"] == me["avatar_url"]

    removed = await async_client.delete("/api/auth/me/avatar", headers=headers)
    assert removed.status_code == 200
    assert removed.json()["avatar_url"] is None


@pytest.mark.asyncio
async def test_avatar_rejects_mismatched_or_unsupported_files(async_client, db_session):
    headers = await _login(async_client, db_session, "+2207005555")

    spoofed = await async_client.post(
        "/api/auth/me/avatar", headers=headers, files={"file": ("x.png", b"<html>not an image</html>", "image/png")},
    )
    assert spoofed.status_code == 400

    gif = await async_client.post(
        "/api/auth/me/avatar", headers=headers, files={"file": ("x.gif", b"GIF89a....", "image/gif")},
    )
    assert gif.status_code == 400


@pytest.mark.asyncio
async def test_profile_location_and_track_record(async_client, db_session):
    from app.models.donation import Donation

    headers = await _login(async_client, db_session, "+2207006666")
    resp = await async_client.patch("/api/auth/me", headers=headers, json={"location": "  Brikama, WCR  "})
    assert resp.status_code == 200, resp.text
    user_id = resp.json()["id"]
    assert resp.json()["location"] == "Brikama, WCR"

    campaign = Campaign(user_id=user_id, title="Record", slug="record", description="", mode=CampaignMode.ONGOING, status=CampaignStatus.ACTIVE, amount_raised=1500)
    db_session.add(campaign)
    await db_session.commit()
    db_session.add_all([
        Donation(campaign_id=campaign.id, amount=1000, status="SUCCEEDED"),
        Donation(campaign_id=campaign.id, amount=500, status="SUCCEEDED"),
        Donation(campaign_id=campaign.id, amount=999, status="FAILED"),
    ])
    await db_session.commit()

    profile = (await async_client.get(f"/api/profiles/{user_id}")).json()
    assert profile["location"] == "Brikama, WCR"
    assert profile["total_raised"] == 1500
    assert profile["supporters_count"] == 2


async def _me(async_client, headers):
    return (await async_client.get("/api/auth/me", headers=headers)).json()


@pytest.mark.asyncio
async def test_verified_name_is_locked(async_client, db_session):
    locked = await _login(async_client, db_session, "+2207007001", kyc_status="REVIEWING")
    resp = await async_client.patch("/api/auth/me", headers=locked, json={"full_name": "Someone Else"})
    assert resp.status_code == 409
    # Re-sending the same name (e.g. a form that posts every field) is fine
    same = await async_client.patch("/api/auth/me", headers=locked, json={"full_name": "Awa Organizer", "bio": "hi"})
    assert same.status_code == 200, same.text

    free = await _login(async_client, db_session, "+2207007002", kyc_status="NOT_SUBMITTED")
    resp = await async_client.patch("/api/auth/me", headers=free, json={"full_name": "New Name"})
    assert resp.status_code == 200
    assert resp.json()["full_name"] == "New Name"


@pytest.mark.asyncio
async def test_social_links_are_validated_and_public(async_client, db_session):
    headers = await _login(async_client, db_session, "+2207007003")

    bad = await async_client.patch("/api/auth/me", headers=headers, json={"social_links": {"facebook": "https://evil.example/fb"}})
    assert bad.status_code == 422

    ok = await async_client.patch("/api/auth/me", headers=headers, json={
        "social_links": {"website": "kambeng.gm", "instagram": "https://www.instagram.com/awa", "x": " "},
    })
    assert ok.status_code == 200, ok.text
    links = ok.json()["social_links"]
    assert links == {"website": "https://kambeng.gm", "instagram": "https://www.instagram.com/awa"}

    profile = (await async_client.get(f"/api/profiles/{ok.json()['id']}")).json()
    assert profile["social_links"] == links

    cleared = await async_client.patch("/api/auth/me", headers=headers, json={"social_links": {}})
    assert cleared.json()["social_links"] is None


@pytest.mark.asyncio
async def test_cover_photo_upload(async_client, db_session):
    headers = await _login(async_client, db_session, "+2207007004")
    resp = await async_client.post("/api/auth/me/cover", headers=headers, files={"file": ("c.png", PNG, "image/png")})
    assert resp.status_code == 200, resp.text
    assert "/covers/" in resp.json()["cover_url"]
    profile = (await async_client.get(f"/api/profiles/{resp.json()['id']}")).json()
    assert profile["cover_url"] == resp.json()["cover_url"]
    assert (await async_client.delete("/api/auth/me/cover", headers=headers)).json()["cover_url"] is None


@pytest.mark.asyncio
async def test_follow_unfollow_and_new_campaign_email(async_client, db_session, monkeypatch):
    import app.api.routes.campaigns as campaigns_router

    organizer_headers = await _login(async_client, db_session, "+2207007005")
    organizer = await _me(async_client, organizer_headers)
    fan_headers = await _login(async_client, db_session, "+2207007006", full_name="Fatou Fan")

    assert (await async_client.post(f"/api/profiles/{organizer['id']}/follow", headers=organizer_headers)).status_code == 400
    for _ in range(2):  # idempotent
        assert (await async_client.post(f"/api/profiles/{organizer['id']}/follow", headers=fan_headers)).status_code == 204

    profile = (await async_client.get(f"/api/profiles/{organizer['id']}", headers=fan_headers)).json()
    assert profile["followers_count"] == 1
    assert profile["is_following"] is True
    assert (await async_client.get(f"/api/profiles/{organizer['id']}")).json()["is_following"] is False

    sent = []
    monkeypatch.setattr(campaigns_router, "send_email", lambda to, subject, html: sent.append((to, subject, html)))
    monkeypatch.setattr(campaigns_router, "generate_and_upload_qr", lambda *_a, **_k: "https://example.com/qr.png")
    created = await async_client.post("/api/campaigns/", headers=organizer_headers, json={
        "title": "School Roof Repair", "description": "Fixing the roof", "mode": "TARGET", "target_amount": 5000,
    })
    assert created.status_code == 201, created.text
    assert len(sent) == 1
    to, subject, html = sent[0]
    assert to == "+2207007006@example.com"
    assert "School Roof Repair" in html and "Awa Organizer" in subject

    assert (await async_client.delete(f"/api/profiles/{organizer['id']}/follow", headers=fan_headers)).status_code == 204
    assert (await async_client.get(f"/api/profiles/{organizer['id']}")).json()["followers_count"] == 0


@pytest.mark.asyncio
async def test_donor_identity_only_shown_when_given_under_own_name(async_client, db_session):
    from app.models.donation import Donation

    organizer = await _make_user(db_session, email="org2@example.com", wave_number="+2207007007")
    donor_headers = await _login(async_client, db_session, "+2207007008", full_name="Musa Donor")
    donor = await _me(async_client, donor_headers)
    await async_client.post("/api/auth/me/avatar", headers=donor_headers, files={"file": ("a.png", PNG, "image/png")})
    donor = await _me(async_client, donor_headers)

    campaign = Campaign(user_id=organizer.id, title="Clinic", slug="clinic", description="", mode=CampaignMode.ONGOING, status=CampaignStatus.ACTIVE)
    other = Campaign(user_id=organizer.id, title="Nicknamed", slug="nicknamed", description="", mode=CampaignMode.ONGOING, status=CampaignStatus.ACTIVE)
    db_session.add_all([campaign, other])
    await db_session.commit()
    db_session.add_all([
        Donation(campaign_id=campaign.id, user_id=donor["id"], amount=100, status="SUCCEEDED", donor_name=" musa  donor ", client_reference="D1"),
        Donation(campaign_id=campaign.id, user_id=donor["id"], amount=200, status="SUCCEEDED", donor_name="Anonymous", client_reference="D2"),
        Donation(campaign_id=other.id, user_id=donor["id"], amount=300, status="SUCCEEDED", donor_name="A well-wisher", client_reference="D3"),
        Donation(campaign_id=campaign.id, amount=400, status="SUCCEEDED", donor_name="Musa Donor", client_reference="D4"),
    ])
    await db_session.commit()

    rows = {d["amount"]: d for d in (await async_client.get("/api/campaigns/clinic/donations")).json()}
    assert rows[100]["donor"] == {"id": donor["id"], "handle": None, "avatar_url": donor["avatar_url"]}
    assert rows[200]["donor"] is None  # anonymous gift
    assert rows[400]["donor"] is None  # logged-out gift with the same name
    assert "client_reference" not in rows[100]

    # Supported campaigns: hidden until opted in, and never lists nickname gifts
    assert (await async_client.get(f"/api/profiles/{donor['id']}")).json()["supported_campaigns"] == []
    await async_client.patch("/api/auth/me", headers=donor_headers, json={"show_supported_campaigns": True})
    supported = (await async_client.get(f"/api/profiles/{donor['id']}")).json()["supported_campaigns"]
    assert [c["slug"] for c in supported] == ["clinic"]
    assert "amount" not in supported[0]


@pytest.mark.asyncio
async def test_custom_handle_rules_and_lookup(async_client, db_session):
    headers = await _login(async_client, db_session, "+2207008001")
    other = await _login(async_client, db_session, "+2207008002", full_name="Other Person")

    resp = await async_client.patch("/api/auth/me", headers=headers, json={"handle": " @Awa_Organizer "})
    assert resp.status_code == 200, resp.text
    me = resp.json()
    assert me["handle"] == "awa_organizer"

    for bad in ("kambeng", "admin", "1awa", "ab", "awa-org", "kambeng_official"):
        assert (await async_client.patch("/api/auth/me", headers=other, json={"handle": bad})).status_code == 422, bad
    assert (await async_client.patch("/api/auth/me", headers=other, json={"handle": "AWA_ORGANIZER"})).status_code == 409

    by_handle = await async_client.get("/api/profiles/handle/Awa_Organizer")
    assert by_handle.status_code == 200
    assert by_handle.json()["id"] == me["id"] and by_handle.json()["handle"] == "awa_organizer"
    assert (await async_client.get("/api/profiles/handle/nobody_here")).status_code == 404

    check = lambda h, hd=None: async_client.get("/api/profiles/handle-available", params={"handle": h}, headers=hd or {})
    assert (await check("awa_organizer")).json()["available"] is False
    assert (await check("awa_organizer", headers)).json()["available"] is True  # your own
    assert (await check("support")).json() == {"handle": "support", "available": False, "reason": "That handle is reserved"}
    assert (await check("fresh_name")).json()["available"] is True

    campaign = Campaign(user_id=me["id"], title="Handle Camp", slug="handle-camp", description="", mode=CampaignMode.ONGOING, status=CampaignStatus.ACTIVE)
    db_session.add(campaign)
    await db_session.commit()
    assert (await async_client.get("/api/campaigns/handle-camp")).json()["owner"]["handle"] == "awa_organizer"

    cleared = await async_client.patch("/api/auth/me", headers=headers, json={"handle": ""})
    assert cleared.json()["handle"] is None
    assert (await async_client.get("/api/profiles/handle/awa_organizer")).status_code == 404


@pytest.mark.asyncio
async def test_favorite_causes(async_client, db_session):
    headers = await _login(async_client, db_session, "+2207008003")
    ok = await async_client.patch("/api/auth/me", headers=headers, json={"favorite_causes": ["Health", "education", "health"]})
    assert ok.status_code == 200, ok.text
    assert ok.json()["favorite_causes"] == ["health", "education"]
    assert (await async_client.get(f"/api/profiles/{ok.json()['id']}")).json()["favorite_causes"] == ["health", "education"]

    too_many = ["health", "education", "water", "faith"]
    assert (await async_client.patch("/api/auth/me", headers=headers, json={"favorite_causes": too_many})).status_code == 422
    assert (await async_client.patch("/api/auth/me", headers=headers, json={"favorite_causes": ["crypto"]})).status_code == 422
    assert (await async_client.patch("/api/auth/me", headers=headers, json={"favorite_causes": []})).json()["favorite_causes"] is None


@pytest.mark.asyncio
async def test_following_list(async_client, db_session):
    fan = await _login(async_client, db_session, "+2207008004", full_name="Fan")
    await _login(async_client, db_session, "+2207008005", full_name="Organizer One")
    organizer = await _me(async_client, await _login(async_client, db_session, "+2207008006", full_name="Organizer Two"))

    assert (await async_client.get("/api/profiles/me/following")).status_code == 401
    await async_client.post(f"/api/profiles/{organizer['id']}/follow", headers=fan)
    following = (await async_client.get("/api/profiles/me/following", headers=fan)).json()
    assert [f["full_name"] for f in following] == ["Organizer Two"]
    assert following[0]["kyc_verified"] is True and following[0]["followed_at"]


@pytest.mark.asyncio
async def test_replaced_and_removed_images_are_deleted_from_storage(async_client, db_session):
    import os
    from pathlib import Path

    headers = await _login(async_client, db_session, "+2207008007")
    first = (await async_client.post("/api/auth/me/avatar", headers=headers, files={"file": ("a.png", PNG, "image/png")})).json()
    root = Path(os.environ.get("MEDIA_ROOT", "media_test")) / "avatars" / str(first["id"])
    first_file = root / first["avatar_url"].rsplit("/", 1)[-1]
    assert first_file.is_file()

    second = (await async_client.post("/api/auth/me/avatar", headers=headers, files={"file": ("b.png", PNG, "image/png")})).json()
    second_file = root / second["avatar_url"].rsplit("/", 1)[-1]
    assert second_file.is_file() and not first_file.exists()

    await async_client.delete("/api/auth/me/avatar", headers=headers)
    assert not second_file.exists()


def test_user_image_file_name_only_accepts_generated_names():
    from app.services.storage_strategy import user_image_file_name

    good = "0123456789abcdef0123456789abcdef.png"
    assert user_image_file_name(f"https://cdn.example/avatars/7/{good}?x=1") == good
    for bad in ("https://cdn.example/avatars/7/../../kyc/7/id.pdf", "https://x/evil.png", "", None, "https://x/0123456789abcdef0123456789abcdef.pdf"):
        assert user_image_file_name(bad) is None
