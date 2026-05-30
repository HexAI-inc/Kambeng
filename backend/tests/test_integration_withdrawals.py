import pytest

from app.models.user import User
from app.models.campaign import Campaign, CampaignMode
from app.api.routes.auth import get_current_user
import app.api.routes.campaigns as campaigns_router


@pytest.mark.asyncio
async def test_request_withdrawal_and_list(async_client, db_session, monkeypatch):
    # create user and campaign
    user = User(full_name="Withdraw User", email="w@example.com", wave_number="+2207000999", password_hash="x")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    campaign = Campaign(user_id=user.id, title="Withdraw Test", slug="withdraw-test", description="", mode=CampaignMode.ONGOING, amount_raised=200.0)
    db_session.add(campaign)
    await db_session.commit()
    await db_session.refresh(campaign)

    # override get_current_user dependency to return our user
    from app.main import app as fastapi_app

    async def _get_user_override():
        return user

    fastapi_app.dependency_overrides[get_current_user] = _get_user_override

    # mock HexAI payout initiation
    async def fake_initiate_payout(requested_amount, recipient_mobile, payout_reference, recipient_name):
        return ({"data": {"tx_id": "FAKE-TX"}}, round(requested_amount - 0.02 * requested_amount, 2))

    monkeypatch.setattr(campaigns_router.hexai_service, "initiate_payout", fake_initiate_payout)

    # Request a withdrawal
    resp = await async_client.post("/api/campaigns/withdraw-test/withdraw", json={"amount": 50.0})
    assert resp.status_code == 200, resp.text
    payload = resp.json()
    assert payload["gross_amount"] == 50.0
    assert payload["status"] == "PENDING"

    # List withdrawals
    resp2 = await async_client.get("/api/campaigns/withdraw-test/withdrawals")
    assert resp2.status_code == 200
    items = resp2.json()
    assert isinstance(items, list)
    assert len(items) >= 1

    # cleanup override
    fastapi_app.dependency_overrides.pop(get_current_user, None)
