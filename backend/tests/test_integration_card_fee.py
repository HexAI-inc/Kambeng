"""Card donations settle at 6%, and money enters the system in whole dalasi.

Waychit takes 6% on card payments where Wave takes 2%. Recording every
collection at 2% credited the campaign 4% of each card donation that never
landed in the HexAI wallet.
"""

import pytest
from sqlalchemy.future import select

from app.models.campaign import Campaign, CampaignMode
from app.models.donation import Donation
from app.models.ledger import TransactionLedger, TransactionStatus, TransactionType
from app.models.user import User
from app.services.payment_reconciliation import reconcile_donation_status


async def _seed(db_session, *, provider: str, amount: float, reference: str):
    user = User(
        full_name="Card Donor Owner",
        email=f"{reference.lower()}@example.com",
        wave_number=f"+2207{reference[-6:]}",
        password_hash="x",
        kyc_status="APPROVED",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    campaign = Campaign(
        user_id=user.id,
        title="Card Fee Test",
        slug=f"card-fee-{reference.lower()}",
        description="",
        mode=CampaignMode.ONGOING,
        amount_raised=0.0,
    )
    db_session.add(campaign)
    await db_session.commit()
    await db_session.refresh(campaign)

    donation = Donation(
        campaign_id=campaign.id,
        client_reference=reference,
        amount=amount,
        status="PENDING",
        provider=provider,
    )
    ledger = TransactionLedger(
        campaign_id=campaign.id,
        transaction_type=TransactionType.DONATION,
        status=TransactionStatus.PENDING,
        gross_amount=amount,
        hexai_fee=0.0,
        platform_commission=0.0,
        net_amount=amount,
        external_reference=reference,
        description="Donation initiated",
    )
    db_session.add_all([donation, ledger])
    await db_session.commit()
    return campaign


@pytest.mark.asyncio
async def test_card_donation_records_six_percent(db_session):
    campaign = await _seed(db_session, provider="waychit_card", amount=1000.0, reference="DON-CARD-1")

    await reconcile_donation_status(
        db_session, client_reference="DON-CARD-1", target_status="SUCCEEDED", source="WEBHOOK",
    )

    ledger = (
        await db_session.execute(
            select(TransactionLedger).where(TransactionLedger.external_reference == "DON-CARD-1")
        )
    ).scalars().first()
    assert ledger.hexai_fee == 60.0, "Waychit takes 6% on card, not 2%"
    assert ledger.net_amount == 940.0

    await db_session.refresh(campaign)
    assert campaign.amount_raised == 940.0


@pytest.mark.asyncio
async def test_wave_donation_still_records_two_percent(db_session):
    campaign = await _seed(db_session, provider="wave", amount=1000.0, reference="DON-WAVE-1")

    await reconcile_donation_status(
        db_session, client_reference="DON-WAVE-1", target_status="SUCCEEDED", source="WEBHOOK",
    )

    ledger = (
        await db_session.execute(
            select(TransactionLedger).where(TransactionLedger.external_reference == "DON-WAVE-1")
        )
    ).scalars().first()
    assert ledger.hexai_fee == 20.0
    assert ledger.net_amount == 980.0

    await db_session.refresh(campaign)
    assert campaign.amount_raised == 980.0


@pytest.mark.asyncio
async def test_fee_and_credit_stay_whole_dalasi(db_session):
    """6% of 25 is 1.50: the fee rounds down to 1, so the campaign keeps 24 and
    the platform absorbs the half-dalasi Waychit really took."""
    campaign = await _seed(db_session, provider="waychit_card", amount=25.0, reference="DON-CARD-2")

    await reconcile_donation_status(
        db_session, client_reference="DON-CARD-2", target_status="SUCCEEDED", source="WEBHOOK",
    )

    ledger = (
        await db_session.execute(
            select(TransactionLedger).where(TransactionLedger.external_reference == "DON-CARD-2")
        )
    ).scalars().first()
    assert ledger.hexai_fee == 1.0
    assert ledger.net_amount == 24.0

    await db_session.refresh(campaign)
    assert campaign.amount_raised == 24.0


@pytest.mark.asyncio
async def test_fractional_donation_amount_is_rejected(async_client, db_session):
    """Money enters the system in whole dalasi — the API says so plainly."""
    user = User(
        full_name="Fraction Donor",
        email="fraction@example.com",
        wave_number="+2207000123",
        password_hash="x",
        kyc_status="APPROVED",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    campaign = Campaign(
        user_id=user.id, title="Fraction", slug="fraction", description="",
        mode=CampaignMode.ONGOING, amount_raised=0.0,
    )
    db_session.add(campaign)
    await db_session.commit()
    await db_session.refresh(campaign)

    resp = await async_client.post(
        "/api/payments/donate",
        json={"campaign_id": campaign.id, "amount": 134.06, "donor_name": "Fraction"},
    )
    assert resp.status_code == 422, resp.text
    assert "whole number of dalasi" in resp.text


@pytest.mark.asyncio
async def test_donation_below_the_minimum_is_rejected(async_client, db_session, monkeypatch):
    """Below D10 the rail's cut and the per-transaction overhead swallow the
    gift, so the API declines it instead of banking it."""
    user = User(
        full_name="Small Donor",
        email="small@example.com",
        wave_number="+2207000124",
        password_hash="x",
        kyc_status="APPROVED",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    campaign = Campaign(
        user_id=user.id, title="Small", slug="small", description="",
        mode=CampaignMode.ONGOING, amount_raised=0.0,
    )
    db_session.add(campaign)
    await db_session.commit()
    await db_session.refresh(campaign)

    resp = await async_client.post(
        "/api/payments/donate",
        json={"campaign_id": campaign.id, "amount": 9, "donor_name": "Small"},
    )
    assert resp.status_code == 422, resp.text
    assert "smallest donation" in resp.text

    # D10 exactly is fine — the boundary is inclusive.
    import app.api.routes.payments as payments_router

    async def fake_initiate_donation(**kwargs):
        return {"data": {"transaction_id": "FAKE-TX", "redirect_url": "https://example.test/pay"}}

    monkeypatch.setattr(payments_router.hexai_service, "initiate_donation", fake_initiate_donation)

    ok = await async_client.post(
        "/api/payments/donate",
        json={"campaign_id": campaign.id, "amount": 10, "donor_name": "Small"},
    )
    assert ok.status_code == 200, ok.text
