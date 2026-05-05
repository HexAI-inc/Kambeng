import io

import pytest


@pytest.mark.integration
def test_campaign_images_limit_count(client, auth_headers, monkeypatch):
    user = {
        "full_name": "Upload User",
        "email": "upload-user@example.com",
        "wave_number": "+2207000006",
        "password": "StrongPass123!",
    }
    assert client.post("/api/auth/register", json=user).status_code == 201
    headers = auth_headers(user["wave_number"], user["password"])

    from app.api.routes import campaigns as campaigns_routes

    monkeypatch.setattr(campaigns_routes, "generate_and_upload_qr", lambda *_args, **_kwargs: "https://example.com/qr.png")

    create = client.post(
        "/api/campaigns/",
        json={
            "title": "Images Campaign",
            "description": "Campaign images test",
            "mode": "TARGET",
            "target_amount": 2000,
        },
        headers=headers,
    )
    slug = create.json()["slug"]

    files = [("files", (f"image{i}.png", io.BytesIO(b"x" * 1024), "image/png")) for i in range(5)]
    first_upload = client.post(f"/api/uploads/campaigns/{slug}/images", files=files, headers=headers)
    assert first_upload.status_code == 201
    assert len(first_upload.json()["uploaded"]) == 5

    extra = [("files", ("extra.png", io.BytesIO(b"x" * 1024), "image/png"))]
    second_upload = client.post(f"/api/uploads/campaigns/{slug}/images", files=extra, headers=headers)
    assert second_upload.status_code == 400
    assert "up to 5 images" in second_upload.json()["detail"]


@pytest.mark.integration
def test_campaign_images_limit_size(client, auth_headers, monkeypatch):
    user = {
        "full_name": "Upload Size User",
        "email": "upload-size-user@example.com",
        "wave_number": "+2207000007",
        "password": "StrongPass123!",
    }
    assert client.post("/api/auth/register", json=user).status_code == 201
    headers = auth_headers(user["wave_number"], user["password"])

    from app.api.routes import campaigns as campaigns_routes

    monkeypatch.setattr(campaigns_routes, "generate_and_upload_qr", lambda *_args, **_kwargs: "https://example.com/qr.png")

    create = client.post(
        "/api/campaigns/",
        json={
            "title": "Large Image Campaign",
            "description": "Campaign image size test",
            "mode": "TARGET",
            "target_amount": 2000,
        },
        headers=headers,
    )
    slug = create.json()["slug"]

    too_large_content = b"x" * (5 * 1024 * 1024 + 1)
    oversized = [("files", ("big.png", io.BytesIO(too_large_content), "image/png"))]

    response = client.post(f"/api/uploads/campaigns/{slug}/images", files=oversized, headers=headers)
    assert response.status_code == 400
    assert "5MB or smaller" in response.json()["detail"]


@pytest.mark.integration
def test_campaign_image_delete_allows_replacement(client, auth_headers, monkeypatch):
    user = {
        "full_name": "Upload Delete User",
        "email": "upload-delete-user@example.com",
        "wave_number": "+2207000008",
        "password": "StrongPass123!",
    }
    assert client.post("/api/auth/register", json=user).status_code == 201
    headers = auth_headers(user["wave_number"], user["password"])

    from app.api.routes import campaigns as campaigns_routes

    monkeypatch.setattr(campaigns_routes, "generate_and_upload_qr", lambda *_args, **_kwargs: "https://example.com/qr.png")

    create = client.post(
        "/api/campaigns/",
        json={
            "title": "Delete Image Campaign",
            "description": "Campaign image delete test",
            "mode": "TARGET",
            "target_amount": 2000,
        },
        headers=headers,
    )
    slug = create.json()["slug"]

    files = [("files", (f"image{i}.png", io.BytesIO(b"x" * 1024), "image/png")) for i in range(5)]
    upload_response = client.post(f"/api/uploads/campaigns/{slug}/images", files=files, headers=headers)
    assert upload_response.status_code == 201
    uploaded = upload_response.json()["uploaded"]
    assert len(uploaded) == 5

    file_to_delete = uploaded[0]["file_name"]
    delete_response = client.delete(f"/api/uploads/campaigns/{slug}/images/{file_to_delete}", headers=headers)
    assert delete_response.status_code == 204

    replacement = [("files", ("replacement.png", io.BytesIO(b"x" * 1024), "image/png"))]
    replacement_response = client.post(f"/api/uploads/campaigns/{slug}/images", files=replacement, headers=headers)
    assert replacement_response.status_code == 201
    assert len(replacement_response.json()["uploaded"]) == 1


