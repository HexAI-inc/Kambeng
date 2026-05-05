import hashlib
import hmac
import json

import pytest


@pytest.mark.integration
def test_webhook_signature_validation_and_reconciliation(client, auth_headers, monkeypatch, integration_db_session):
    user = {
        "full_name": "Webhook User",
        "email": "webhook-user@example.com",
        "wave_number": "+2207000005",
        "password": "StrongPass123!",
    }
    assert client.post("/api/auth/register", json=user).status_code == 201
    headers = auth_headers(user["wave_number"], user["password"])

    from app.api.routes import campaigns as campaigns_routes

    monkeypatch.setattr(campaigns_routes, "generate_and_upload_qr", lambda *_args, **_kwargs: "https://example.com/qr.png")

    create_response = client.post(
        "/api/campaigns/",
        json={
            "title": "Webhook Campaign",
            "description": "Webhook testing campaign",
            "mode": "TARGET",
            "target_amount": 300,
        },
        headers=headers,
    )
    campaign_id = create_response.json()["id"]

    from app.models.donation import Donation

    async def seed_donation():
        session = await integration_db_session()
        donation = Donation(campaign_id=campaign_id, client_reference="DON-INTEG-1", amount=100.0, status="PENDING")
        session.add(donation)
        await session.commit()
        await session.close()

    import asyncio

    asyncio.run(seed_donation())

    payload = {
        "event": "transaction.completed",
        "transaction": {
            "client_reference": "DON-INTEG-1",
            "status": "SUCCEEDED",
        },
    }

    invalid_response = client.post(
        "/api/webhooks/hexai",
        json=payload,
        headers={"wave-signature": "invalid"},
    )
    assert invalid_response.status_code == 401

    raw = json.dumps(payload).encode("utf-8")
    signature = hmac.new(b"test-webhook-secret", raw, hashlib.sha256).hexdigest()

    valid_response = client.post(
        "/api/webhooks/hexai",
        json=payload,
        headers={"wave-signature": signature},
    )
    assert valid_response.status_code == 200
