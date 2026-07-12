import hashlib
import hmac
import json

import pytest
from sqlalchemy.future import select

from app.api.routes.auth import get_admin_user
from app.models.audit_log import AdminAuditLog, AuditActionType
from app.models.campaign import Campaign, CampaignMode
from app.models.ledger import TransactionLedger, TransactionStatus, TransactionType
from app.models.payout import Payout
from app.models.user import User

SECRET = b"test-webhook-secret"


def _signed(payload: dict) -> tuple[bytes, dict]:
    raw = json.dumps(payload).encode("utf-8")
    signature = hmac.new(SECRET, raw, hashlib.sha256).hexdigest()
    return raw, {"x-hexai-signature": signature, "content-type": "application/json"}


async def _seed_payout(db_session, reference: str, wave="+2207005555", email="payout-owner@example.com"):
    user = User(full_name="Payout Owner", email=email, wave_number=wave, password_hash="x")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    campaign = Campaign(user_id=user.id, title=f"Camp {reference}", slug=f"camp-{reference.lower()}", description="", mode=CampaignMode.ONGOING)
    db_session.add(campaign)
    await db_session.commit()
    await db_session.refresh(campaign)

    payout = Payout(
        campaign_id=campaign.id,
        client_reference=reference,
        gross_amount=1000.0,
        hexai_fee=10.0,
        platform_commission=10.0,
        net_amount=980.0,
        amount=980.0,
        status="PENDING",
    )
    ledger = TransactionLedger(
        campaign_id=campaign.id,
        transaction_type=TransactionType.WITHDRAWAL,
        status=TransactionStatus.PENDING,
        gross_amount=1000.0,
        hexai_fee=10.0,
        platform_commission=10.0,
        net_amount=980.0,
        external_reference=reference,
        description="Test withdrawal",
    )
    db_session.add_all([payout, ledger])
    await db_session.commit()
    await db_session.refresh(payout)
    return payout


async def _ledger_status(db_session, reference: str) -> TransactionStatus:
    await db_session.commit()
    result = await db_session.execute(
        select(TransactionLedger).where(TransactionLedger.external_reference == reference)
    )
    ledger = result.scalars().first()
    await db_session.refresh(ledger)
    return ledger.status


async def _payout_status(db_session, payout_id: int) -> str:
    await db_session.commit()  # end any open transaction so we read fresh state
    result = await db_session.execute(select(Payout).where(Payout.id == payout_id))
    payout = result.scalars().first()
    await db_session.refresh(payout)
    return payout.status


@pytest.mark.asyncio
async def test_payout_webhook_handles_alternate_event_and_shape(async_client, db_session):
    """Payout notifications that don't match the documented {event, transaction}
    shape used to be rejected with 422 and lost. They must be handled now."""
    payout = await _seed_payout(db_session, "PAYOUT-ALT-1")

    raw, headers = _signed({
        "event": "payout.completed",
        "payout": {"payout_reference": "PAYOUT-ALT-1", "status": "SUCCESS"},
    })
    resp = await async_client.post("/api/webhooks/hexai", content=raw, headers=headers)
    assert resp.status_code == 200, resp.text

    assert await _payout_status(db_session, payout.id) == "SUCCEEDED"
    # the WITHDRAWAL ledger row must move with the payout — revenue stats sum it
    assert await _ledger_status(db_session, "PAYOUT-ALT-1") == TransactionStatus.SUCCEEDED


@pytest.mark.asyncio
async def test_payout_webhook_failure_and_nonterminal_statuses(async_client, db_session):
    payout = await _seed_payout(db_session, "OUT-FAIL-1", wave="+2207006666", email="fail-owner@example.com")

    # non-terminal status leaves the payout untouched
    raw, headers = _signed({
        "event": "transaction.completed",
        "transaction": {"client_reference": "OUT-FAIL-1", "status": "PROCESSING"},
    })
    resp = await async_client.post("/api/webhooks/hexai", content=raw, headers=headers)
    assert resp.status_code == 200
    assert await _payout_status(db_session, payout.id) == "PENDING"

    # gateway wording variant of failure
    raw, headers = _signed({
        "event": "transaction.completed",
        "transaction": {"client_reference": "OUT-FAIL-1", "status": "CANCELLED"},
    })
    resp = await async_client.post("/api/webhooks/hexai", content=raw, headers=headers)
    assert resp.status_code == 200
    assert await _payout_status(db_session, payout.id) == "FAILED"


