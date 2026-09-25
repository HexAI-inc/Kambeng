"""Phase 3 (spending accountability, class board) and Phase 4 (organization
teams, two-person withdrawal approval)."""
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.future import select

from app.api.routes.auth import get_current_user
from app.models.campaign import Campaign, CampaignMode
from app.models.campaign_update import CampaignUpdate
from app.models.donation import Donation
from app.models.organization import Organization
from app.models.payout import Payout
from app.models.user import User
import app.api.routes.campaigns as campaigns_router
import app.api.routes.payments as payments_router
import app.services.email_service as email_service
from app.services.spending import send_receipt_reminders


async def _user(db_session, *, name, wave, kyc_status="APPROVED"):
    user = User(full_name=name, email=f"{wave}@example.com", wave_number=wave, password_hash="x", kyc_status=kyc_status)
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
def act_as():
    from app.main import app as fastapi_app

    def _act_as(user):
        async def _get():
            return user
        fastapi_app.dependency_overrides[get_current_user] = _get

    yield _act_as
    fastapi_app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture(autouse=True)
def _no_side_effects(monkeypatch):
    monkeypatch.setattr(campaigns_router, "generate_and_upload_qr", lambda *_a, **_k: "https://example.com/qr.png")


@pytest.fixture
def outbox(monkeypatch):
    sent = []

    def fake_send(to_email, subject, html):
        sent.append({"to": to_email, "subject": subject, "html": html})
        return True

    for module in ("app.api.routes.organizations", "app.api.routes.payments", "app.services.email_service"):
        monkeypatch.setattr(f"{module}.send_email", fake_send)
    return sent


@pytest.fixture
def gateway(monkeypatch):
    calls = []

    async def fake_initiate_payout(requested_amount, recipient_mobile, payout_reference, recipient_name):
        calls.append({"amount": requested_amount, "mobile": recipient_mobile, "name": recipient_name})
        return ({"data": {"transaction_id": f"TX-{len(calls)}"}}, requested_amount)

    async def fake_verify_recipient(**kwargs):
        return {"data": {"name_match": True, "receive_limit_reached": False}}

    monkeypatch.setattr(payments_router.hexai_service, "initiate_payout", fake_initiate_payout)
    monkeypatch.setattr(payments_router.hexai_service, "verify_payout_recipient", fake_verify_recipient)
    return calls


async def _verified_school(async_client, db_session, owner, act_as):
    act_as(owner)
    resp = await async_client.post("/api/organizations", json={"name": "Sukuta LBS", "org_type": "SCHOOL"})
    assert resp.status_code == 201, resp.text
    org_id = resp.json()["id"]
    org = (await db_session.execute(select(Organization).where(Organization.id == org_id))).scalars().one()
    org.verification_status = "APPROVED"
    org.payout_wave_number = "+2207123456"
    org.payout_account_holder = "ORGANIZATION"
    await db_session.commit()
    return org_id


async def _join(async_client, act_as, owner, member, org_id, title="Treasurer"):
    act_as(owner)
    resp = await async_client.post(f"/api/organizations/{org_id}/members", json={"identifier": member.wave_number, "title": title})
    assert resp.status_code == 201, resp.text
    act_as(member)
    invites = (await async_client.get("/api/organizations/invitations/me")).json()
    assert len(invites) == 1
    resp = await async_client.post(f"/api/organizations/invitations/{invites[0]['member_id']}/accept")
    assert resp.status_code == 200, resp.text
    return resp.json()


