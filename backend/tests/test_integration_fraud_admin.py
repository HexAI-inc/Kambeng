import pytest
from app.models.user import User
from app.models.campaign import Campaign, CampaignMode
from app.models.fraud_report import FraudReport
from app.api.routes.auth import get_admin_user
from app.api.routes.auth import get_current_user


@pytest.mark.asyncio
async def test_admin_can_list_and_resolve_reports(async_client, db_session, monkeypatch):
    # Create reporter and admin
    reporter = User(full_name="Reporter", email="r2@example.com", wave_number="+2207000777", password_hash="x")
    admin = User(full_name="Admin", email="admin2@example.com", wave_number="+2207000666", password_hash="x", role="ADMIN")
    db_session.add_all([reporter, admin])
    await db_session.commit()
    await db_session.refresh(reporter)
    await db_session.refresh(admin)

    campaign = Campaign(user_id=reporter.id, title="Fraud Admin Test", slug="fraud-admin-test", description="", mode=CampaignMode.ONGOING)
    db_session.add(campaign)
    await db_session.commit()
    await db_session.refresh(campaign)

    # create a fraud report directly
    report = FraudReport(campaign_id=campaign.id, reported_by_user_id=reporter.id, reason="scam", details="details")
    db_session.add(report)
    await db_session.commit()
    await db_session.refresh(report)

    from app.main import app as fastapi_app

    async def _get_admin_override():
        return admin

    fastapi_app.dependency_overrides[get_admin_user] = _get_admin_override

    # List reports (paginated response)
    resp = await async_client.get("/api/moderation/fraud-reports/queue")
    assert resp.status_code == 200
    payload = resp.json()
    # Support older behavior (list) and new paginated {'items': [], 'total': N}
    if isinstance(payload, dict) and "items" in payload:
        items = payload["items"]
    else:
        items = payload
    assert any(item["id"] == report.id for item in items)

    # Resolve report with suspend action
    resp2 = await async_client.post(f"/api/moderation/fraud-reports/{report.id}/resolve?action=suspend_campaign")
    assert resp2.status_code == 200
    payload = resp2.json()
    assert payload["status"] in ("REVIEWED", "ACTIONED")

    fastapi_app.dependency_overrides.pop(get_admin_user, None)
