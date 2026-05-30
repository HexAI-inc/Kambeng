import pytest

from app.api.routes.auth import get_current_user
from app.models.campaign import Campaign, CampaignMode
from app.models.user import User


@pytest.mark.asyncio
async def test_regenerate_campaign_qr_codes(async_client, db_session):
    user = User(full_name="QR Owner", email="qr@example.com", wave_number="+2207000111", password_hash="x")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    campaign = Campaign(
        user_id=user.id,
        title="QR Regen",
        slug="qr-regen",
        description="Testing QR regeneration",
        mode=CampaignMode.ONGOING,
        qr_code_page_url="data:image/png;base64,old-page",
        qr_code_direct_url="data:image/png;base64,old-direct",
    )
    db_session.add(campaign)
    await db_session.commit()
    await db_session.refresh(campaign)

    from app.main import app as fastapi_app

    async def _get_user_override():
        return user

    fastapi_app.dependency_overrides[get_current_user] = _get_user_override

    response = await async_client.post("/api/utils/qrcode/campaign/qr-regen/regenerate")
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["slug"] == campaign.slug
    assert payload["qr_code_page_url"].startswith("data:image/png;base64,")
    assert payload["qr_code_direct_url"].startswith("data:image/png;base64,")
    assert payload["qr_code_page_url"] != "data:image/png;base64,old-page"
    assert payload["qr_code_direct_url"] != "data:image/png;base64,old-direct"

    await db_session.refresh(campaign)
    refreshed = await db_session.get(Campaign, campaign.id)
    assert refreshed is not None
    assert refreshed.qr_code_page_url == payload["qr_code_page_url"]
    assert refreshed.qr_code_direct_url == payload["qr_code_direct_url"]

    fastapi_app.dependency_overrides.pop(get_current_user, None)