@pytest.mark.asyncio
async def test_team_members_manage_organization_campaigns(async_client, db_session, act_as, outbox):
    owner = await _user(db_session, name="Awa Jallow", wave="+2207000501")
    manager = await _user(db_session, name="Musa Bah", wave="+2207000502")
    outsider = await _user(db_session, name="Lamin Ceesay", wave="+2207000503")
    org_id = await _verified_school(async_client, db_session, owner, act_as)

    # Unknown people can't be invited; invitations go by email.
    act_as(owner)
    resp = await async_client.post(f"/api/organizations/{org_id}/members", json={"identifier": "7999999"})
    assert resp.status_code == 404
    org = await _join(async_client, act_as, owner, manager, org_id)
    assert any("invited you to manage Sukuta LBS" in m["subject"] for m in outbox)
    assert org["my_role"] == "MANAGER"
    assert [(m["full_name"], m["title"], m["status"]) for m in org["members"]] == [("Musa Bah", "Treasurer", "ACTIVE")]

    act_as(owner)
    assert (await async_client.post(f"/api/organizations/{org_id}/members", json={"identifier": manager.wave_number})).status_code == 409

    # The manager creates and edits campaigns for the organization...
    act_as(manager)
    resp = await async_client.post("/api/campaigns/", json={
        "title": "Library books", "description": "Two hundred readers", "mode": "ONGOING",
        "beneficiary_type": "organization", "organization_id": org_id,
    })
    assert resp.status_code == 201, resp.text
    slug = resp.json()["slug"]
    assert resp.json()["class_board_enabled"] is True  # school default

    act_as(owner)
    resp = await async_client.post("/api/campaigns/", json={
        "title": "School roof", "description": "Fix the roof now", "mode": "ONGOING",
        "beneficiary_type": "organization", "organization_id": org_id,
    })
    roof_slug = resp.json()["slug"]

    act_as(manager)
    assert (await async_client.patch(f"/api/campaigns/{roof_slug}/classification", json={"category": "education", "tags": []})).status_code == 200
    mine = {c["slug"] for c in (await async_client.get("/api/campaigns/me")).json()}
    assert mine == {slug, roof_slug}
    # ...but can't run the team or settings.
    assert (await async_client.post(f"/api/organizations/{org_id}/members", json={"identifier": outsider.wave_number})).status_code == 403
    assert (await async_client.patch(f"/api/organizations/{org_id}", json={"approval_threshold": 100})).status_code == 403

    act_as(outsider)
    assert (await async_client.patch(f"/api/campaigns/{roof_slug}/classification", json={"category": "education", "tags": []})).status_code == 403
    assert (await async_client.get(f"/api/organizations/{org_id}")).status_code == 403

    # Leaving removes access.
    act_as(manager)
    member_id = org["members"][0]["id"]
    assert (await async_client.delete(f"/api/organizations/{org_id}/members/{member_id}")).status_code == 204
    assert (await async_client.patch(f"/api/campaigns/{roof_slug}/classification", json={"category": "education", "tags": []})).status_code == 403
    assert (await async_client.get("/api/organizations/me")).json() == []