@pytest.mark.integration
def test_campaign_proof_requires_owner_or_admin(client, auth_headers, monkeypatch):
    owner = {
        "full_name": "Proof Owner",
        "email": "proof-owner@example.com",
        "wave_number": "+2207000111",
        "password": "StrongPass123!",
    }
    outsider = {
        "full_name": "Proof Outsider",
        "email": "proof-outsider@example.com",
        "wave_number": "+2207000112",
        "password": "StrongPass123!",
    }
    assert client.post("/api/auth/register", json=owner).status_code == 201
    assert client.post("/api/auth/register", json=outsider).status_code == 201
    owner_headers = auth_headers(owner["wave_number"], owner["password"])
    outsider_headers = auth_headers(outsider["wave_number"], outsider["password"])

    from app.api.routes import campaigns as campaigns_routes

    monkeypatch.setattr(campaigns_routes, "generate_and_upload_qr", lambda *_args, **_kwargs: "https://example.com/qr.png")

    create = client.post(
        "/api/campaigns/",
        json={
            "title": "Proof Campaign",
            "description": "Proof upload permission test",
            "mode": "TARGET",
            "target_amount": 300,
        },
        headers=owner_headers,
    )
    slug = create.json()["slug"]

    bad_upload = client.post(
        f"/api/uploads/proofs/{slug}",
        headers=outsider_headers,
        files={"file": ("proof.pdf", io.BytesIO(b"%PDF-1.4\n%%EOF"), "application/pdf")},
    )
    assert bad_upload.status_code == 403

    bad_list = client.get(f"/api/uploads/proofs/{slug}", headers=outsider_headers)
    assert bad_list.status_code == 403


@pytest.mark.integration
def test_campaign_proof_rejects_oversize_file(client, auth_headers, monkeypatch):
    user = {
        "full_name": "Proof Size User",
        "email": "proof-size-user@example.com",
        "wave_number": "+2207000113",
        "password": "StrongPass123!",
    }
    assert client.post("/api/auth/register", json=user).status_code == 201
    headers = auth_headers(user["wave_number"], user["password"])

    from app.api.routes import campaigns as campaigns_routes

    monkeypatch.setattr(campaigns_routes, "generate_and_upload_qr", lambda *_args, **_kwargs: "https://example.com/qr.png")

    create = client.post(
        "/api/campaigns/",
        json={
            "title": "Proof Size Campaign",
            "description": "Proof size limit test",
            "mode": "TARGET",
            "target_amount": 300,
        },
        headers=headers,
    )
    slug = create.json()["slug"]

    big_content = b"%PDF-1.4\n" + (b"x" * (8 * 1024 * 1024 + 1))
    response = client.post(
        f"/api/uploads/proofs/{slug}",
        headers=headers,
        files={"file": ("proof.pdf", io.BytesIO(big_content), "application/pdf")},
    )
    assert response.status_code == 400
    assert "8MB or smaller" in response.json()["detail"]


@pytest.mark.integration
def test_campaign_proof_rejects_mime_signature_mismatch(client, auth_headers, monkeypatch):
    user = {
        "full_name": "Proof Signature User",
        "email": "proof-signature-user@example.com",
        "wave_number": "+2207000114",
        "password": "StrongPass123!",
    }
    assert client.post("/api/auth/register", json=user).status_code == 201
    headers = auth_headers(user["wave_number"], user["password"])

    from app.api.routes import campaigns as campaigns_routes

    monkeypatch.setattr(campaigns_routes, "generate_and_upload_qr", lambda *_args, **_kwargs: "https://example.com/qr.png")

    create = client.post(
        "/api/campaigns/",
        json={
            "title": "Proof Signature Campaign",
            "description": "Proof signature validation test",
            "mode": "TARGET",
            "target_amount": 300,
        },
        headers=headers,
    )
    slug = create.json()["slug"]

    response = client.post(
        f"/api/uploads/proofs/{slug}",
        headers=headers,
        files={"file": ("proof.pdf", io.BytesIO(b"not-a-real-pdf"), "application/pdf")},
    )
    assert response.status_code == 400
    assert "does not match the declared file type" in response.json()["detail"]
