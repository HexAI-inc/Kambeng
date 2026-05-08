import asyncio

import pytest

from app.core.security import get_password_hash
from app.models.user import User


@pytest.mark.integration
def test_admin_can_suspend_and_reactivate_user(client, auth_headers, integration_db_session):
    user = {
        "full_name": "Suspend Me",
        "email": "suspend-me@example.com",
        "wave_number": "+2207000110",
        "password": "StrongPass123!",
    }
    assert client.post("/api/auth/register", json=user).status_code == 201

    async def seed_admin():
        session = await integration_db_session()
        admin = User(
            full_name="Admin Manager",
            email="admin-manager@example.com",
            wave_number="+2207999997",
            password_hash=get_password_hash("AdminPass123!"),
            role="ADMIN",
            is_email_verified=True,
        )
        session.add(admin)
        await session.commit()
        await session.close()

    asyncio.run(seed_admin())
    admin_headers = auth_headers("+2207999997", "AdminPass123!")

    overview_response = client.get("/api/admin/users/overview", headers=admin_headers)
    assert overview_response.status_code == 200
    overview = overview_response.json()
    target_user = next(item for item in overview if item["email"] == user["email"])

    suspend_response = client.patch(
        f"/api/admin/users/{target_user['id']}/status",
        params={"status": "SUSPENDED"},
        headers=admin_headers,
    )
    assert suspend_response.status_code == 200
    assert suspend_response.json()["is_active"] is False

    login_response = client.post(
        "/api/auth/login",
        data={"username": user["wave_number"], "password": user["password"]},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert login_response.status_code == 403
    assert login_response.json()["detail"] == "Account is suspended"

    reactivate_response = client.patch(
        f"/api/admin/users/{target_user['id']}/status",
        params={"status": "ACTIVE"},
        headers=admin_headers,
    )
    assert reactivate_response.status_code == 200
    assert reactivate_response.json()["is_active"] is True

    login_response = client.post(
        "/api/auth/login",
        data={"username": user["wave_number"], "password": user["password"]},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert login_response.status_code == 200


@pytest.mark.integration
def test_admin_users_overview_includes_account_state(client, auth_headers, integration_db_session):
    user = {
        "full_name": "Overview User",
        "email": "overview-user@example.com",
        "wave_number": "+2207000111",
        "password": "StrongPass123!",
    }
    assert client.post("/api/auth/register", json=user).status_code == 201

    async def seed_admin():
        session = await integration_db_session()
        admin = User(
            full_name="Admin Overview",
            email="admin-overview@example.com",
            wave_number="+2207999996",
            password_hash=get_password_hash("AdminPass123!"),
            role="ADMIN",
            is_email_verified=True,
        )
        session.add(admin)
        await session.commit()
        await session.close()

    asyncio.run(seed_admin())
    admin_headers = auth_headers("+2207999996", "AdminPass123!")

    response = client.get("/api/admin/users/overview", headers=admin_headers)
    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 2
    assert all("is_active" in item for item in payload)