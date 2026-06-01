import pytest
from sqlalchemy import select

from app.core.security import get_password_hash
from app.models.audit_log import AdminAuditLog
from app.models.campaign import Campaign
from app.models.donation import Donation
from app.models.user import User


@pytest.mark.integration
def test_payment_donation_endpoint_with_mocked_gateway(client, auth_headers, monkeypatch):
    user = {
        "full_name": "Payment User",
        "email": "payment-user@example.com",
        "wave_number": "+2207000004",
        "password": "StrongPass123!",
    }
    assert client.post("/api/auth/register", json=user).status_code == 201
    headers = auth_headers(user["wave_number"], user["password"])

    from app.api.routes import campaigns as campaigns_routes

    monkeypatch.setattr(campaigns_routes, "generate_and_upload_qr", lambda *_args, **_kwargs: "https://example.com/qr.png")

    create_response = client.post(
        "/api/campaigns/",
        json={
            "title": "Payment Campaign",
            "description": "Used for payment integration testing",
            "mode": "TARGET",
            "target_amount": 1000,
        },
        headers=headers,
    )
    campaign_id = create_response.json()["id"]

    from app.api.routes import payments as payments_routes

    async def fake_initiate_donation(*_args, **_kwargs):
        return {"data": {"redirect_url": "https://gateway.example/redirect"}}

    monkeypatch.setattr(payments_routes.hexai_service, "initiate_donation", fake_initiate_donation)

    donate_response = client.post(
        "/api/payments/donate",
        json={
            "campaign_id": campaign_id,
            "amount": 150,
            "donor_name": "Integration Donor",
            "message": "Keep it up",
        },
    )

    assert donate_response.status_code == 200
    body = donate_response.json()
    assert body["client_reference"].startswith("DON-")
    assert body["redirect_url"] == "https://gateway.example/redirect"


@pytest.mark.integration
def test_admin_can_approve_pending_donation(client, auth_headers, monkeypatch, integration_db_session):
    user = {
        "full_name": "Approve User",
        "email": "approve-user@example.com",
        "wave_number": "+2207000101",
        "password": "StrongPass123!",
    }
    assert client.post("/api/auth/register", json=user).status_code == 201
    user_headers = auth_headers(user["wave_number"], user["password"])

    async def seed_admin():
        session = await integration_db_session()
        admin = User(
            full_name="Admin Reviewer",
            email="admin-reviewer@example.com",
            wave_number="+2207999999",
            password_hash=get_password_hash("AdminPass123!"),
            role="ADMIN",
            is_email_verified=True,
        )
        session.add(admin)
        await session.commit()
        await session.close()

    import asyncio

    asyncio.run(seed_admin())
    admin_headers = auth_headers("+2207999999", "AdminPass123!")

    from app.api.routes import campaigns as campaigns_routes

    monkeypatch.setattr(campaigns_routes, "generate_and_upload_qr", lambda *_args, **_kwargs: "https://example.com/qr.png")

    create_campaign = client.post(
        "/api/campaigns/",
        json={
            "title": "Approve Pending Campaign",
            "description": "Campaign for manual approve testing",
            "mode": "TARGET",
            "target_amount": 500,
        },
        headers=user_headers,
    )
    campaign_id = create_campaign.json()["id"]

    from app.api.routes import payments as payments_routes

    async def fake_initiate_donation(*_args, **_kwargs):
        return {"data": {"redirect_url": "https://gateway.example/redirect"}}

    monkeypatch.setattr(payments_routes.hexai_service, "initiate_donation", fake_initiate_donation)

    donate_response = client.post(
        "/api/payments/donate",
        json={
            "campaign_id": campaign_id,
            "amount": 125,
            "donor_name": "Manual Approve Donor",
            "message": "Approve this manually",
        },
    )
    client_reference = donate_response.json()["client_reference"]

    approve_response = client.post(
        f"/api/payments/admin/donations/{client_reference}/approve",
        json={"reason": "Webhook delayed"},
        headers=admin_headers,
    )
    assert approve_response.status_code == 200
    approve_body = approve_response.json()
    assert approve_body["donation_status"] == "SUCCEEDED"
    assert approve_body["previous_status"] == "PENDING"
    assert approve_body["idempotent"] is False
    assert approve_body["source"] == "MANUAL_ADMIN"
    assert approve_body["reconciled_by_admin_id"] is not None
    assert approve_body["reconciled_at"] is not None

    async def assert_rows():
        session = await integration_db_session()
        donation = (
            await session.execute(select(Donation).where(Donation.client_reference == client_reference))
        ).scalars().first()
        campaign = (await session.execute(select(Campaign).where(Campaign.id == campaign_id))).scalars().first()
        audit = (
            await session.execute(
                select(AdminAuditLog).where(
                    AdminAuditLog.target_entity_type == "Donation",
                    AdminAuditLog.description == f"Manual approve for donation {client_reference}",
                )
            )
        ).scalars().first()
        assert donation is not None and donation.status == "SUCCEEDED"
        assert donation.reconciliation_source == "MANUAL_ADMIN"
        assert donation.reconciled_by_admin_id is not None
        assert donation.reconciled_at is not None
        # HexAI deducts 2% collection fee: net = 125 * 0.98 = 122.5
        assert campaign is not None and campaign.amount_raised >= 122.5
        assert audit is not None
        await session.close()

    asyncio.run(assert_rows())


