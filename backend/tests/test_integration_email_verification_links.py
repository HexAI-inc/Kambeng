"""Admins can email unverified users a one-click verification link."""

from urllib.parse import parse_qs, urlparse

import pytest
from sqlalchemy.future import select

from app.api.routes.auth import get_current_user
from app.core.security import create_access_token, get_password_hash
from app.models.user import User
from app.services import email_verification


@pytest.fixture
def outbox(monkeypatch, integration_session_factory):
    sent = []
    # The bulk send runs as a background task with its own session.
    monkeypatch.setattr("app.db.database.AsyncSessionLocal", integration_session_factory)

    def fake_send(to_email, subject, html):
        sent.append({"to": to_email, "subject": subject, "html": html})
        return True

    monkeypatch.setattr("app.services.email_service.send_email", fake_send)
    monkeypatch.setattr(email_verification, "SEND_INTERVAL_SECONDS", 0)
    return sent


async def _admin_headers(async_client, db_session):
    db_session.add(User(full_name="Mail Admin", email="mail-admin@example.com", wave_number="+2207097001",
                        password_hash=get_password_hash("AdminPass123!"), role="ADMIN", is_email_verified=True))
    await db_session.commit()
    login = await async_client.post("/api/auth/login", json={"username": "+2207097001", "password": "AdminPass123!"})
    return {"Authorization": f"Bearer {login.json()['data']['tokens']['accessToken']}"}


async def _users(db_session):
    users = [
        User(full_name="Awa", email="awa@example.com", wave_number="+2207097101", password_hash="x", is_email_verified=False),
        User(full_name="Musa", email="musa@example.com", wave_number="+2207097102", password_hash="x", is_email_verified=False),
        User(full_name="Done", email="done@example.com", wave_number="+2207097103", password_hash="x", is_email_verified=True),
        User(full_name="Gone", email="gone@example.com", wave_number="+2207097104", password_hash="x", is_email_verified=False, is_active=False),
    ]
    db_session.add_all(users)
    await db_session.commit()
    return users


def _token(link_html: str) -> str:
    start = link_html.index("/auth/verify-email/confirm?token=")
    url = link_html[start:link_html.index('"', start)].replace("&amp;", "&")
    return parse_qs(urlparse(url).query)["token"][0]


@pytest.mark.asyncio
async def test_bulk_send_reaches_unverified_active_users_once_a_day(async_client, db_session, outbox):
    headers = await _admin_headers(async_client, db_session)
    await _users(db_session)

    summary = (await async_client.get("/api/admin/users/unverified-email-summary", headers=headers)).json()
    assert summary == {"unverified": 2, "emailed_recently": 0, "will_send": 2}

    resp = await async_client.post("/api/admin/users/send-verification-emails", headers=headers)
    assert resp.json() == {"queued": 2}
    assert sorted(m["to"] for m in outbox) == ["awa@example.com", "musa@example.com"]

    # A second click within 24 hours sends nothing.
    again = await async_client.post("/api/admin/users/send-verification-emails", headers=headers)
    assert again.json() == {"queued": 0}
    assert len(outbox) == 2
    summary = (await async_client.get("/api/admin/users/unverified-email-summary", headers=headers)).json()
    assert summary == {"unverified": 2, "emailed_recently": 2, "will_send": 0}


@pytest.mark.asyncio
async def test_link_verifies_once_and_only_for_its_address(async_client, db_session, outbox):
    headers = await _admin_headers(async_client, db_session)
    awa, musa, done, _ = await _users(db_session)

    assert (await async_client.post(f"/api/admin/users/{done.id}/send-verification-email", headers=headers)).status_code == 409
    resp = await async_client.post(f"/api/admin/users/{awa.id}/send-verification-email", headers=headers)
    assert resp.status_code == 200, resp.text
    token = _token(outbox[-1]["html"])

    # Not a login token.
    assert (await async_client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})).status_code == 401

    first = await async_client.post("/api/auth/verify-email-link", json={"token": token})
    assert first.json()["status"] == "verified"
    await db_session.refresh(awa)
    assert awa.is_email_verified is True
    second = await async_client.post("/api/auth/verify-email-link", json={"token": token})
    assert second.json()["status"] == "already_verified"

    # A link sent before the address changed doesn't verify the new address.
    await async_client.post(f"/api/admin/users/{musa.id}/send-verification-email", headers=headers)
    stale = _token(outbox[-1]["html"])
    musa.email = "musa.new@example.com"
    await db_session.commit()
    assert (await async_client.post("/api/auth/verify-email-link", json={"token": stale})).status_code == 400

    # Other token types and garbage are refused.
    access = create_access_token({"sub": musa.wave_number})
    assert (await async_client.post("/api/auth/verify-email-link", json={"token": access})).status_code == 400
    assert (await async_client.post("/api/auth/verify-email-link", json={"token": "nope"})).status_code == 400


@pytest.mark.asyncio
async def test_verification_email_endpoints_are_admin_only(async_client, db_session):
    awa, *_ = await _users(db_session)
    assert (await async_client.post("/api/admin/users/send-verification-emails")).status_code == 401
    from app.main import app as fastapi_app

    async def _as_awa():
        return awa

    fastapi_app.dependency_overrides[get_current_user] = _as_awa
    try:
        assert (await async_client.post(f"/api/admin/users/{awa.id}/send-verification-email")).status_code == 403
        assert (await async_client.get("/api/admin/users/unverified-email-summary")).status_code == 403
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)
