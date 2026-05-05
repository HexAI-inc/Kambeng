import pytest


@pytest.mark.integration
def test_campaign_create_list_and_update(client, auth_headers, monkeypatch):
    user = {
        "full_name": "Campaign User",
        "email": "campaign-user@example.com",
        "wave_number": "+2207000003",
        "password": "StrongPass123!",
    }
    assert client.post("/api/auth/register", json=user).status_code == 201
    headers = auth_headers(user["wave_number"], user["password"])

    from app.api.routes import campaigns as campaigns_routes

    monkeypatch.setattr(campaigns_routes, "generate_and_upload_qr", lambda *_args, **_kwargs: "https://example.com/qr.png")

    create_payload = {
        "title": "Integration Campaign",
        "description": "Campaign created in integration test",
        "mode": "TARGET",
        "target_amount": 5000,
    }
    create_response = client.post("/api/campaigns/", json=create_payload, headers=headers)
    assert create_response.status_code == 201
    slug = create_response.json()["slug"]

    list_response = client.get("/api/campaigns/")
    assert list_response.status_code == 200
    assert any(item["slug"] == slug for item in list_response.json())

    update_response = client.put(
        f"/api/campaigns/{slug}",
        json={
            "title": "Updated Campaign",
            "description": "Updated details",
            "mode": "TARGET",
            "target_amount": 7000,
        },
        headers=headers,
    )
    assert update_response.status_code == 200
    assert update_response.json()["title"] == "Updated Campaign"
