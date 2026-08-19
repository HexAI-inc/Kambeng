from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.future import select

from app.core.security import get_password_hash
from app.models.campaign import Campaign, CampaignMode, CampaignStatus
from app.models.donation import Donation
from app.models.ledger import TransactionLedger, TransactionType
from app.models.payout import Payout
from app.models.promotion import PromoApplication, Promotion
from app.models.referral import Referral
from app.models.user import User
from app.api.routes.auth import get_current_user
import app.api.routes.payments as payments_router


def _future(days=30):
    return (datetime.now(UTC) + timedelta(days=days)).isoformat()


async def _admin_headers(async_client, db_session, *, wave="+2207099001"):
    admin = User(
        full_name="Promo Admin", email=f"promo-admin-{wave}@example.com", wave_number=wave,
        password_hash=get_password_hash("AdminPass123!"), role="ADMIN", is_email_verified=True,
    )
    db_session.add(admin)
    await db_session.commit()
    login = await async_client.post("/api/auth/login", json={"username": wave, "password": "AdminPass123!"})
    assert login.status_code == 200, login.text
    token = login.json()["data"]["tokens"]["accessToken"]
    return {"Authorization": f"Bearer {token}"}


async def _seed_owner_and_campaign(db_session, *, slug, amount_raised=200.0, organiser_type="individual"):
    owner = User(
        full_name="Campaign Owner", email=f"owner-{slug}@example.com", wave_number=f"+22070{abs(hash(slug)) % 100000:05d}",
        password_hash="x", kyc_status="APPROVED",
    )
    db_session.add(owner)
    await db_session.commit()
    await db_session.refresh(owner)

    campaign = Campaign(
        user_id=owner.id, title=f"Camp {slug}", slug=slug, description="d", mode=CampaignMode.ONGOING,
        amount_raised=amount_raised, organiser_type=organiser_type,
    )
    db_session.add(campaign)
    await db_session.commit()
    await db_session.refresh(campaign)
    return owner, campaign


def _override_current_user(fastapi_app, user):
    async def _get():
        return user
    fastapi_app.dependency_overrides[get_current_user] = _get


# ---------------------------------------------------------------------------
# Promotion creation validation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_promotion_requires_end_date_unless_self_limiting(async_client, db_session):
    headers = await _admin_headers(async_client, db_session)

    # campaign_fee_waiver requires ends_at
    resp = await async_client.post(
        "/api/admin/promotions", headers=headers,
        json={"slug": "founding-2026", "name": "Founding Campaigns", "promo_type": "campaign_fee_waiver", "fee_waiver_pct": 100},
    )
    assert resp.status_code == 422, resp.text

    resp = await async_client.post(
        "/api/admin/promotions", headers=headers,
        json={"slug": "founding-2026", "name": "Founding Campaigns", "promo_type": "campaign_fee_waiver", "fee_waiver_pct": 100, "ends_at": _future()},
    )
    assert resp.status_code == 201, resp.text

    # organiser_referral is self-limiting — no ends_at needed
    resp = await async_client.post(
        "/api/admin/promotions", headers=headers,
        json={"slug": "referral-reward", "name": "Referral Reward", "promo_type": "organiser_referral", "fee_waiver_pct": 100},
    )
    assert resp.status_code == 201, resp.text


@pytest.mark.asyncio
async def test_matched_donation_requires_pool_and_ratio(async_client, db_session):
    headers = await _admin_headers(async_client, db_session)
    resp = await async_client.post(
        "/api/admin/promotions", headers=headers,
        json={"slug": "match-2026", "name": "Ramadan Match", "promo_type": "matched_donation", "ends_at": _future()},
    )
    assert resp.status_code == 422, resp.text


