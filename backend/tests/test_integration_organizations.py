import pytest
from sqlalchemy.future import select

from app.api.routes.auth import get_current_user
from app.models.campaign import Campaign, CampaignMode
from app.models.organization import Organization
from app.models.promotion import Promotion, PromoType
from app.models.user import User
import app.api.routes.campaigns as campaigns_router
import app.api.routes.payments as payments_router
from app.services.promotions import resolve_withdrawal_fee_waiver

PDF = ("letter.pdf", b"%PDF-1.4 test letter", "application/pdf")


async def _user(db_session, *, name, wave, role="USER", kyc_status="APPROVED"):
    user = User(
        full_name=name, email=f"{wave}@example.com", wave_number=wave,
        password_hash="x", role=role, kyc_status=kyc_status,
    )
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
def _no_qr(monkeypatch):
    monkeypatch.setattr(campaigns_router, "generate_and_upload_qr", lambda *_a, **_k: "https://example.com/qr.png")


async def _create_org(async_client, **overrides):
    body = {
        "name": "Sukuta Lower Basic School",
        "org_type": "SCHOOL",
        "region": "West Coast",
        "village": "Sukuta",
        "representative_role": "PTA chair",
        **overrides,
    }
    resp = await async_client.post("/api/organizations", json=body)
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest.mark.asyncio
async def test_organization_campaign_is_linked_and_shown(async_client, db_session, act_as):
    owner = await _user(db_session, name="Awa Jallow", wave="+2207000101")
    stranger = await _user(db_session, name="Lamin Ceesay", wave="+2207000102")

    act_as(owner)
    org = await _create_org(async_client)
    assert org["verification_status"] == "NOT_SUBMITTED"
    assert org["is_verified"] is False

    mine = (await async_client.get("/api/organizations/me")).json()
    assert [o["id"] for o in mine] == [org["id"]]

    resp = await async_client.post("/api/campaigns/", json={
        "title": "School roof", "description": "Fix the roof before the rains", "mode": "ONGOING",
        "beneficiary_type": "organization", "organization_id": org["id"],
    })
    assert resp.status_code == 201, resp.text
    campaign = resp.json()
    assert campaign["beneficiary_type"] == "organization"
    assert campaign["organization"]["name"] == "Sukuta Lower Basic School"
    assert campaign["organization"]["is_verified"] is False
    assert "payout_wave_number" not in campaign["organization"]

    stored = (await db_session.execute(select(Campaign).where(Campaign.id == campaign["id"]))).scalars().one()
    assert stored.organiser_type == "ngo"

    detail = (await async_client.get(f"/api/campaigns/{campaign['slug']}")).json()
    assert detail["organization"]["representative_role"] == "PTA chair"

    cards = (await async_client.get("/api/utils/frontend/campaign-cards")).json()
    assert cards[0]["organization"] == {"name": "Sukuta Lower Basic School", "is_verified": False}

    # "ngo" can no longer be self-declared.
    resp = await async_client.post("/api/campaigns/", json={
        "title": "Just me", "description": "Personal campaign here", "mode": "ONGOING", "organiser_type": "ngo",
    })
    assert resp.status_code == 201, resp.text
    stored = (await db_session.execute(select(Campaign).where(Campaign.id == resp.json()["id"]))).scalars().one()
    assert stored.organiser_type == "individual"
    assert stored.organization_id is None

    # Organization beneficiary needs an organization.
    resp = await async_client.post("/api/campaigns/", json={
        "title": "Missing", "description": "No organization given", "mode": "ONGOING", "beneficiary_type": "organization",
    })
    assert resp.status_code == 422

    # Someone else can't raise under this organization, or edit it.
    act_as(stranger)
    resp = await async_client.post("/api/campaigns/", json={
        "title": "Not mine", "description": "Hijacking the school", "mode": "ONGOING",
        "beneficiary_type": "organization", "organization_id": org["id"],
    })
    assert resp.status_code == 403
    assert (await async_client.patch(f"/api/organizations/{org['id']}", json={"name": "Mine now"})).status_code == 403


