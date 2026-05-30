import pytest

from app.api.routes.auth import get_admin_user, get_current_user
from app.models.campaign import Campaign, CampaignMode
from app.models.fraud_report_notification_email import FraudReportNotificationEmail
from app.models.user import User


@pytest.mark.asyncio
async def test_admin_crud_notification_emails(async_client, db_session):
    admin = User(full_name="Admin", email="admin@example.com", wave_number="+2207000999", password_hash="x", role="ADMIN")
    db_session.add(admin)
    await db_session.commit()
    await db_session.refresh(admin)

    from app.main import app as fastapi_app

    async def _get_admin_override():
        return admin

    fastapi_app.dependency_overrides[get_admin_user] = _get_admin_override

    create_resp = await async_client.post(
        "/api/admin/fraud-report-notification-emails",
        json={"email": "Security@Example.com", "is_active": True},
    )
    assert create_resp.status_code == 201, create_resp.text
    created = create_resp.json()
    assert created["email"] == "security@example.com"
    assert created["is_active"] is True

    list_resp = await async_client.get("/api/admin/fraud-report-notification-emails")
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1

    detail_resp = await async_client.get(f"/api/admin/fraud-report-notification-emails/{created['id']}")
    assert detail_resp.status_code == 200
    assert detail_resp.json()["email"] == "security@example.com"

    update_resp = await async_client.patch(
        f"/api/admin/fraud-report-notification-emails/{created['id']}",
        json={"is_active": False},
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["is_active"] is False

    delete_resp = await async_client.delete(f"/api/admin/fraud-report-notification-emails/{created['id']}")
    assert delete_resp.status_code == 200

    fastapi_app.dependency_overrides.pop(get_admin_user, None)


@pytest.mark.asyncio
async def test_fraud_report_uses_db_notification_emails(async_client, db_session):
    reporter = User(full_name="Reporter", email="reporter@example.com", wave_number="+2207000888", password_hash="x")
    db_session.add(reporter)
    await db_session.commit()
    await db_session.refresh(reporter)

    campaign = Campaign(user_id=reporter.id, title="Fraud Notify Test", slug="fraud-notify-test", description="", mode=CampaignMode.ONGOING)
    db_session.add(campaign)
    await db_session.commit()
    await db_session.refresh(campaign)

    notification_email = FraudReportNotificationEmail(email="alerts@example.com", is_active=True)
    db_session.add(notification_email)
    await db_session.commit()

    from app.main import app as fastapi_app
    from app.api.routes.campaigns import send_email as original_send_email
    from app.api.routes.auth import get_current_user as current_user_dep

    sent_to: list[str] = []

    async def _get_user_override():
        return reporter

    def _mock_send_email(to_email: str, subject: str, html_content: str) -> bool:
        sent_to.append(to_email)
        return True

    fastapi_app.dependency_overrides[current_user_dep] = _get_user_override

    import app.api.routes.campaigns as campaigns_route
    campaigns_route.send_email = _mock_send_email

    resp = await async_client.post(
        "/api/campaigns/fraud-notify-test/report",
        json={"reason": "Suspicious activity", "details": "Matched uploaded proof"},
    )
    assert resp.status_code == 200, resp.text
    assert sent_to == ["alerts@example.com"]

    campaigns_route.send_email = original_send_email
    fastapi_app.dependency_overrides.pop(current_user_dep, None)
