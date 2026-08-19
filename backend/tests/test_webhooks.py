import hashlib
import hmac
import json

import pytest

import app.models.proof  # noqa: F401
from app.api.routes.webhooks import hexai_webhook
from app.api.routes.webhooks import _verify_signature as verify_hexai_signature
from app.models.campaign import Campaign, CampaignMode, CampaignStatus
from app.models.donation import Donation


def test_verify_hexai_signature_accepts_valid_signature():
    payload = b'{"event":"transaction.completed"}'
    secret = "test-webhook-secret"
    signature = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()

    assert verify_hexai_signature(payload, signature) is True


def test_verify_hexai_signature_rejects_invalid_signature():
    payload = b'{"event":"transaction.completed"}'
    assert verify_hexai_signature(payload, "invalid-signature") is False


class _FakeScalars:
    def __init__(self, value):
        self._value = value

    def first(self):
        return self._value

    def all(self):
        return self._value if isinstance(self._value, list) else []


class _FakeResult:
    def __init__(self, value):
        self._value = value

    def scalars(self):
        return _FakeScalars(self._value)


class FakeDB:
    def __init__(self, donation, campaign):
        # donation lookup, ledger lookup (none), campaign lookup, then the
        # promotions engine's donor_fee_free_day and matched_donation
        # lookups (empty — no promotions configured), and (since this test's
        # donation pushes the campaign past its target) the completion
        # rebate's milestone_completion_rebate lookup (also empty).
        self._queue = [donation, None, campaign, [], [], []]
        self.commits = 0

    async def execute(self, _query):
        return _FakeResult(self._queue.pop(0))

    async def commit(self):
        self.commits += 1


class FakeRequest:
    def __init__(self, payload_bytes, signature: str = ""):
        self._payload = payload_bytes
        # Expose headers as a dict-like object; use the primary header name
        self.headers = {"x-hexai-signature": signature}

    async def body(self):
        return self._payload


@pytest.mark.asyncio
async def test_hexai_webhook_marks_donation_success():
    payload_dict = {
        "event": "transaction.completed",
        "transaction": {
            "client_reference": "DON-ABC123",
            "status": "SUCCEEDED",
        },
    }
    payload_bytes = json.dumps(payload_dict).encode("utf-8")
    signature = hmac.new(
        b"test-webhook-secret",
        payload_bytes,
        hashlib.sha256,
    ).hexdigest()

    donation = Donation(client_reference="DON-ABC123", amount=50.0, status="PENDING", campaign_id=1)
    campaign = Campaign(id=1, amount_raised=100.0, mode=CampaignMode.TARGET, target_amount=120.0, status=CampaignStatus.ACTIVE)
    db = FakeDB(donation=donation, campaign=campaign)

    response = await hexai_webhook(
        request=FakeRequest(payload_bytes, signature=signature),
        db=db,
    )

    # HexAI deducts 2% collection fee: net = 50.0 * 0.98 = 49.0
    assert response["status"] == "success"
    assert donation.status == "SUCCEEDED"
    assert campaign.amount_raised == 149.0
    assert campaign.status == CampaignStatus.CLOSED
    assert db.commits == 1
