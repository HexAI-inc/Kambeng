from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.future import select

from app.core.security import get_password_hash
from app.models.campaign import Campaign, CampaignMode
from app.models.donation import Donation
from app.models.payout import Payout
from app.models.user import User
from app.api.routes.auth import get_current_user
from app.services.hexai_service import HexAIGatewayError
import app.api.routes.admin as admin_router
import app.api.routes.gateway_audit as gateway_audit_router
import app.api.routes.payments as payments_router


async def _admin_headers(async_client, db_session, *, wave="+2207088001"):
    admin = User(
        full_name="Gateway Admin", email=f"gw-admin-{wave}@example.com", wave_number=wave,
        password_hash=get_password_hash("AdminPass123!"), role="ADMIN", is_email_verified=True,
    )
    db_session.add(admin)
    await db_session.commit()
    login = await async_client.post("/api/auth/login", json={"username": wave, "password": "AdminPass123!"})
    assert login.status_code == 200, login.text
    token = login.json()["data"]["tokens"]["accessToken"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_gateway_audit_routes_require_admin(async_client):
    for method, path in [
        ("get", "/api/admin/gateway/balance"),
        ("get", "/api/admin/gateway/stats"),
        ("get", "/api/admin/gateway/transactions"),
        ("get", "/api/admin/gateway/reconciliation"),
        ("post", "/api/admin/gateway/webhooks/test"),
    ]:
        resp = await getattr(async_client, method)(path)
        assert resp.status_code in (401, 403), f"{method} {path} -> {resp.status_code}"


@pytest.mark.asyncio
async def test_gateway_balance_and_stats_proxy_through(async_client, db_session, monkeypatch):
    headers = await _admin_headers(async_client, db_session, wave="+2207088002")

    async def fake_get_balance():
        return {"status": "success", "data": {"available_balance": "1000.00"}}

    async def fake_get_stats():
        return {"total_volume": "5000.00", "by_provider": []}

    monkeypatch.setattr(gateway_audit_router.hexai_service, "get_balance", fake_get_balance)
    monkeypatch.setattr(gateway_audit_router.hexai_service, "get_stats", fake_get_stats)

    balance_resp = await async_client.get("/api/admin/gateway/balance", headers=headers)
    assert balance_resp.status_code == 200
    assert balance_resp.json()["data"]["available_balance"] == "1000.00"

    stats_resp = await async_client.get("/api/admin/gateway/stats", headers=headers)
    assert stats_resp.status_code == 200
    assert stats_resp.json()["total_volume"] == "5000.00"


@pytest.mark.asyncio
async def test_gateway_error_surfaces_with_original_status(async_client, db_session, monkeypatch):
    headers = await _admin_headers(async_client, db_session, wave="+2207088003")

    async def fake_get_balance():
        raise HexAIGatewayError(status_code=401, code="unauthorized", message="Invalid API key")

    monkeypatch.setattr(gateway_audit_router.hexai_service, "get_balance", fake_get_balance)

    resp = await async_client.get("/api/admin/gateway/balance", headers=headers)
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Invalid API key"


@pytest.mark.asyncio
async def test_gateway_reconciliation_flags_stale_pending_donation(async_client, db_session, monkeypatch):
    headers = await _admin_headers(async_client, db_session, wave="+2207088004")

    owner = User(full_name="Recon Owner", email="recon-owner@example.com", wave_number="+2207088005", password_hash="x")
    db_session.add(owner)
    await db_session.commit()
    await db_session.refresh(owner)

    campaign = Campaign(user_id=owner.id, title="Recon Camp", slug="recon-camp", description="d", mode=CampaignMode.ONGOING)
    db_session.add(campaign)
    await db_session.commit()
    await db_session.refresh(campaign)

    stale_time = datetime.now(UTC) - timedelta(hours=1)
    stuck = Donation(
        campaign_id=campaign.id, client_reference="DON-STUCK-1", amount=50.0, status="PENDING", created_at=stale_time,
    )
    fresh = Donation(
        campaign_id=campaign.id, client_reference="DON-FRESH-1", amount=50.0, status="PENDING",
    )
    db_session.add_all([stuck, fresh])
    await db_session.commit()

    async def fake_get_collection_status(client_reference):
        if client_reference == "DON-STUCK-1":
            return {"data": {"status": "SUCCEEDED"}}
        return {"data": {"status": "PENDING"}}

    monkeypatch.setattr(gateway_audit_router.hexai_service, "get_collection_status", fake_get_collection_status)

    resp = await async_client.get("/api/admin/gateway/reconciliation?stale_after_minutes=10", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    # Only the stale one is checked (created 1h ago, cutoff 10min) — the
    # fresh one (created "now") isn't old enough to flag.
    refs = [d["client_reference"] for d in body["discrepancies"]]
    assert "DON-STUCK-1" in refs
    assert "DON-FRESH-1" not in refs


@pytest.mark.asyncio
async def test_withdraw_blocked_when_receive_limit_reached(async_client, db_session, monkeypatch):
    from app.main import app as fastapi_app

    user = User(full_name="Limit User", email="limituser@example.com", wave_number="+2207088006", password_hash="x", kyc_status="APPROVED")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    campaign = Campaign(user_id=user.id, title="Limit Camp", slug="limit-camp", description="", mode=CampaignMode.ONGOING, amount_raised=200.0)
    db_session.add(campaign)
    await db_session.commit()
    await db_session.refresh(campaign)

    async def _get_user_override():
        return user
    fastapi_app.dependency_overrides[get_current_user] = _get_user_override

    async def fake_verify_recipient(**kwargs):
        return {"data": {"name_match": True, "receive_limit_reached": True}}

    monkeypatch.setattr(payments_router.hexai_service, "verify_payout_recipient", fake_verify_recipient)

    try:
        resp = await async_client.post("/api/payments/withdraw", json={"campaign_id": campaign.id, "amount": 50.0})
        assert resp.status_code == 400
        assert "receive limit" in resp.json()["detail"]
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_admin_reverse_payout(async_client, db_session, monkeypatch):
    headers = await _admin_headers(async_client, db_session, wave="+2207088007")

    owner = User(full_name="Reverse Owner", email="reverse-owner@example.com", wave_number="+2207088008", password_hash="x")
    db_session.add(owner)
    await db_session.commit()
    await db_session.refresh(owner)

    campaign = Campaign(user_id=owner.id, title="Reverse Camp", slug="reverse-camp", description="d", mode=CampaignMode.ONGOING, amount_raised=200.0)
    db_session.add(campaign)
    await db_session.commit()
    await db_session.refresh(campaign)

    payout = Payout(
        campaign_id=campaign.id, client_reference="PAYOUT-REV-1", gross_amount=100.0, hexai_fee=2.0,
        platform_commission=10.0, net_amount=88.0, amount=88.0, status="SUCCEEDED",
        gateway_transaction_id="txn-payout-1",
    )
    db_session.add(payout)
    await db_session.commit()
    await db_session.refresh(payout)

    async def fake_reverse_payout(transaction_id):
        assert transaction_id == "txn-payout-1"
        return {"data": {"transaction_id": transaction_id, "status": "REFUNDED"}}

    monkeypatch.setattr(admin_router.hexai_service, "reverse_payout", fake_reverse_payout)

    resp = await async_client.post(f"/api/admin/payouts/{payout.id}/reverse", headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "REVERSED"

    await db_session.refresh(payout)
    assert payout.status == "REVERSED"
    assert payout.reversed_at is not None

    # Idempotent replay
    resp2 = await async_client.post(f"/api/admin/payouts/{payout.id}/reverse", headers=headers)
    assert resp2.status_code == 200
    assert resp2.json()["already_reversed"] is True


@pytest.mark.asyncio
async def test_admin_reverse_payout_without_gateway_id_rejected(async_client, db_session):
    headers = await _admin_headers(async_client, db_session, wave="+2207088009")

    owner = User(full_name="NoGateway Owner", email="nogw-owner@example.com", wave_number="+2207088010", password_hash="x")
    db_session.add(owner)
    await db_session.commit()
    await db_session.refresh(owner)

    campaign = Campaign(user_id=owner.id, title="NoGW Camp", slug="nogw-camp", description="d", mode=CampaignMode.ONGOING)
    db_session.add(campaign)
    await db_session.commit()
    await db_session.refresh(campaign)

    payout = Payout(campaign_id=campaign.id, client_reference="PAYOUT-NOGW-1", gross_amount=50.0, net_amount=40.0, amount=40.0, status="SUCCEEDED")
    db_session.add(payout)
    await db_session.commit()
    await db_session.refresh(payout)

    resp = await async_client.post(f"/api/admin/payouts/{payout.id}/reverse", headers=headers)
    assert resp.status_code == 400