@pytest.mark.asyncio
async def test_verification_gates_withdrawals_and_sets_payout(async_client, db_session, act_as, monkeypatch):
    owner = await _user(db_session, name="Awa Jallow", wave="+2207000201")
    admin = await _user(db_session, name="Admin", wave="+2207000299", role="ADMIN")

    act_as(owner)
    org = await _create_org(async_client)
    resp = await async_client.post("/api/campaigns/", json={
        "title": "School desks", "description": "Forty new desks", "mode": "ONGOING",
        "beneficiary_type": "organization", "organization_id": org["id"],
    })
    campaign_id = resp.json()["id"]
    campaign = (await db_session.execute(select(Campaign).where(Campaign.id == campaign_id))).scalars().one()
    campaign.amount_raised = 500.0
    await db_session.commit()

    sent = {}

    async def fake_initiate_payout(requested_amount, recipient_mobile, payout_reference, recipient_name):
        sent.update(mobile=recipient_mobile, name=recipient_name)
        return ({"data": {"transaction_id": "TX-1"}}, requested_amount)

    async def fake_verify_recipient(**kwargs):
        return {"data": {"name_match": True, "receive_limit_reached": False}}

    monkeypatch.setattr(payments_router.hexai_service, "initiate_payout", fake_initiate_payout)
    monkeypatch.setattr(payments_router.hexai_service, "verify_payout_recipient", fake_verify_recipient)

    summary = (await async_client.get(f"/api/payments/withdraw/summary/{campaign_id}")).json()
    assert summary["organization_name"] == "Sukuta Lower Basic School"
    assert summary["withdrawal_blocked_reason"]

    # Personal KYC is approved, but the organization isn't verified yet.
    resp = await async_client.post("/api/payments/withdraw", json={"campaign_id": campaign_id, "amount": 100})
    assert resp.status_code == 403
    assert "Sukuta Lower Basic School" in resp.json()["detail"]

    url = f"/api/organizations/{org['id']}/verification"
    # A personal payout number needs an authorization letter...
    resp = await async_client.post(url, data={
        "evidence_type": "REGISTRATION_CERTIFICATE", "payout_account_holder": "REPRESENTATIVE",
        "payout_wave_number": "7000201",
    }, files={"file": PDF})
    assert resp.status_code == 400
    # ...and has to be the representative's own number.
    resp = await async_client.post(url, data={
        "evidence_type": "AUTHORIZATION_LETTER", "payout_account_holder": "REPRESENTATIVE",
        "payout_wave_number": "7999999",
    }, files={"file": PDF})
    assert resp.status_code == 400

    resp = await async_client.post(url, data={
        "evidence_type": "AUTHORIZATION_LETTER", "payout_account_holder": "ORGANIZATION",
        "payout_wave_number": "07 123 456", "issuer": "Head teacher, Sukuta LBS",
    }, files={"file": PDF})
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["verification_status"] == "SUBMITTED"
    assert body["latest_verification"]["payout_wave_number"] == "+2207123456"
    submission_id = body["latest_verification"]["id"]

    # One submission at a time; name is frozen while under review.
    resp = await async_client.post(url, data={
        "evidence_type": "AUTHORIZATION_LETTER", "payout_account_holder": "ORGANIZATION", "payout_wave_number": "7123456",
    }, files={"file": PDF})
    assert resp.status_code == 400
    assert (await async_client.patch(f"/api/organizations/{org['id']}", json={"name": "Other School"})).status_code == 409
    resp = await async_client.patch(f"/api/organizations/{org['id']}", json={"description": "Founded 1972"})
    assert resp.status_code == 200 and resp.json()["description"] == "Founded 1972"

    # Still blocked while pending; the queue is admin-only.
    assert (await async_client.post("/api/payments/withdraw", json={"campaign_id": campaign_id, "amount": 100})).status_code == 403
    assert (await async_client.get("/api/admin/org-verifications")).status_code == 403

    act_as(admin)
    queue = (await async_client.get("/api/admin/org-verifications")).json()
    assert [q["id"] for q in queue] == [submission_id]
    assert queue[0]["submitter_kyc_status"] == "APPROVED"
    assert queue[0]["campaign_count"] == 1
    resp = await async_client.post(f"/api/admin/org-verifications/{submission_id}/approve")
    assert resp.status_code == 200, resp.text
    assert resp.json()["organization"]["is_verified"] is True
    assert (await async_client.post(f"/api/admin/org-verifications/{submission_id}/approve")).status_code == 409

    act_as(owner)
    resp = await async_client.post("/api/payments/withdraw", json={"campaign_id": campaign_id, "amount": 100})
    assert resp.status_code == 200, resp.text
    assert sent == {"mobile": "+2207123456", "name": "Sukuta Lower Basic School"}
    assert resp.json()["wave_number"] == "+2207123456"
    summary = (await async_client.get(f"/api/payments/withdraw/summary/{campaign_id}")).json()
    assert summary["withdrawal_blocked_reason"] is None
    assert summary["payout_wave_number"] == "+2207123456"

    detail = (await async_client.get("/api/campaigns/school-desks")).json()
    assert detail["organization"]["is_verified"] is True