# ---------------------------------------------------------------------------
# Withdrawal-time fee waiver + cap enforcement
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_campaign_fee_waiver_applies_at_withdrawal(async_client, db_session, monkeypatch):
    from app.main import app as fastapi_app

    headers = await _admin_headers(async_client, db_session, wave="+2207099002")
    owner, campaign = await _seed_owner_and_campaign(db_session, slug="fee-waiver-camp")

    create_resp = await async_client.post(
        "/api/admin/promotions", headers=headers,
        json={"slug": "founding-camps", "name": "Founding Campaigns", "promo_type": "campaign_fee_waiver", "fee_waiver_pct": 100, "ends_at": _future(), "max_campaigns": 5},
    )
    promo_id = create_resp.json()["id"]

    assign_resp = await async_client.post(
        f"/api/admin/campaigns/{campaign.id}/assign-promo", headers=headers, json={"promotion_id": promo_id},
    )
    assert assign_resp.status_code == 200, assign_resp.text
    assert assign_resp.json()["campaigns_used"] == 1

    async def fake_initiate_payout(requested_amount, recipient_mobile, payout_reference, recipient_name):
        return ({"data": {"tx_id": "FAKE-TX"}}, requested_amount)
    monkeypatch.setattr(payments_router.hexai_service, "initiate_payout", fake_initiate_payout)

    _override_current_user(fastapi_app, owner)
    try:
        resp = await async_client.post("/api/payments/withdraw", json={"campaign_id": campaign.id, "amount": 50.0})
        assert resp.status_code == 200, resp.text
        payload = resp.json()
        assert payload["platform_commission"] == 0.0
        assert payload["promo_fee_waived"] > 0
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)

    application = (await db_session.execute(select(PromoApplication).where(PromoApplication.promotion_id == promo_id))).scalars().first()
    assert application is not None
    assert application.fee_waived_amount == payload["promo_fee_waived"]

    payout = (await db_session.execute(select(Payout).where(Payout.campaign_id == campaign.id))).scalars().first()
    assert payout.promo_application_id == application.id


@pytest.mark.asyncio
async def test_promo_cap_rejects_assignment_once_full(async_client, db_session):
    headers = await _admin_headers(async_client, db_session, wave="+2207099003")
    _, campaign_a = await _seed_owner_and_campaign(db_session, slug="cap-camp-a")
    _, campaign_b = await _seed_owner_and_campaign(db_session, slug="cap-camp-b")

    create_resp = await async_client.post(
        "/api/admin/promotions", headers=headers,
        json={"slug": "small-cap", "name": "Small Cap", "promo_type": "campaign_fee_waiver", "fee_waiver_pct": 50, "ends_at": _future(), "max_campaigns": 1},
    )
    promo_id = create_resp.json()["id"]

    ok = await async_client.post(f"/api/admin/campaigns/{campaign_a.id}/assign-promo", headers=headers, json={"promotion_id": promo_id})
    assert ok.status_code == 200

    blocked = await async_client.post(f"/api/admin/campaigns/{campaign_b.id}/assign-promo", headers=headers, json={"promotion_id": promo_id})
    assert blocked.status_code == 409


@pytest.mark.asyncio
async def test_inactive_promo_cannot_be_assigned(async_client, db_session):
    headers = await _admin_headers(async_client, db_session, wave="+2207099004")
    _, campaign = await _seed_owner_and_campaign(db_session, slug="inactive-promo-camp")

    create_resp = await async_client.post(
        "/api/admin/promotions", headers=headers,
        json={"slug": "off-promo", "name": "Off Promo", "promo_type": "campaign_fee_waiver", "fee_waiver_pct": 50, "ends_at": _future(), "is_active": False},
    )
    promo_id = create_resp.json()["id"]

    resp = await async_client.post(f"/api/admin/campaigns/{campaign.id}/assign-promo", headers=headers, json={"promotion_id": promo_id})
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Donation-time: fee absorption + matched donation (with pool depletion)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_donor_fee_free_day_credits_full_gross_amount(async_client, db_session):
    headers = await _admin_headers(async_client, db_session, wave="+2207099005")
    _, campaign = await _seed_owner_and_campaign(db_session, slug="fee-free-camp", amount_raised=0.0)

    await async_client.post(
        "/api/admin/promotions", headers=headers,
        json={"slug": "fee-free-monday", "name": "Fee-Free Monday", "promo_type": "donor_fee_free_day", "ends_at": _future()},
    )

    donation = Donation(client_reference="DON-FEEFREE-1", amount=100.0, status="PENDING", campaign_id=campaign.id)
    db_session.add(donation)
    await db_session.commit()

    resp = await async_client.post(f"/api/payments/admin/donations/{donation.client_reference}/approve", headers=headers, json={})
    assert resp.status_code == 200, resp.text

    await db_session.refresh(campaign)
    # Without the promo, 2% collection fee would apply: 100 * 0.98 = 98.
    # With fee-free-day, Kambeng absorbs the fee — campaign gets the full 100.
    assert campaign.amount_raised == 100.0

    application = (await db_session.execute(select(PromoApplication).where(PromoApplication.donation_id == donation.id))).scalars().first()
    assert application is not None
    assert application.fee_waived_amount == 2.0


