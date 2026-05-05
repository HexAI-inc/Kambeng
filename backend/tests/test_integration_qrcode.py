"""Integration tests for QR code generation endpoints."""
import base64
import pytest
from httpx import AsyncClient as TestClient


@pytest.mark.asyncio
async def test_campaign_qr_code_endpoint(client: TestClient, db_session, sample_campaign):
    """Test generating QR code for a campaign."""
    # Campaign created via fixture - use its slug
    response = await client.get(
        f"/api/utils/qrcode/campaign/{sample_campaign.slug}",
    )
    
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    # QR code should be PNG binary data
    assert response.content.startswith(b"\x89PNG")


@pytest.mark.asyncio
async def test_campaign_qr_code_base64_endpoint(client: TestClient, db_session, sample_campaign):
    """Test generating QR code for a campaign as base64."""
    response = await client.get(
        f"/api/utils/qrcode/campaign/{sample_campaign.slug}/base64",
    )
    
    assert response.status_code == 200
    data = response.json()
    
    assert "campaign_slug" in data
    assert data["campaign_slug"] == sample_campaign.slug
    assert "qr_code_base64" in data
    assert data["qr_code_base64"].startswith("data:image/png;base64,")
    assert "qr_code_url" in data
    
    # Verify base64 is valid
    b64_part = data["qr_code_base64"].split(",")[1]
    png_bytes = base64.b64decode(b64_part)
    assert png_bytes.startswith(b"\x89PNG")


@pytest.mark.asyncio
async def test_donation_qr_code_endpoint(client: TestClient, db_session, sample_campaign):
    """Test generating QR code for a donation page."""
    response = await client.get(
        f"/api/utils/qrcode/donation/{sample_campaign.slug}",
    )
    
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert response.content.startswith(b"\x89PNG")


@pytest.mark.asyncio
async def test_short_code_qr_endpoint(client: TestClient, db_session, sample_campaign_with_alias):
    """Test generating QR code for a campaign short code."""
    campaign, alias = sample_campaign_with_alias
    
    response = await client.get(
        f"/api/utils/qrcode/short/{alias.short_code}",
    )
    
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert response.content.startswith(b"\x89PNG")


@pytest.mark.asyncio
async def test_qr_code_not_found(client: TestClient, db_session):
    """Test QR code generation with non-existent campaign."""
    response = await client.get("/api/utils/qrcode/campaign/nonexistent-slug")
    
    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()


@pytest.mark.asyncio
async def test_short_code_qr_not_found(client: TestClient, db_session):
    """Test QR code generation with non-existent short code."""
    response = await client.get("/api/utils/qrcode/short/nonexistent")
    
    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
