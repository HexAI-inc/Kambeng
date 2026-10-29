"""The admin money audit catches totals that their records don't explain,
holds withdrawals on them, and corrects them with an audit trail."""

import pytest
from sqlalchemy.future import select

from app.api.routes.auth import get_current_user
from app.core.security import get_password_hash
from app.models.audit_log import AdminAuditLog, AuditActionType
from app.models.campaign import Campaign, CampaignMode
from app.models.donation import Donation
from app.models.payout import Payout
from app.models.promotion import PromoApplication, Promotion, PromoType
from app.models.user import User


async def _admin_headers(async_client, db_session, wave="+2207095001"):
    db_session.add(User(
        full_name="Audit Admin", email="audit-admin@example.com", wave_number=wave,
        password_hash=get_password_hash("AdminPass123!"), role="ADMIN", is_email_verified=True,
    ))
    await db_session.commit()
    login = await async_client.post("/api/auth/login", json={"username": wave, "password": "AdminPass123!"})
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {login.json()['data']['tokens']['accessToken']}"}


async def _campaign(db_session, *, slug, amount_raised, donations=()):
    owner = User(
        full_name="Owner", email=f"{slug}@example.com", wave_number=f"+22071{abs(hash(slug)) % 100000:05d}",
        password_hash="x", kyc_status="APPROVED",
    )
    db_session.add(owner)
    await db_session.commit()
    campaign = Campaign(user_id=owner.id, title=slug, slug=slug, description="", mode=CampaignMode.ONGOING, amount_raised=amount_raised)
    db_session.add(campaign)
    await db_session.commit()
    for i, amount in enumerate(donations):
        db_session.add(Donation(
            campaign_id=campaign.id, client_reference=f"DON-{slug}-{i}", amount=amount, status="SUCCEEDED", provider="wave",
        ))
    await db_session.commit()
    return owner, campaign


def _as_user(user):
    from app.main import app as fastapi_app

    async def _get():
        return user

    fastapi_app.dependency_overrides[get_current_user] = _get
    return fastapi_app


@pytest.mark.asyncio
async def test_double_credit_is_flagged_blocked_and_corrected(async_client, db_session):
    headers = await _admin_headers(async_client, db_session)
    # A 50 donation nets 49 on Wave; stored 98 means it was credited twice.
    owner, campaign = await _campaign(db_session, slug="doubled", amount_raised=98.0, donations=[50.0])
    await _campaign(db_session, slug="healthy", amount_raised=49.0, donations=[50.0])

    report = (await async_client.get("/api/admin/reconciliation/campaigns", headers=headers)).json()
    assert [row["slug"] for row in report["campaigns"]] == ["doubled"]
    row = report["campaigns"][0]
    assert row["expected"] == 49.0 and row["difference"] == 49.0 and row["issues"] == ["over_credited"]

    fastapi_app = _as_user(owner)
    try:
        blocked = await async_client.post("/api/payments/withdraw", json={"campaign_id": campaign.id, "amount": 20.0})
        assert blocked.status_code == 409
        assert "reviewed" in blocked.json()["detail"]
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)

    # A stale view of the total is refused rather than overwriting a newer one.
    stale = await async_client.post(
        f"/api/admin/reconciliation/campaigns/{campaign.id}/correct", headers=headers,
        json={"expected_current": 120.0, "reason": "double credit from poll race"},
    )
    assert stale.status_code == 409

    fixed = await async_client.post(
        f"/api/admin/reconciliation/campaigns/{campaign.id}/correct", headers=headers,
        json={"expected_current": 98.0, "reason": "double credit from poll race"},
    )
    assert fixed.status_code == 200, fixed.text
    assert fixed.json()["corrected"] == 49.0

    await db_session.refresh(campaign)
    assert campaign.amount_raised == 49.0
    log = (await db_session.execute(
        select(AdminAuditLog).where(AdminAuditLog.action_type == AuditActionType.CAMPAIGN_TOTAL_CORRECTED.value)
    )).scalars().one()
    assert (log.old_value, log.new_value, log.campaign_id) == ("98.00", "49.00", campaign.id)

    report = (await async_client.get("/api/admin/reconciliation/campaigns", headers=headers)).json()
    assert report["campaigns"] == []


