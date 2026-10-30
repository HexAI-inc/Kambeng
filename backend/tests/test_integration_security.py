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


@pytest.mark.integration
def test_password_reset_revokes_existing_sessions(client, integration_db_session):
    from datetime import timedelta

    from app.api.routes.auth import _password_fingerprint

    _seed_users(integration_db_session)
    login = client.post("/api/auth/login", json={"username": "+2207800002", "password": "AlicePass123!"}).json()
    access, refresh = login["data"]["tokens"]["accessToken"], login["data"]["tokens"]["refreshToken"]
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {access}"}).status_code == 200

    import asyncio
    from sqlalchemy import select

    async def alice():
        session = await integration_db_session()
        user = (await session.execute(select(User).where(User.wave_number == "+2207800002"))).scalars().one()
        await session.close()
        return user

    reset_token = create_access_token(
        {"sub": "+2207800002", "type": "password_reset", "pwd": _password_fingerprint(asyncio.run(alice()))},
        expires_delta=timedelta(minutes=15),
    )
    assert client.post("/api/auth/reset-password", json={"token": reset_token, "new_password": "NewAlice123!"}).status_code == 200

    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {access}"}).status_code == 401
    assert client.post("/api/auth/refresh", json={"refresh_token": refresh}).status_code == 401

    fresh = client.post("/api/auth/login", json={"username": "+2207800002", "password": "NewAlice123!"}).json()
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {fresh['data']['tokens']['accessToken']}"}).status_code == 200


@pytest.mark.integration
def test_suspended_user_cannot_refresh(client, integration_db_session):
    import asyncio
    from sqlalchemy import update

    _seed_users(integration_db_session)
    refresh = client.post("/api/auth/login", json={"username": "+2207800003", "password": "BobPass123!"}).json()["data"]["tokens"]["refreshToken"]

    async def suspend():
        session = await integration_db_session()
        await session.execute(update(User).where(User.wave_number == "+2207800003").values(is_active=False))
        await session.commit()
        await session.close()

    asyncio.run(suspend())
    assert client.post("/api/auth/refresh", json={"refresh_token": refresh}).status_code == 403


def test_rate_limit_trusts_named_client_ip_only_with_the_proxy_secret(monkeypatch):
    from starlette.requests import Request

    from app.core.rate_limit import client_ip

    def request(headers):
        return Request({
            "type": "http", "client": ("76.76.21.21", 443),
            "headers": [(k.encode(), v.encode()) for k, v in headers.items()],
        })

    monkeypatch.setattr(settings, "INTERNAL_PROXY_SECRET", "s3cret")
    named = {"x-kambeng-client-ip": "41.223.1.9"}
    assert client_ip(request({**named, "x-kambeng-proxy-secret": "s3cret"})) == "41.223.1.9"
    assert client_ip(request({**named, "x-kambeng-proxy-secret": "guess"})) == "76.76.21.21"
    assert client_ip(request(named)) == "76.76.21.21"

    # Unconfigured: nobody can name an IP.
    monkeypatch.setattr(settings, "INTERNAL_PROXY_SECRET", "")
    assert client_ip(request({**named, "x-kambeng-proxy-secret": ""})) == "76.76.21.21"