@pytest.mark.integration
def test_admin_can_reject_pending_donation(client, auth_headers, monkeypatch, integration_db_session):
    user = {
        "full_name": "Reject User",
        "email": "reject-user@example.com",
        "wave_number": "+2207000102",
        "password": "StrongPass123!",
    }
    assert client.post("/api/auth/register", json=user).status_code == 201
    user_headers = auth_headers(user["wave_number"], user["password"])

    async def seed_admin():
        session = await integration_db_session()
        admin = User(
            full_name="Admin Rejector",
            email="admin-rejector@example.com",
            wave_number="+2207999998",
            password_hash=get_password_hash("AdminPass123!"),
            role="ADMIN",
            is_email_verified=True,
        )
        session.add(admin)
        await session.commit()
        await session.close()

    import asyncio

    asyncio.run(seed_admin())
    admin_headers = auth_headers("+2207999998", "AdminPass123!")

    from app.api.routes import campaigns as campaigns_routes

    monkeypatch.setattr(campaigns_routes, "generate_and_upload_qr", lambda *_args, **_kwargs: "https://example.com/qr.png")

    create_campaign = client.post(
        "/api/campaigns/",
        json={
            "title": "Reject Pending Campaign",
            "description": "Campaign for manual reject testing",
            "mode": "TARGET",
            "target_amount": 700,
        },
        headers=user_headers,
    )
    campaign_id = create_campaign.json()["id"]

    from app.api.routes import payments as payments_routes

    async def fake_initiate_donation(*_args, **_kwargs):
        return {"data": {"redirect_url": "https://gateway.example/redirect"}}

    monkeypatch.setattr(payments_routes.hexai_service, "initiate_donation", fake_initiate_donation)

    donate_response = client.post(
        "/api/payments/donate",
        json={
            "campaign_id": campaign_id,
            "amount": 200,
            "donor_name": "Manual Reject Donor",
            "message": "Reject this manually",
        },
    )
    client_reference = donate_response.json()["client_reference"]

    reject_response = client.post(
        f"/api/payments/admin/donations/{client_reference}/reject",
        json={"reason": "Webhook timeout and payment not found at provider"},
        headers=admin_headers,
    )
    assert reject_response.status_code == 200
    reject_body = reject_response.json()
    assert reject_body["donation_status"] == "FAILED"
    assert reject_body["previous_status"] == "PENDING"
    assert reject_body["idempotent"] is False
    assert reject_body["source"] == "MANUAL_ADMIN"
    assert reject_body["reconciled_by_admin_id"] is not None
    assert reject_body["reconciled_at"] is not None

    async def assert_rows():
        session = await integration_db_session()
        donation = (
            await session.execute(select(Donation).where(Donation.client_reference == client_reference))
        ).scalars().first()
        campaign = (await session.execute(select(Campaign).where(Campaign.id == campaign_id))).scalars().first()
        audit = (
            await session.execute(
                select(AdminAuditLog).where(
                    AdminAuditLog.target_entity_type == "Donation",
                    AdminAuditLog.description == f"Manual reject for donation {client_reference}",
                )
            )
        ).scalars().first()
        assert donation is not None and donation.status == "FAILED"
        assert donation.reconciliation_source == "MANUAL_ADMIN"
        assert donation.reconciled_by_admin_id is not None
        assert donation.reconciled_at is not None
        assert campaign is not None and campaign.amount_raised == 0
        assert audit is not None
        await session.close()

    asyncio.run(assert_rows())