@pytest.mark.asyncio
async def test_matched_donation_pool_depletes_and_auto_deactivates(async_client, db_session):
    headers = await _admin_headers(async_client, db_session, wave="+2207099006")
    _, campaign = await _seed_owner_and_campaign(db_session, slug="matched-camp", amount_raised=0.0)

    create_resp = await async_client.post(
        "/api/admin/promotions", headers=headers,
        json={
            "slug": "ramadan-match", "name": "Ramadan Match", "promo_type": "matched_donation",
            "ends_at": _future(), "match_pool_total": 30.0, "match_ratio": 1.0,
        },
    )
    promo_id = create_resp.json()["id"]

    donation = Donation(client_reference="DON-MATCH-1", amount=50.0, status="PENDING", campaign_id=campaign.id)
    db_session.add(donation)
    await db_session.commit()

    resp = await async_client.post(f"/api/payments/admin/donations/{donation.client_reference}/approve", headers=headers, json={})
    assert resp.status_code == 200, resp.text

    await db_session.refresh(campaign)
    # donation net = 50 * 0.98 = 49; match capped at pool remaining (30, since ratio=1.0 requests 50 but pool only has 30)
    assert campaign.amount_raised == pytest.approx(49.0 + 30.0)

    promo = (await db_session.execute(select(Promotion).where(Promotion.id == promo_id))).scalars().first()
    assert promo.match_pool_remaining == 0.0
    assert promo.is_active is False  # pool auto-disabled once spent

    match_ledger = (await db_session.execute(
        select(TransactionLedger).where(TransactionLedger.external_reference == f"{donation.client_reference}-MATCH")
    )).scalars().first()
    assert match_ledger is not None
    assert match_ledger.gross_amount == 30.0


@pytest.mark.asyncio
async def test_matched_donation_pool_exhausted_applies_no_match(async_client, db_session):
    headers = await _admin_headers(async_client, db_session, wave="+2207099007")
    _, campaign = await _seed_owner_and_campaign(db_session, slug="matched-exhausted-camp", amount_raised=0.0)

    create_resp = await async_client.post(
        "/api/admin/promotions", headers=headers,
        json={
            "slug": "small-match", "name": "Small Match", "promo_type": "matched_donation",
            "ends_at": _future(), "match_pool_total": 10.0, "match_ratio": 1.0,
        },
    )
    promo_id = create_resp.json()["id"]

    # First donation exhausts the pool
    d1 = Donation(client_reference="DON-EXHAUST-1", amount=10.0, status="PENDING", campaign_id=campaign.id)
    db_session.add(d1)
    await db_session.commit()
    r1 = await async_client.post(f"/api/payments/admin/donations/{d1.client_reference}/approve", headers=headers, json={})
    assert r1.status_code == 200

    promo = (await db_session.execute(select(Promotion).where(Promotion.id == promo_id))).scalars().first()
    assert promo.match_pool_remaining == 0.0

    # Second donation gets no match — pool is empty
    d2 = Donation(client_reference="DON-EXHAUST-2", amount=10.0, status="PENDING", campaign_id=campaign.id)
    db_session.add(d2)
    await db_session.commit()
    r2 = await async_client.post(f"/api/payments/admin/donations/{d2.client_reference}/approve", headers=headers, json={})
    assert r2.status_code == 200

    second_application = (await db_session.execute(select(PromoApplication).where(PromoApplication.donation_id == d2.id))).scalars().first()
    assert second_application is None


# ---------------------------------------------------------------------------
# Referral program
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_referral_signup_and_reward_consumed_at_withdrawal(async_client, db_session, monkeypatch):
    from app.main import app as fastapi_app

    headers = await _admin_headers(async_client, db_session, wave="+2207099008")

    # Referrer registers first to get a referral code
    referrer_reg = await async_client.post(
        "/api/auth/register",
        json={"full_name": "Referrer", "email": "referrer@example.com", "wave_number": "+2207050001", "password": "StrongPass123!"},
    )
    assert referrer_reg.status_code == 201, referrer_reg.text
    referrer_id = referrer_reg.json()["id"]
    referrer = (await db_session.execute(select(User).where(User.id == referrer_id))).scalars().first()
    assert referrer.referral_code

    # A second user registers using the referrer's code
    referred_reg = await async_client.post(
        f"/api/auth/register?ref={referrer.referral_code}",
        json={"full_name": "Referred Organiser", "email": "referred@example.com", "wave_number": "+2207050002", "password": "StrongPass123!"},
    )
    assert referred_reg.status_code == 201, referred_reg.text
    referred_id = referred_reg.json()["id"]

    referral = (await db_session.execute(select(Referral).where(Referral.referred_user_id == referred_id))).scalars().first()
    assert referral is not None
    assert referral.referrer_user_id == referrer.id
    assert referral.reward_applied is False

    # Referrer needs KYC approval + an existing campaign to withdraw against
    referrer.kyc_status = "APPROVED"
    await db_session.commit()
    campaign = Campaign(user_id=referrer.id, title="Referrer Campaign", slug="referrer-campaign", description="d", mode=CampaignMode.ONGOING, amount_raised=100.0)
    db_session.add(campaign)
    await db_session.commit()
    await db_session.refresh(campaign)

    # Admin must switch the referral program on (self-limiting promo, no ends_at)
    promo_resp = await async_client.post(
        "/api/admin/promotions", headers=headers,
        json={"slug": "organiser-referral-reward", "name": "Organiser Referral Reward", "promo_type": "organiser_referral", "fee_waiver_pct": 100},
    )
    assert promo_resp.status_code == 201, promo_resp.text

    async def fake_initiate_payout(requested_amount, recipient_mobile, payout_reference, recipient_name):
        return ({"data": {"tx_id": "FAKE-TX"}}, requested_amount)
    monkeypatch.setattr(payments_router.hexai_service, "initiate_payout", fake_initiate_payout)

    _override_current_user(fastapi_app, referrer)
    try:
        resp = await async_client.post("/api/payments/withdraw", json={"campaign_id": campaign.id, "amount": 50.0})
        assert resp.status_code == 200, resp.text
        assert resp.json()["platform_commission"] == 0.0
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)

    await db_session.refresh(referral)
    assert referral.reward_applied is True