@pytest.mark.asyncio
async def test_promo_credits_and_rebates_count_as_backed(async_client, db_session):
    headers = await _admin_headers(async_client, db_session)
    # 49 net + 50 match + 10 transparency rebate.
    _, campaign = await _campaign(db_session, slug="promoted", amount_raised=109.0, donations=[50.0])
    donation = (await db_session.execute(select(Donation).where(Donation.campaign_id == campaign.id))).scalars().one()
    match = Promotion(slug="match", name="Match", promo_type=PromoType.MATCHED_DONATION.value)
    rebate = Promotion(slug="rebate", name="Rebate", promo_type=PromoType.TRANSPARENCY_REBATE.value)
    waiver = Promotion(slug="waiver", name="Waiver", promo_type=PromoType.CAMPAIGN_FEE_WAIVER.value)
    db_session.add_all([match, rebate, waiver])
    await db_session.commit()
    db_session.add_all([
        PromoApplication(promotion_id=match.id, campaign_id=campaign.id, donation_id=donation.id, fee_waived_amount=0.0, match_contributed_amount=50.0),
        PromoApplication(promotion_id=rebate.id, campaign_id=campaign.id, fee_waived_amount=10.0),
        # A withdrawal fee waiver lowers the commission; it never credits the campaign.
        PromoApplication(promotion_id=waiver.id, campaign_id=campaign.id, fee_waived_amount=10.0),
    ])
    await db_session.commit()

    report = (await async_client.get("/api/admin/reconciliation/campaigns?include_matched=true", headers=headers)).json()
    row = next(r for r in report["campaigns"] if r["slug"] == "promoted")
    assert (row["donations_net"], row["promo_credit"], row["expected"], row["issues"]) == (49.0, 60.0, 109.0, [])


@pytest.mark.asyncio
async def test_overdrawn_campaign_owes_from_future_donations(async_client, db_session):
    headers = await _admin_headers(async_client, db_session)
    # Raised 123 for real but withdrew 147 gross (134 sent + 13 fees).
    owner, campaign = await _campaign(db_session, slug="overdrawn", amount_raised=123.0, donations=[100.0, 25.0])
    db_session.add(Payout(
        campaign_id=campaign.id, client_reference="PAYOUT-OVER", gross_amount=147.0, hexai_fee=3.0,
        platform_commission=10.0, net_amount=134.0, amount=134.0, status="SUCCEEDED",
    ))
    await db_session.commit()

    report = (await async_client.get("/api/admin/reconciliation/campaigns", headers=headers)).json()
    row = report["campaigns"][0]
    assert (row["withdrawn"], row["true_balance"], row["issues"]) == (147.0, -24.0, ["overdrawn"])

    fastapi_app = _as_user(owner)
    try:
        summary = await async_client.get(f"/api/payments/withdraw/summary/{campaign.id}")
        assert summary.json()["available_balance"] == pytest.approx(-24.0)
        refused = await async_client.post("/api/payments/withdraw", json={"campaign_id": campaign.id, "amount": 20.0})
        assert refused.status_code == 400
        assert "Insufficient funds" in refused.json()["detail"]
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_audit_endpoints_are_admin_only(async_client, db_session):
    owner, campaign = await _campaign(db_session, slug="private", amount_raised=0.0)
    assert (await async_client.get("/api/admin/reconciliation/campaigns")).status_code == 401
    fastapi_app = _as_user(owner)
    try:
        assert (await async_client.get("/api/admin/reconciliation/campaigns")).status_code == 403
        correct = await async_client.post(
            f"/api/admin/reconciliation/campaigns/{campaign.id}/correct",
            json={"expected_current": 0.0, "reason": "not an admin"},
        )
        assert correct.status_code == 403
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_daily_audit_emails_admins_only_when_something_is_off(db_session, integration_session_factory, monkeypatch):
    from app.services import campaign_audit

    sent = []
    monkeypatch.setattr("app.db.database.AsyncSessionLocal", integration_session_factory)
    monkeypatch.setattr("app.services.email_service.send_email", lambda to, subject, html: sent.append((to, subject)) or True)
    db_session.add(User(
        full_name="Audit Admin", email="audit-admin@example.com", wave_number="+2207095009",
        password_hash="x", role="ADMIN",
    ))
    await db_session.commit()

    _, campaign = await _campaign(db_session, slug="clean", amount_raised=49.0, donations=[50.0])
    await campaign_audit.run_daily_campaign_audit()
    assert sent == []

    campaign.amount_raised = 98.0
    await db_session.commit()
    await campaign_audit.run_daily_campaign_audit()
    assert sent == [("audit-admin@example.com", "Kambeng money audit: 1 campaign(s) need review")]