@pytest.mark.asyncio
async def test_two_person_approval_for_large_withdrawals(async_client, db_session, act_as, outbox, gateway):
    owner = await _user(db_session, name="Awa Jallow", wave="+2207000601")
    treasurer = await _user(db_session, name="Musa Bah", wave="+2207000602")
    org_id = await _verified_school(async_client, db_session, owner, act_as)

    act_as(owner)
    # The rule needs a second person to exist.
    assert (await async_client.patch(f"/api/organizations/{org_id}", json={"approval_threshold": 200})).status_code == 400
    await _join(async_client, act_as, owner, treasurer, org_id)
    act_as(owner)
    resp = await async_client.patch(f"/api/organizations/{org_id}", json={"approval_threshold": 200})
    assert resp.status_code == 200 and resp.json()["approval_threshold"] == 200

    resp = await async_client.post("/api/campaigns/", json={
        "title": "Water pump", "description": "Pump for the school well", "mode": "ONGOING",
        "beneficiary_type": "organization", "organization_id": org_id,
    })
    campaign_id = resp.json()["id"]
    campaign = (await db_session.execute(select(Campaign).where(Campaign.id == campaign_id))).scalars().one()
    campaign.amount_raised = 1000.0
    await db_session.commit()

    # Below the threshold: straight through, paid to the organization.
    act_as(treasurer)
    resp = await async_client.post("/api/payments/withdraw", json={"campaign_id": campaign_id, "amount": 150})
    assert resp.status_code == 200, resp.text
    assert gateway[-1]["mobile"] == "+2207123456"

    # Above it: a request, no money moves.
    resp = await async_client.post("/api/payments/withdraw", json={"campaign_id": campaign_id, "amount": 300})
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "PENDING_APPROVAL"
    request_id = resp.json()["request_id"]
    assert len(gateway) == 1
    assert any(m["to"] == owner.email and "Approval needed" in m["subject"] for m in outbox)

    assert (await async_client.post("/api/payments/withdraw", json={"campaign_id": campaign_id, "amount": 250})).status_code == 409
    assert (await async_client.post(f"/api/payments/withdrawal-requests/{request_id}/approve")).status_code == 403
    listed = (await async_client.get("/api/payments/withdrawal-requests", params={"campaign_id": campaign_id})).json()
    assert listed[0]["can_approve"] is False and listed[0]["can_cancel"] is True

    act_as(owner)
    listed = (await async_client.get("/api/payments/withdrawal-requests", params={"campaign_id": campaign_id})).json()
    assert listed[0]["can_approve"] is True
    summary = (await async_client.get(f"/api/payments/withdraw/summary/{campaign_id}")).json()
    assert summary["approval_threshold"] == 200

    resp = await async_client.post(f"/api/payments/withdrawal-requests/{request_id}/approve")
    assert resp.status_code == 200, resp.text
    assert len(gateway) == 2 and gateway[-1]["mobile"] == "+2207123456"
    assert (await async_client.post(f"/api/payments/withdrawal-requests/{request_id}/approve")).status_code == 409

    payout = (await db_session.execute(
        select(Payout).where(Payout.campaign_id == campaign_id, Payout.gross_amount == 300)
        .execution_options(populate_existing=True)
    )).scalars().one()
    assert (payout.requested_by_user_id, payout.approved_by_user_id) == (treasurer.id, owner.id)
    assert payout.recipient_wave_number == "+2207123456"
    listed = (await async_client.get("/api/payments/withdrawal-requests", params={"campaign_id": campaign_id})).json()
    assert listed[0]["status"] == "APPROVED" and listed[0]["payout_id"] == payout.id
    assert listed[0]["decided_by_name"] == "Awa Jallow"

    # Rejection and cancellation.
    act_as(treasurer)
    request_id = (await async_client.post("/api/payments/withdraw", json={"campaign_id": campaign_id, "amount": 300})).json()["request_id"]
    act_as(owner)
    resp = await async_client.post(f"/api/payments/withdrawal-requests/{request_id}/reject", json={"note": "Wait for the quote"})
    assert resp.status_code == 200 and resp.json()["status"] == "REJECTED"
    assert any(m["to"] == treasurer.email and "not approved" in m["subject"] for m in outbox)

    act_as(treasurer)
    request_id = (await async_client.post("/api/payments/withdraw", json={"campaign_id": campaign_id, "amount": 300})).json()["request_id"]
    act_as(owner)
    assert (await async_client.post(f"/api/payments/withdrawal-requests/{request_id}/cancel")).status_code == 403
    act_as(treasurer)
    resp = await async_client.post(f"/api/payments/withdrawal-requests/{request_id}/cancel")
    assert resp.status_code == 200 and resp.json()["status"] == "CANCELLED"
    assert len(gateway) == 2


