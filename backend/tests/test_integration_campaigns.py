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


@pytest.mark.integration
def test_campaign_category_and_tags_filtering(client, auth_headers, monkeypatch):
    user = {
        "full_name": "Tagging User",
        "email": "tagging-user@example.com",
        "wave_number": "+2207000013",
        "password": "StrongPass123!",
    }
    assert client.post("/api/auth/register", json=user).status_code == 201
    headers = auth_headers(user["wave_number"], user["password"])

    from app.api.routes import campaigns as campaigns_routes

    monkeypatch.setattr(campaigns_routes, "generate_and_upload_qr", lambda *_args, **_kwargs: "https://example.com/qr.png")

    def create(title, category, tags):
        response = client.post(
            "/api/campaigns/",
            json={"title": title, "description": "Tagged campaign", "mode": "ONGOING", "category": category, "tags": tags},
            headers=headers,
        )
        assert response.status_code == 201, response.text
        return response.json()

    school = create("Brikama School Roof", "Education", ["#Brikama", "Kids", "kids"])
    assert school["category"] == "education"
    assert school["tags"] == ["brikama", "kids"]
    clinic = create("Brikama Clinic", "health", ["brikama"])

    bad = client.post(
        "/api/campaigns/",
        json={"title": "Bad", "description": "Bad category", "mode": "ONGOING", "category": "crypto"},
        headers=headers,
    )
    assert bad.status_code == 422

    by_category = client.get("/api/campaigns/", params={"category": "education"}).json()
    assert [c["slug"] for c in by_category] == [school["slug"]]

    by_tag = {c["slug"] for c in client.get("/api/campaigns/", params={"tag": "Brikama"}).json()}
    assert by_tag == {school["slug"], clinic["slug"]}

    cards = client.get("/api/utils/frontend/v1/campaign-cards", params={"category": "health"}).json()
    assert [c["slug"] for c in cards] == [clinic["slug"]]
    assert cards[0]["tags"] == ["brikama"]

    tags = client.get("/api/campaigns/tags").json()
    assert tags[0] == {"tag": "brikama", "count": 2}

    # A PUT that omits classification leaves it alone.
    put = client.put(
        f"/api/campaigns/{school['slug']}",
        json={"title": "Brikama School Roof", "description": "Edited", "mode": "ONGOING"},
        headers=headers,
    )
    assert put.status_code == 200
    assert put.json()["category"] == "education"
    assert put.json()["tags"] == ["brikama", "kids"]

    patch = client.patch(
        f"/api/campaigns/{school['slug']}/classification",
        json={"category": "community", "tags": ["kids", "roofing"]},
        headers=headers,
    )
    assert patch.status_code == 200, patch.text
    assert patch.json()["category"] == "community"
    assert patch.json()["tags"] == ["kids", "roofing"]
    assert client.get(f"/api/campaigns/{school['slug']}").json()["tags"] == ["kids", "roofing"]

    too_many = client.patch(
        f"/api/campaigns/{school['slug']}/classification",
        json={"tags": [f"tag{i}" for i in range(9)]},
        headers=headers,
    )
    assert too_many.status_code == 422
