import asyncio
from datetime import UTC, datetime, timedelta

import pytest

from app.core.security import get_password_hash
from app.models.campaign import Campaign, CampaignMode, CampaignStatus
from app.models.donation import Donation
from app.models.payout import Payout
from app.models.user import User


def _months_ago(n: int) -> datetime:
    """A timestamp mid-month, ``n`` months before the current one."""
    now = datetime.now(UTC)
    index = now.year * 12 + (now.month - 1) - n
    return datetime(index // 12, index % 12 + 1, 15, 12, tzinfo=UTC)


@pytest.mark.integration
def test_growth_metrics_report(client, auth_headers, integration_db_session):
    async def seed():
        session = await integration_db_session()
        admin = User(
            full_name="Growth Admin", email="growth-admin@example.com", wave_number="+2207999950",
            password_hash=get_password_hash("AdminPass123!"), role="ADMIN", is_email_verified=True,
        )
        organizer = User(
            full_name="Organizer", email="org@example.com", wave_number="+2207000950",
            password_hash="x", is_email_verified=True, kyc_status="APPROVED",
            kyc_verified_at=_months_ago(2), created_at=_months_ago(2),
        )
        donor = User(
            full_name="Donor", email="donor@example.com", wave_number="+2207000951",
            password_hash="x", created_at=_months_ago(1),
        )
        session.add_all([admin, organizer, donor])
        await session.flush()

        campaign = Campaign(
            user_id=organizer.id, title="School roof", slug="school-roof", description="d",
            mode=CampaignMode.TARGET, target_amount=1000, amount_raised=1470,
            status=CampaignStatus.ACTIVE, category="education", created_at=_months_ago(2),
        )
        session.add(campaign)
        await session.flush()

        session.add_all([
            # Donor gives in two consecutive months → retained in their cohort.
            Donation(campaign_id=campaign.id, user_id=donor.id, client_reference="DON-G1", amount=500,
                     status="SUCCEEDED", provider="wave", created_at=_months_ago(2)),
            Donation(campaign_id=campaign.id, user_id=donor.id, client_reference="DON-G2", amount=1000,
                     status="SUCCEEDED", provider="card", created_at=_months_ago(1)),
            Donation(campaign_id=campaign.id, donor_email="Guest@Example.com", client_reference="DON-G3",
                     amount=100, status="SUCCEEDED", created_at=_months_ago(1)),
            Donation(campaign_id=campaign.id, client_reference="DON-G4", amount=50,
                     status="FAILED", created_at=_months_ago(1)),
            Payout(campaign_id=campaign.id, client_reference="PAYOUT-G1", gross_amount=500,
                   hexai_fee=10, platform_commission=10, net_amount=480, status="SUCCEEDED",
                   created_at=_months_ago(1)),
            # Admin commission withdrawal: not revenue.
            Payout(campaign_id=None, client_reference="ADMIN-COMM-G1", gross_amount=10,
                   platform_commission=10, net_amount=8, status="SUCCEEDED", created_at=_months_ago(1)),
        ])
        await session.commit()
        await session.close()

    asyncio.run(seed())
    headers = auth_headers("+2207999950", "AdminPass123!")

    response = client.get("/api/admin/growth", params={"months": 6}, headers=headers)
    assert response.status_code == 200
    data = response.json()

    h = data["headline"]
    assert h["gmv_total"] == 1600
    assert h["revenue_total"] == 10
    assert h["paid_out_total"] == 480
    assert h["total_users"] == 2  # admins excluded
    assert h["kyc_rate_pct"] == 50.0
    assert h["donations_count"] == 3
    assert h["unique_donors"] == 2  # one account + one guest email
    assert h["repeat_donor_rate_pct"] == 50.0
    assert h["payment_success_rate_pct"] == 75.0

    assert len(data["monthly"]) == 6
    assert data["monthly"][-1]["is_partial"] is True
    assert data["trends"]["gmv"]["last_month"] == 1100
    assert data["trends"]["gmv"]["previous_month"] == 500
    assert data["trends"]["gmv"]["growth_pct"] == 120.0

    funnel = {row["stage"]: row["count"] for row in data["funnel"]}
    assert funnel["Launched a campaign"] == 1
    assert funnel["Withdrew funds"] == 1

    cohort = next(c for c in data["cohorts"] if c["size"] and c["cohort"] == data["monthly"][-3]["month"])
    assert cohort["retention_pct"][0] == 100.0

    assert {r["rail"] for r in data["rails"]} == {"wave", "card"}
    assert data["outcomes"]["target_reached"] == 1
    assert data["top_campaigns"][0]["slug"] == "school-roof"


@pytest.mark.integration
def test_growth_metrics_requires_admin(client):
    assert client.get("/api/admin/growth").status_code in (401, 403)
