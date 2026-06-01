import os
import sys
import shutil
from pathlib import Path

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("HEXAI_WEBHOOK_SECRET", "test-webhook-secret")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./kambeng_test.db")
os.environ.setdefault("MEDIA_ROOT", "media_test")
os.environ.setdefault("STORAGE_STRATEGY", "local")

from app.db.database import Base, get_db  # noqa: E402
from app.main import app as fastapi_app  # noqa: E402
from app import models as _models  # noqa: F401,E402


@pytest.fixture(scope="session")
def integration_engine():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    return engine


@pytest.fixture(scope="session", autouse=True)
def cleanup_integration_engine(request, integration_engine):
    def _finalizer():
        import asyncio

        asyncio.run(integration_engine.dispose())

    request.addfinalizer(_finalizer)


@pytest.fixture(scope="session")
def integration_session_factory(integration_engine):
    return async_sessionmaker(integration_engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture(autouse=True)
async def setup_integration_db(integration_engine):
    async with integration_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with integration_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture(autouse=True)
def cleanup_media_root():
    media_root = Path(os.environ.get("MEDIA_ROOT", "media_test"))
    if media_root.exists():
        shutil.rmtree(media_root)
    yield
    if media_root.exists():
        shutil.rmtree(media_root)


@pytest.fixture
def client(integration_session_factory):
    async def _override_get_db():
        async with integration_session_factory() as session:
            yield session

    fastapi_app.dependency_overrides[get_db] = _override_get_db
    with TestClient(fastapi_app) as test_client:
        yield test_client
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
def integration_db_session(integration_session_factory):
    async def _get_session():
        async with integration_session_factory() as session:
            return session

    return _get_session


@pytest.fixture
def auth_headers(client):
    def _auth_headers(wave_number: str, password: str):
        response = client.post(
            "/api/auth/login",
            data={"username": wave_number, "password": password},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        assert response.status_code == 200
        payload = response.json()
        token = payload.get("access_token") or payload.get("data", {}).get("tokens", {}).get("accessToken")
        assert token, f"No access token found in login response: {payload}"
        return {"Authorization": f"Bearer {token}"}

    return _auth_headers


@pytest_asyncio.fixture
async def db_session(integration_session_factory):
    async with integration_session_factory() as session:
        yield session


@pytest_asyncio.fixture
async def async_client(integration_session_factory):
    async def _override_get_db():
        async with integration_session_factory() as session:
            yield session

    fastapi_app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    fastapi_app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def sample_campaign(db_session):
    from app.models.user import User
    from app.models.campaign import Campaign, CampaignMode

    user = User(
        full_name="Sample User",
        email="sampleuser@example.com",
        wave_number="+2207099001",
        password_hash="x",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    campaign = Campaign(
        user_id=user.id,
        title="Sample Campaign",
        slug="sample-campaign",
        description="A test campaign",
        mode=CampaignMode.ONGOING,
    )
    db_session.add(campaign)
    await db_session.commit()
    await db_session.refresh(campaign)

    return campaign


@pytest_asyncio.fixture
async def sample_campaign_with_alias(sample_campaign, db_session):
    from app.models.alias import CampaignAlias

    alias = CampaignAlias(campaign_id=sample_campaign.id, short_code="testcode")
    db_session.add(alias)
    await db_session.commit()
    await db_session.refresh(alias)

    return sample_campaign, alias
