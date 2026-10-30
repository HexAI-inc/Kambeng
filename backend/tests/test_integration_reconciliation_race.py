"""A donation confirmed by two paths at once is credited once.

The payment-success page polls /donations/{ref}/status, which loads the
donation while it is PENDING and then waits on HexAI. If the webhook confirms
the donation in that window, the poll's reconciliation must see the committed
SUCCEEDED status rather than the copy already loaded in its session.
"""

import pytest
from sqlalchemy.future import select

from app.models.campaign import Campaign, CampaignMode
from app.models.donation import Donation
from app.models.ledger import TransactionLedger, TransactionStatus, TransactionType
from app.models.user import User
from app.services.payment_reconciliation import reconcile_donation_status


async def _seed(session, reference: str) -> int:
    user = User(
        full_name="Race Owner",
        email="race-owner@example.com",
        wave_number="+2207900001",
        password_hash="x",
        kyc_status="APPROVED",
    )
    session.add(user)
    await session.commit()

    campaign = Campaign(
        user_id=user.id,
        title="Race Test",
        slug="race-test",
        description="",
        mode=CampaignMode.ONGOING,
        amount_raised=0.0,
    )
    session.add(campaign)
    await session.commit()

    session.add_all([
        Donation(campaign_id=campaign.id, client_reference=reference, amount=20.0, status="PENDING", provider="wave"),
        TransactionLedger(
            campaign_id=campaign.id,
            transaction_type=TransactionType.DONATION,
            status=TransactionStatus.PENDING,
            gross_amount=20.0,
            hexai_fee=0.0,
            platform_commission=0.0,
            net_amount=20.0,
            external_reference=reference,
            description="Donation initiated",
        ),
    ])
    await session.commit()
    return campaign.id


@pytest.mark.asyncio
async def test_poll_after_webhook_does_not_credit_twice(integration_session_factory):
    reference = "DON-RACE-1"
    async with integration_session_factory() as seed_session:
        campaign_id = await _seed(seed_session, reference)

    async with integration_session_factory() as poll_session, integration_session_factory() as webhook_session:
        # The status poll loads the donation while it is still PENDING...
        stale = (
            await poll_session.execute(select(Donation).where(Donation.client_reference == reference))
        ).scalars().first()
        assert stale.status == "PENDING"
        await poll_session.commit()

        # ...the webhook confirms it meanwhile...
        await reconcile_donation_status(
            webhook_session, client_reference=reference, target_status="SUCCEEDED", source="WEBHOOK",
        )

        # ...and then the poll reconciles with the stale copy still in its session.
        result = await reconcile_donation_status(
            poll_session, client_reference=reference, target_status="SUCCEEDED", source="WEBHOOK",
            reason="hexai_poll_confirmed",
        )
        assert result["idempotent"] is True

    async with integration_session_factory() as check_session:
        campaign = await check_session.get(Campaign, campaign_id)
        assert campaign.amount_raised == 20.0