@pytest.mark.asyncio
async def test_admin_verify_payout_against_gateway(async_client, db_session, monkeypatch):
    payout = await _seed_payout(db_session, "PAYOUT-VERIFY-1", wave="+2207007777", email="verify-owner@example.com")

    admin = User(full_name="Admin", email="payout-admin@example.com", wave_number="+2207008888", password_hash="x", role="ADMIN")
    db_session.add(admin)
    await db_session.commit()
    await db_session.refresh(admin)

    from app.main import app as fastapi_app
    from app.api.routes import admin as admin_routes

    async def _admin_override():
        return admin

    fastapi_app.dependency_overrides[get_admin_user] = _admin_override

    async def fake_status_completed(_ref):
        return {"data": {"status": "COMPLETED"}}

    monkeypatch.setattr(admin_routes.hexai_service, "get_payout_status", fake_status_completed)

    try:
        resp = await async_client.post(f"/api/admin/payouts/{payout.id}/verify")
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["gateway_status"] == "COMPLETED"
        assert body["previous_status"] == "PENDING"
        assert body["status"] == "SUCCEEDED"
        assert body["applied"] is True

        # verify again — idempotent
        resp2 = await async_client.post(f"/api/admin/payouts/{payout.id}/verify")
        assert resp2.json()["applied"] is False

        # unknown reference at gateway
        async def fake_status_missing(_ref):
            return None

        monkeypatch.setattr(admin_routes.hexai_service, "get_payout_status", fake_status_missing)
        resp3 = await async_client.post(f"/api/admin/payouts/{payout.id}/verify")
        assert resp3.json()["gateway_status"] == "NOT_FOUND"
        assert resp3.json()["applied"] is False
    finally:
        fastapi_app.dependency_overrides.pop(get_admin_user, None)


@pytest.mark.asyncio
async def test_admin_mark_payout_succeeded_manually(async_client, db_session):
    payout = await _seed_payout(db_session, "PAYOUT-MANUAL-1", wave="+2207009999", email="manual-owner@example.com")

    admin = User(full_name="Admin Two", email="manual-admin@example.com", wave_number="+2207010101", password_hash="x", role="ADMIN")
    db_session.add(admin)
    await db_session.commit()
    await db_session.refresh(admin)

    from app.main import app as fastapi_app

    async def _admin_override():
        return admin

    fastapi_app.dependency_overrides[get_admin_user] = _admin_override
    try:
        resp = await async_client.post(f"/api/admin/payouts/{payout.id}/mark-succeeded")
        assert resp.status_code == 200, resp.text
        assert resp.json()["status"] == "SUCCEEDED"
        assert await _payout_status(db_session, payout.id) == "SUCCEEDED"

        # audit trail records the override
        audit_result = await db_session.execute(
            select(AdminAuditLog).where(
                AdminAuditLog.action_type == AuditActionType.PAYOUT_MANUAL_OVERRIDE,
                AdminAuditLog.target_entity_id == payout.id,
            )
        )
        assert audit_result.scalars().first() is not None

        # not repeatable once no longer PENDING
        resp2 = await async_client.post(f"/api/admin/payouts/{payout.id}/mark-succeeded")
        assert resp2.status_code == 409

        # missing payout
        resp3 = await async_client.post("/api/admin/payouts/999999/mark-succeeded")
        assert resp3.status_code == 404
    finally:
        fastapi_app.dependency_overrides.pop(get_admin_user, None)
