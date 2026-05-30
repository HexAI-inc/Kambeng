import pytest

from app.models.user import User
from app.models.campaign import Campaign, CampaignMode
from app.api.routes.auth import get_current_user


@pytest.mark.asyncio
async def test_report_fraud(async_client, db_session):
    # create user and campaign
    user = User(full_name="Reporter", email="r@example.com", wave_number="+2207000888", password_hash="x")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    campaign = Campaign(user_id=user.id, title="Fraud Test", slug="fraud-test", description="", mode=CampaignMode.ONGOING)
    db_session.add(campaign)
    await db_session.commit()
    await db_session.refresh(campaign)

    from app.main import app as fastapi_app

    async def _get_user_override():
        return user

    fastapi_app.dependency_overrides[get_current_user] = _get_user_override

    resp = await async_client.post("/api/campaigns/fraud-test/report", json={"reason": "Suspicious receipts", "details": "Images look forged"})
    assert resp.status_code == 200, resp.text
    payload = resp.json()
    assert payload["campaign_id"] == campaign.id
    assert payload["reason"] == "Suspicious receipts"

    fastapi_app.dependency_overrides.pop(get_current_user, None)
