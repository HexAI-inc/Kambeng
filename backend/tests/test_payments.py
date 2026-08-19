import pytest

import app.models.proof  # noqa: F401
from app.api.routes.payments import initiate_donation
from app.models.campaign import Campaign, CampaignStatus
from app.schemas.donation import DonationCreate


class _FakeScalars:
    def __init__(self, value):
        self._value = value

    def first(self):
        return self._value


class _FakeResult:
    def __init__(self, value):
        self._value = value

    def scalars(self):
        return _FakeScalars(self._value)


class FakeDB:
    def __init__(self, campaign):
        self.campaign = campaign
        self.added = []

    async def execute(self, _query):
        return _FakeResult(self.campaign)

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        return None


@pytest.mark.asyncio
async def test_initiate_donation_success(monkeypatch):
    campaign = Campaign(id=1, status=CampaignStatus.ACTIVE)
    db = FakeDB(campaign)

    async def fake_initiate_donation(amount, client_reference, customer_name, success_url, error_url, provider=None, customer_mobile=None, customer_email=None):
        assert amount == 100.0
        assert client_reference.startswith("DON-")
        assert customer_name == "Alice"
        assert "success" in success_url
        assert "failed" in error_url
        assert provider is None  # "wave" (the default) is omitted, not sent as a literal value
        return {"data": {"redirect_url": "https://pay.example/redirect"}}

    from app.api.routes import payments

    monkeypatch.setattr(payments.hexai_service, "initiate_donation", fake_initiate_donation)

    payload = DonationCreate(campaign_id=1, amount=100.0, donor_name="Alice", message="Good luck")
    result = await initiate_donation(payload, db=db, current_user=None)

    assert result["redirect_url"] == "https://pay.example/redirect"
    assert result["client_reference"].startswith("DON-")
    assert len(db.added) == 2


@pytest.mark.asyncio
async def test_initiate_donation_waychit_card_forwards_provider(monkeypatch):
    campaign = Campaign(id=1, status=CampaignStatus.ACTIVE)
    db = FakeDB(campaign)

    async def fake_initiate_donation(amount, client_reference, customer_name, success_url, error_url, provider=None, customer_mobile=None, customer_email=None):
        assert provider == "WAYCHIT_CARD"
        assert customer_email == "alice@example.com"
        return {"data": {"redirect_url": "https://pay.example/card-redirect"}}

    from app.api.routes import payments

    monkeypatch.setattr(payments.hexai_service, "initiate_donation", fake_initiate_donation)

    payload = DonationCreate(campaign_id=1, amount=100.0, donor_name="Alice", provider="waychit_card", customer_email="alice@example.com")
    result = await initiate_donation(payload, db=db, current_user=None)

    assert result["redirect_url"] == "https://pay.example/card-redirect"


def test_donation_create_rejects_aps_without_mobile_or_email():
    """APS requires both a mobile number (for the OTP) and an email (the
    gateway's authorize-customer step) — reject early rather than letting
    an incomplete request reach the gateway."""
    with pytest.raises(Exception):
        DonationCreate(campaign_id=1, amount=100.0, provider="aps")
    with pytest.raises(Exception):
        DonationCreate(campaign_id=1, amount=100.0, provider="aps", customer_mobile="+2207123456")


def test_donation_create_rejects_waychit_card_without_email():
    with pytest.raises(Exception):
        DonationCreate(campaign_id=1, amount=100.0, provider="waychit_card")
