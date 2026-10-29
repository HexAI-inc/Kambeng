from pathlib import Path
from urllib.parse import urlparse

import pytest

from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token, get_password_hash
from app.models.user import User


def _seed_users(integration_db_session):
    import asyncio

    async def seed():
        session = await integration_db_session()
        admin = User(
            full_name="Sec Admin", email="sec-admin@example.com", wave_number="+2207800001",
            password_hash=get_password_hash("AdminPass123!"), role="ADMIN", is_email_verified=True,
        )
        alice = User(
            full_name="Alice", email="alice@example.com", wave_number="+2207800002",
            password_hash=get_password_hash("AlicePass123!"), is_email_verified=True,
        )
        bob = User(
            full_name="Bob", email="bob@example.com", wave_number="+2207800003",
            password_hash=get_password_hash("BobPass123!"), is_email_verified=True,
        )
        session.add_all([admin, alice, bob])
        await session.commit()
        ids = {"admin": admin.id, "alice": alice.id, "bob": bob.id}
        await session.close()
        return ids

    return asyncio.run(seed())


@pytest.mark.integration
def test_logs_and_monitor_require_admin(client, auth_headers, integration_db_session):
    _seed_users(integration_db_session)
    admin = auth_headers("+2207800001", "AdminPass123!")
    alice = auth_headers("+2207800002", "AlicePass123!")

    for path in ("/api/logs", "/api/monitor"):
        assert client.get(path).status_code == 401
        assert client.get(path, headers=alice).status_code == 403
        assert client.get(path, headers=admin).status_code == 200
    assert client.get("/api/health").status_code == 200


@pytest.mark.integration
def test_refresh_and_reset_tokens_are_not_access_tokens(client, integration_db_session):
    _seed_users(integration_db_session)
    refresh = create_refresh_token({"sub": "+2207800002"})
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {refresh}"}).status_code == 401

    access = create_access_token({"sub": "+2207800002"})
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {access}"}).status_code == 200

    # A session token must not be usable as a password-reset token.
    response = client.post("/api/auth/reset-password", json={"token": access, "new_password": "Hijacked123!"})
    assert response.status_code == 400


@pytest.mark.integration
def test_presign_restricts_private_media(client, auth_headers, integration_db_session):
    ids = _seed_users(integration_db_session)
    admin = auth_headers("+2207800001", "AdminPass123!")
    alice = auth_headers("+2207800002", "AlicePass123!")
    bob = auth_headers("+2207800003", "BobPass123!")

    kyc_url = f"{settings.MEDIA_URL_PREFIX}/kyc/{ids['alice']}/doc.pdf"
    presign = lambda url, headers=None: client.get("/api/media/presign", params={"url": url}, headers=headers or {})

    assert presign(kyc_url).status_code == 401
    assert presign(kyc_url, bob).status_code == 403
    assert presign(f"{settings.MEDIA_URL_PREFIX}/campaigns/../kyc/{ids['alice']}/doc.pdf", bob).status_code == 403
    assert presign(kyc_url, alice).status_code == 200
    assert presign(kyc_url, admin).status_code == 200

    assert presign(f"{settings.MEDIA_URL_PREFIX}/organizations/1/doc.pdf", alice).status_code == 403
    assert presign(f"{settings.MEDIA_URL_PREFIX}/organizations/1/doc.pdf", admin).status_code == 200

    assert presign(f"{settings.MEDIA_URL_PREFIX}/campaigns/1/photo.jpg").status_code == 200


@pytest.mark.integration
def test_local_kyc_files_need_a_signed_link(client, auth_headers, integration_db_session):
    ids = _seed_users(integration_db_session)
    alice = auth_headers("+2207800002", "AlicePass123!")

    kyc_dir = Path(settings.MEDIA_ROOT) / "kyc" / str(ids["alice"])
    kyc_dir.mkdir(parents=True, exist_ok=True)
    (kyc_dir / "doc.pdf").write_bytes(b"%PDF-1.4 test")
    kyc_url = f"{settings.MEDIA_URL_PREFIX}/kyc/{ids['alice']}/doc.pdf"

    assert client.get(kyc_url).status_code == 404
    assert client.get(f"{settings.MEDIA_URL_PREFIX}/campaigns/../kyc/{ids['alice']}/doc.pdf").status_code == 404

    signed = client.get("/api/media/presign", params={"url": kyc_url}, headers=alice).json()["url"]
    parsed = urlparse(signed)
    assert client.get(f"{parsed.path}?{parsed.query}").content == b"%PDF-1.4 test"
    assert client.get(f"{parsed.path}?{parsed.query.replace('sig=', 'sig=0')}").status_code == 404


@pytest.mark.integration
def test_verification_codes_stay_secret_outside_tests(client, monkeypatch):
    from app.api.routes import auth as auth_routes

    monkeypatch.setattr(auth_routes, "send_email", lambda *args, **kwargs: True)
    monkeypatch.setattr(settings, "ENVIRONMENT", "prod")

    payload = {
        "full_name": "Prod User",
        "email": "prod-user@example.com",
        "wave_number": "+2207800010",
        "password": "StrongPass123!",
    }
    register_response = client.post("/api/auth/register", json=payload)
    assert register_response.status_code == 201
    assert "x-verification-code" not in register_response.headers

    # The caller cannot choose the code, and the issued code is not echoed back.
    request_response = client.post(
        "/api/auth/request-email-verification",
        json={"email": payload["email"], "wave_number": payload["wave_number"], "code": "111111"},
    )
    assert request_response.status_code == 200
    assert "x-verification-code" not in request_response.headers

    verify_response = client.post(
        "/api/auth/verify-email",
        json={"email": payload["email"], "wave_number": payload["wave_number"], "code": "111111"},
    )
    assert verify_response.status_code == 400

    # Code-only lookups across all users are a test convenience only.
    assert client.post("/api/auth/verify-email", json={"code": "111111"}).status_code == 400
