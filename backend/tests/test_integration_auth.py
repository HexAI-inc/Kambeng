import re

import pytest


@pytest.mark.integration
def test_auth_register_login_me_flow(client):
    register_payload = {
        "full_name": "Integration User",
        "email": "integration-user@example.com",
        "wave_number": "+2207000001",
        "password": "StrongPass123!",
    }

    register_response = client.post("/api/auth/register", json=register_payload)
    assert register_response.status_code == 201

    login_response = client.post(
        "/api/auth/login",
        data={"username": register_payload["wave_number"], "password": register_payload["password"]},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert login_response.status_code == 200
    token = login_response.json()["data"]["tokens"]["accessToken"]

    me_response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_response.status_code == 200
    assert me_response.json()["email"] == register_payload["email"]


@pytest.mark.integration
def test_auth_login_accepts_json_payload(client):
    payload = {
        "full_name": "JSON Login User",
        "email": "json-login-user@example.com",
        "wave_number": "+2207000099",
        "password": "StrongPass123!",
    }

    register_response = client.post("/api/auth/register", json=payload)
    assert register_response.status_code == 201

    login_response = client.post(
        "/api/auth/login",
        json={"username": payload["email"], "password": payload["password"]},
    )
    assert login_response.status_code == 200
    assert login_response.json()["data"]["user"]["email"] == payload["email"]


@pytest.mark.integration
def test_email_verification_flow_uses_sent_code(client, monkeypatch):
    sent = {}

    def fake_send_email(to_email: str, subject: str, html_content: str):
        sent["email"] = to_email
        sent["subject"] = subject
        sent["html"] = html_content
        return True

    from app.api.routes import auth as auth_routes

    monkeypatch.setattr(auth_routes, "send_email", fake_send_email)

    payload = {
        "full_name": "Verify User",
        "email": "verify-user@example.com",
        "wave_number": "+2207000002",
        "password": "StrongPass123!",
    }
    assert client.post("/api/auth/register", json=payload).status_code == 201

    login_response = client.post(
        "/api/auth/login",
        data={"username": payload["wave_number"], "password": payload["password"]},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    token = login_response.json()["data"]["tokens"]["accessToken"]

    request_response = client.post(
        "/api/auth/request-email-verification",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert request_response.status_code == 200

    code_match = re.search(r"(\d{6})", sent.get("html", ""))
    assert code_match is not None
    code = code_match.group(1)

    verify_response = client.post(
        "/api/auth/verify-email",
        json={"code": code},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert verify_response.status_code == 200