@pytest.mark.asyncio
async def test_rejection_allows_resubmission(async_client, db_session, act_as):
    owner = await _user(db_session, name="Awa Jallow", wave="+2207000301")
    admin = await _user(db_session, name="Admin", wave="+2207000399", role="ADMIN")

    act_as(owner)
    org = await _create_org(async_client, name="Brikama Alumni", org_type="ALUMNI_ASSOCIATION")
    url = f"/api/organizations/{org['id']}/verification"
    data = {"evidence_type": "AUTHORIZATION_LETTER", "payout_account_holder": "REPRESENTATIVE", "payout_wave_number": "+220 700 0301"}
    resp = await async_client.post(url, data=data, files={"file": PDF})
    assert resp.status_code == 201, resp.text
    submission_id = resp.json()["latest_verification"]["id"]

    act_as(admin)
    assert (await async_client.post(f"/api/admin/org-verifications/{submission_id}/reject", json={"rejection_reason": ""})).status_code == 422
    resp = await async_client.post(f"/api/admin/org-verifications/{submission_id}/reject", json={"rejection_reason": "Letter is not stamped"})
    assert resp.status_code == 200, resp.text

    act_as(owner)
    mine = (await async_client.get("/api/organizations/me")).json()[0]
    assert mine["verification_status"] == "REJECTED"
    assert mine["rejection_reason"] == "Letter is not stamped"
    # Name can be corrected after a rejection.
    assert (await async_client.patch(f"/api/organizations/{org['id']}", json={"name": "Brikama Alumni Assoc."})).status_code == 200
    resp = await async_client.post(url, data=data, files={"file": PDF})
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_ngo_promo_requires_verified_organization(db_session):
    owner = await _user(db_session, name="Awa Jallow", wave="+2207000401")
    db_session.add(Promotion(slug="ngo-2026", name="NGO onboarding", promo_type=PromoType.NGO_ONBOARDING.value, fee_waiver_pct=100))
    org = Organization(owner_user_id=owner.id, name="Gunjur Health Post", org_type="HEALTH_CENTRE")
    db_session.add(org)
    await db_session.commit()

    self_declared = Campaign(user_id=owner.id, title="Old", slug="old-ngo", description="d", mode=CampaignMode.ONGOING, organiser_type="ngo")
    db_session.add(self_declared)
    await db_session.commit()
    await db_session.refresh(self_declared)
    assert not (await resolve_withdrawal_fee_waiver(db_session, self_declared, owner)).applies

    await db_session.delete(self_declared)
    linked = Campaign(
        user_id=owner.id, title="Linked", slug="linked-ngo", description="d", mode=CampaignMode.ONGOING,
        organiser_type="ngo", beneficiary_type="organization", organization_id=org.id,
    )
    db_session.add(linked)
    await db_session.commit()
    await db_session.refresh(linked)
    assert not (await resolve_withdrawal_fee_waiver(db_session, linked, owner)).applies

    org.verification_status = "APPROVED"
    await db_session.commit()
    await db_session.refresh(linked)
    assert (await resolve_withdrawal_fee_waiver(db_session, linked, owner)).applies
