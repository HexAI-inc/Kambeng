import pytest
from sqlalchemy.future import select

from app.models.campaign import Campaign, CampaignMode, CampaignStatus
from app.models.donation import Donation
from app.models.user import User
from app.services.hexai_service import HexAIGatewayError
import app.api.routes.payments as payments_router


async def _seed_campaign(db_session, *, slug="aps-camp"):
    owner = User(full_name="APS Owner", email=f"owner-{slug}@example.com", wave_number=f"+22071{abs(hash(slug)) % 100000:05d}", password_hash="x")
    db_session.add(owner)
    await db_session.commit()
    await db_session.refresh(owner)

    campaign = Campaign(user_id=owner.id, title=f"Camp {slug}", slug=slug, description="d", mode=CampaignMode.ONGOING, status=CampaignStatus.ACTIVE)
    db_session.add(campaign)
    await db_session.commit()
    await db_session.refresh(campaign)
    return campaign


@pytest.mark.asyncio
async def test_aps_donate_stores_gateway_tokens_and_signals_otp_required(async_client, db_session, monkeypatch):
    campaign = await _seed_campaign(db_session, slug="aps-initiate")

    async def fake_initiate_donation(**kwargs):
        assert kwargs["provider"] == "APS"
        assert kwargs["customer_mobile"] == "+2207123456"
        assert kwargs["customer_email"] == "awa@example.com"
        return {
            "status": "success",
            "data": {
                "transaction_id": "txn-aps-1",
                "client_reference": kwargs["client_reference"],
                "status": "PENDING",
                "provider": "APS",
                "redirect_url": None,
                "next_action": {"type": "confirm_otp", "request_token": "rt_abc123"},
            },
        }

    monkeypatch.setattr(payments_router.hexai_service, "initiate_donation", fake_initiate_donation)

    resp = await async_client.post(
        "/api/payments/donate",
        json={
            "campaign_id": campaign.id, "amount": 50.0, "donor_name": "Awa", "provider": "aps",
            "customer_mobile": "+2207123456", "customer_email": "awa@example.com",
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["otp_required"] is True
    assert body["redirect_url"] is None

    donation = (await db_session.execute(select(Donation).where(Donation.client_reference == body["client_reference"]))).scalars().first()
    assert donation.provider == "aps"
    assert donation.gateway_transaction_id == "txn-aps-1"
    assert donation.gateway_request_token == "rt_abc123"
    assert donation.donor_email == "awa@example.com"
    assert donation.status == "PENDING"


@pytest.mark.asyncio
async def test_aps_donate_without_mobile_is_rejected(async_client, db_session):
    campaign = await _seed_campaign(db_session, slug="aps-no-mobile")
    resp = await async_client.post(
        "/api/payments/donate",
        json={"campaign_id": campaign.id, "amount": 50.0, "provider": "aps"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_aps_donate_without_email_is_rejected(async_client, db_session):
    campaign = await _seed_campaign(db_session, slug="aps-no-email")
    resp = await async_client.post(
        "/api/payments/donate",
        json={"campaign_id": campaign.id, "amount": 50.0, "provider": "aps", "customer_mobile": "+2207123456"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_waychit_card_donate_without_email_is_rejected(async_client, db_session):
    campaign = await _seed_campaign(db_session, slug="card-no-email")
    resp = await async_client.post(
        "/api/payments/donate",
        json={"campaign_id": campaign.id, "amount": 50.0, "provider": "waychit_card"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_gateway_validation_error_surfaces_as_clean_400(async_client, db_session, monkeypatch):
    """Mirrors the real production error: HPG rejects the initiate call
    (e.g. missing a field it silently requires) — must come back as a
    readable 400, not a flattened 500."""
    campaign = await _seed_campaign(db_session, slug="gateway-error")

    async def fake_initiate_donation(**kwargs):
        from app.services.hexai_service import HexAIGatewayError
        raise HexAIGatewayError(status_code=400, code="waychit_api_error", message="Waychit card sessions require a customer email.")

    monkeypatch.setattr(payments_router.hexai_service, "initiate_donation", fake_initiate_donation)

    resp = await async_client.post(
        "/api/payments/donate",
        json={"campaign_id": campaign.id, "amount": 50.0, "provider": "waychit_card", "customer_email": "d@example.com"},
    )
    assert resp.status_code == 400
    assert resp.json()["detail"] == "Waychit card sessions require a customer email."


@pytest.mark.asyncio
async def test_aps_confirm_success_reconciles_donation(async_client, db_session):
    campaign = await _seed_campaign(db_session, slug="aps-confirm-ok")
    donation = Donation(
        campaign_id=campaign.id, client_reference="DON-APSOK1", amount=50.0, status="PENDING",
        provider="aps", gateway_transaction_id="txn-ok", gateway_request_token="rt_ok",
    )
    db_session.add(donation)
    await db_session.commit()

    async def fake_confirm_collection(transaction_id, otp, request_token):
        assert transaction_id == "txn-ok"
        assert otp == "123456"
        assert request_token == "rt_ok"
        return {"status": "success", "data": {"transaction_id": transaction_id, "status": "SUCCEEDED", "provider": "APS"}}

    import app.api.routes.payments as payments_router
    payments_router.hexai_service.confirm_collection = fake_confirm_collection

    resp = await async_client.post("/api/payments/aps/confirm", json={"client_reference": "DON-APSOK1", "otp": "123456"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "SUCCEEDED"

    await db_session.refresh(campaign)
    await db_session.refresh(donation)
    assert donation.status == "SUCCEEDED"
    assert campaign.amount_raised == pytest.approx(49.0)  # net of 2% HexAI collection fee


@pytest.mark.asyncio
async def test_aps_confirm_wrong_otp_returns_retryable_error(async_client, db_session):
    campaign = await _seed_campaign(db_session, slug="aps-confirm-wrong")
    donation = Donation(
        campaign_id=campaign.id, client_reference="DON-APSWRONG", amount=50.0, status="PENDING",
        provider="aps", gateway_transaction_id="txn-wrong", gateway_request_token="rt_wrong",
    )
    db_session.add(donation)
    await db_session.commit()

    async def fake_confirm_collection(transaction_id, otp, request_token):
        raise HexAIGatewayError(status_code=400, code="invalid_otp", message="The code you entered is incorrect.")

    import app.api.routes.payments as payments_router
    payments_router.hexai_service.confirm_collection = fake_confirm_collection

    resp = await async_client.post("/api/payments/aps/confirm", json={"client_reference": "DON-APSWRONG", "otp": "000000"})
    assert resp.status_code == 400
    assert "incorrect" in resp.json()["detail"]

    await db_session.refresh(donation)
    assert donation.status == "PENDING"  # unchanged — donor can retry


@pytest.mark.asyncio
async def test_aps_confirm_rejects_non_aps_donation(async_client, db_session):
    campaign = await _seed_campaign(db_session, slug="aps-confirm-wave")
    donation = Donation(campaign_id=campaign.id, client_reference="DON-WAVE1", amount=50.0, status="PENDING", provider="wave")
    db_session.add(donation)
    await db_session.commit()

    resp = await async_client.post("/api/payments/aps/confirm", json={"client_reference": "DON-WAVE1", "otp": "123456"})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_aps_confirm_is_idempotent_after_webhook_already_resolved(async_client, db_session):
    """If the backup webhook reconciles the donation first, a slow/duplicate
    confirm from the client must not error — it should just report state."""
    campaign = await _seed_campaign(db_session, slug="aps-confirm-idempotent")
    donation = Donation(
        campaign_id=campaign.id, client_reference="DON-APSIDEMP", amount=50.0, status="SUCCEEDED",
        provider="aps", gateway_transaction_id="txn-idemp", gateway_request_token="rt_idemp",
    )
    db_session.add(donation)
    await db_session.commit()

    resp = await async_client.post("/api/payments/aps/confirm", json={"client_reference": "DON-APSIDEMP", "otp": "123456"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "SUCCEEDED"