@pytest.mark.asyncio
async def test_referral_code_endpoint_returns_share_link(async_client, db_session):
    from app.main import app as fastapi_app

    user = User(full_name="Solo Organiser", email="solo@example.com", wave_number="+2207050099", password_hash="x")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    _override_current_user(fastapi_app, user)
    try:
        resp = await async_client.get("/api/users/me/referral-code")
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["referral_code"]
        assert body["referral_code"] in body["share_link"]
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)


# ---------------------------------------------------------------------------
# Rebates
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_milestone_completion_rebate_credits_ledger_on_full_funding(async_client, db_session):
    headers = await _admin_headers(async_client, db_session, wave="+2207099009")
    owner, campaign = await _seed_owner_and_campaign(db_session, slug="rebate-camp", amount_raised=90.0)
    campaign.mode = CampaignMode.TARGET
    campaign.target_amount = 100.0
    await db_session.commit()

    # A prior successful payout established D10 of platform commission already paid.
    payout = Payout(campaign_id=campaign.id, client_reference="OUT-REBATE-1", gross_amount=50.0, hexai_fee=0.5, platform_commission=10.0, net_amount=39.5, status="SUCCEEDED")
    db_session.add(payout)
    await db_session.commit()

    await async_client.post(
        "/api/admin/promotions", headers=headers,
        json={"slug": "completion-rebate", "name": "Completion Rebate", "promo_type": "milestone_completion_rebate", "rebate_pct": 50, "ends_at": _future()},
    )

    donation = Donation(client_reference="DON-REBATE-1", amount=11.0, status="PENDING", campaign_id=campaign.id)
    db_session.add(donation)
    await db_session.commit()

    resp = await async_client.post(f"/api/payments/admin/donations/{donation.client_reference}/approve", headers=headers, json={})
    assert resp.status_code == 200, resp.text

    await db_session.refresh(campaign)
    assert campaign.status == CampaignStatus.CLOSED

    rebate_ledger = (await db_session.execute(
        select(TransactionLedger).where(TransactionLedger.campaign_id == campaign.id, TransactionLedger.transaction_type == TransactionType.REFUND)
    )).scalars().first()
    assert rebate_ledger is not None
    assert rebate_ledger.gross_amount == 5.0  # 50% of the 10.0 commission already paid


# ---------------------------------------------------------------------------
# Public active-promo endpoint
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_active_promo_endpoint_reflects_assigned_promo(async_client, db_session):
    headers = await _admin_headers(async_client, db_session, wave="+2207099010")
    _, campaign = await _seed_owner_and_campaign(db_session, slug="active-promo-camp")

    no_promo = await async_client.get(f"/api/campaigns/{campaign.slug}/active-promo")
    assert no_promo.status_code == 200
    assert no_promo.json()["active"] is False

    create_resp = await async_client.post(
        "/api/admin/promotions", headers=headers,
        json={"slug": "visible-waiver", "name": "Visible Waiver", "promo_type": "campaign_fee_waiver", "fee_waiver_pct": 75, "ends_at": _future()},
    )
    promo_id = create_resp.json()["id"]
    await async_client.post(f"/api/admin/campaigns/{campaign.id}/assign-promo", headers=headers, json={"promotion_id": promo_id})

    active = await async_client.get(f"/api/campaigns/{campaign.slug}/active-promo")
    assert active.status_code == 200
    body = active.json()
    assert body["active"] is True
    assert body["fee_waiver_pct"] == 75