@pytest.mark.asyncio
async def test_class_board_and_donation_class(async_client, db_session, act_as, monkeypatch):
    owner = await _user(db_session, name="Awa Jallow", wave="+2207000701")
    org_id = await _verified_school(async_client, db_session, owner, act_as)
    act_as(owner)
    school = (await async_client.post("/api/campaigns/", json={
        "title": "Alumni fund", "description": "Class of 2009 reunion", "mode": "ONGOING",
        "beneficiary_type": "organization", "organization_id": org_id,
    })).json()
    personal = (await async_client.post("/api/campaigns/", json={
        "title": "My fees", "description": "University fees", "mode": "ONGOING",
    })).json()
    assert personal["class_board_enabled"] is False
    assert (await async_client.get(f"/api/campaigns/{personal['slug']}/class-board")).json() == {"enabled": False, "classes": []}

    async def fake_initiate_donation(*_args, **_kwargs):
        return {"data": {"redirect_url": "https://gateway.example/redirect"}}
    monkeypatch.setattr(payments_router.hexai_service, "initiate_donation", fake_initiate_donation)

    for campaign in (school, personal):
        resp = await async_client.post("/api/payments/donate", json={"campaign_id": campaign["id"], "amount": 100, "graduating_class": 2009})
        assert resp.status_code in (200, 201), resp.text
    kept = (await db_session.execute(select(Donation.campaign_id, Donation.graduating_class))).all()
    assert dict(kept) == {school["id"]: 2009, personal["id"]: None}
    assert (await async_client.post("/api/payments/donate", json={"campaign_id": school["id"], "amount": 100, "graduating_class": 1800})).status_code == 422

    await db_session.execute(Donation.__table__.update().values(status="SUCCEEDED"))
    for cls, amount, status in [(2009, 400, "SUCCEEDED"), (2012, 1000, "SUCCEEDED"), (2012, 50, "FAILED"), (None, 999, "SUCCEEDED")]:
        db_session.add(Donation(campaign_id=school["id"], amount=amount, status=status, graduating_class=cls, client_reference=f"DON-{cls}-{amount}"))
    await db_session.commit()

    board = (await async_client.get(f"/api/campaigns/{school['slug']}/class-board")).json()
    assert board == {"enabled": True, "classes": [
        {"graduating_class": 2012, "total": 1000.0, "donors": 1},
        {"graduating_class": 2009, "total": 500.0, "donors": 2},
    ]}


@pytest.mark.asyncio
async def test_spending_summary_and_receipt_reminder(async_client, db_session, outbox):
    owner = await _user(db_session, name="Awa Jallow", wave="+2207000801")
    campaign = Campaign(user_id=owner.id, title="Desks", slug="desks", description="d", mode=CampaignMode.ONGOING, amount_raised=5000)
    db_session.add(campaign)
    await db_session.commit()
    await db_session.refresh(campaign)

    old = datetime.now(UTC) - timedelta(days=8)
    db_session.add_all([
        Payout(campaign_id=campaign.id, client_reference="P-1", gross_amount=1012, net_amount=1000, status="SUCCEEDED", created_at=old),
        Payout(campaign_id=campaign.id, client_reference="P-2", gross_amount=500, net_amount=488, status="FAILED", created_at=old),
        CampaignUpdate(campaign_id=campaign.id, user_id=owner.id, text="Bought 10 desks", amount_spent=400, created_at=old - timedelta(days=1)),
    ])
    await db_session.commit()

    spending = (await async_client.get("/api/campaigns/desks/spending")).json()
    assert (spending["withdrawn"], spending["accounted_for"], spending["unaccounted"]) == (1000.0, 400.0, 600.0)

    assert await send_receipt_reminders(db_session) == 1
    assert outbox[-1]["to"] == owner.email and "600 GMD" in outbox[-1]["html"]
    assert await send_receipt_reminders(db_session) == 0  # once per payout

    # A spending update after the withdrawal means no nudge.
    db_session.add(Payout(campaign_id=campaign.id, client_reference="P-3", gross_amount=212, net_amount=200, status="SUCCEEDED", created_at=old))
    db_session.add(CampaignUpdate(campaign_id=campaign.id, user_id=owner.id, text="Paint", amount_spent=50, created_at=old + timedelta(days=1)))
    await db_session.commit()
    assert await send_receipt_reminders(db_session) == 0
