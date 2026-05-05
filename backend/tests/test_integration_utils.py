import io

import pytest


@pytest.mark.integration
def test_frontend_v1_campaign_cards_includes_cover_image_url(client, auth_headers, monkeypatch):
    user = {
        "full_name": "Utils Card User",
        "email": "utils-card-user@example.com",
        "wave_number": "+2207000121",
        "password": "StrongPass123!",
    }
    assert client.post("/api/auth/register", json=user).status_code == 201
    headers = auth_headers(user["wave_number"], user["password"])

    from app.api.routes import campaigns as campaigns_routes

    monkeypatch.setattr(campaigns_routes, "generate_and_upload_qr", lambda *_args, **_kwargs: "https://example.com/qr.png")

    create = client.post(
        "/api/campaigns/",
        json={
            "title": "Utils Card Campaign",
            "description": "Campaign card endpoint test",
            "mode": "TARGET",
            "target_amount": 900,
        },
        headers=headers,
    )
    assert create.status_code == 201
    payload = create.json()
    slug = payload["slug"]
    campaign_id = payload["id"]

    upload = client.post(
        f"/api/uploads/campaigns/{slug}/images",
        headers=headers,
        files=[("files", ("cover.png", io.BytesIO(b"x" * 1024), "image/png"))],
    )
    assert upload.status_code == 201

    cards_response = client.get("/api/utils/frontend/v1/campaign-cards")
    assert cards_response.status_code == 200
    cards = cards_response.json()
    assert isinstance(cards, list)

    row = next((item for item in cards if item.get("id") == campaign_id), None)
    assert row is not None
    assert "cover_image_url" in row
    assert row["cover_image_url"] is not None
    assert row["cover_image_url"].startswith("http://127.0.0.1:8001/")
    assert f"/uploads/campaigns/{campaign_id}/" in row["cover_image_url"]
