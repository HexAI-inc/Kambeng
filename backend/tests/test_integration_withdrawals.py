import pytest
from sqlalchemy.future import select

from app.models.user import User
from app.models.campaign import Campaign, CampaignMode
from app.models.payout import Payout
from app.api.routes.auth import get_current_user
import app.api.routes.payments as payments_router


async def _seed_owner_and_campaign(db_session, *, amount_raised=200.0):
    user = User(
        full_name="Withdraw User",
        email="w@example.com",
        wave_number="+2207000999",
        password_hash="x",
        kyc_status="APPROVED",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    campaign = Campaign(user_id=user.id, title="Withdraw Test", slug="withdraw-test", description="", mode=CampaignMode.ONGOING, amount_raised=amount_raised)
    db_session.add(campaign)
    await db_session.commit()
    await db_session.refresh(campaign)
    return user, campaign


@pytest.mark.asyncio
async def test_request_withdrawal_and_list(async_client, db_session, monkeypatch):
    user, campaign = await _seed_owner_and_campaign(db_session)

    from app.main import app as fastapi_app

    async def _get_user_override():
        return user

    fastapi_app.dependency_overrides[get_current_user] = _get_user_override

    async def fake_initiate_payout(requested_amount, recipient_mobile, payout_reference, recipient_name):
        return ({"data": {"tx_id": "FAKE-TX"}}, requested_amount)

    monkeypatch.setattr(payments_router.hexai_service, "initiate_payout", fake_initiate_payout)

    try:
        resp = await async_client.post("/api/payments/withdraw", json={"campaign_id": campaign.id, "amount": 50.0})
        assert resp.status_code == 200, resp.text
        payload = resp.json()
        assert payload["gross_amount"] == 50.0
        assert payload["status"] == "PENDING"

        resp2 = await async_client.get("/api/campaigns/withdraw-test/withdrawals")
        assert resp2.status_code == 200
        items = resp2.json()
        assert isinstance(items, list)
        assert len(items) >= 1

        # The old unguarded endpoint must stay dead — it skipped the KYC gate,
        # balance check, and ledger entry.
        legacy = await async_client.post("/api/campaigns/withdraw-test/withdraw", json={"amount": 50.0})
        assert legacy.status_code in (404, 405), legacy.text
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_withdrawal_requires_kyc(async_client, db_session):
    user, campaign = await _seed_owner_and_campaign(db_session)
    user.kyc_status = "NOT_SUBMITTED"
    await db_session.commit()

    from app.main import app as fastapi_app

    async def _get_user_override():
        return user

    fastapi_app.dependency_overrides[get_current_user] = _get_user_override
    try:
        resp = await async_client.post("/api/payments/withdraw", json={"campaign_id": campaign.id, "amount": 50.0})
        assert resp.status_code == 403
        assert "KYC" in resp.json()["detail"]
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_pending_payout_reserves_balance(async_client, db_session, monkeypatch):
    """A withdrawal already in flight must reduce the available balance so the
    same money can't be withdrawn twice."""
    user, campaign = await _seed_owner_and_campaign(db_session, amount_raised=200.0)

    in_flight = Payout(
        campaign_id=campaign.id,
        client_reference="PAYOUT-INFLIGHT-1",
        gross_amount=120.0,
        hexai_fee=2.4,
        platform_commission=10.0,
        net_amount=107.6,
        amount=107.6,
        status="PENDING",
    )
    db_session.add(in_flight)
    await db_session.commit()

    from app.main import app as fastapi_app

    async def _get_user_override():
        return user

    fastapi_app.dependency_overrides[get_current_user] = _get_user_override

    async def fake_initiate_payout(requested_amount, recipient_mobile, payout_reference, recipient_name):
        return ({"data": {"tx_id": "FAKE-TX"}}, requested_amount)

    monkeypatch.setattr(payments_router.hexai_service, "initiate_payout", fake_initiate_payout)

    try:
        # available = 200 - 107.6 (pending reserved) = 92.4 → 120 must be refused
        too_much = await async_client.post("/api/payments/withdraw", json={"campaign_id": campaign.id, "amount": 120.0})
        assert too_much.status_code == 400
        assert "Insufficient funds" in too_much.json()["detail"]

        # summary reflects the reservation
        summary = await async_client.get(f"/api/payments/withdraw/summary/{campaign.id}")
        assert summary.status_code == 200
        assert summary.json()["available_balance"] == pytest.approx(92.4)

        # a withdrawal within the reserved-adjusted balance still works
        ok = await async_client.post("/api/payments/withdraw", json={"campaign_id": campaign.id, "amount": 90.0})
        assert ok.status_code == 200, ok.text

        # a failed payout releases its hold
        payout_row = (await db_session.execute(select(Payout).where(Payout.client_reference == "PAYOUT-INFLIGHT-1"))).scalars().first()
        payout_row.status = "FAILED"
        await db_session.commit()

        summary2 = await async_client.get(f"/api/payments/withdraw/summary/{campaign.id}")
        assert summary2.json()["available_balance"] > summary.json()["available_balance"]
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)