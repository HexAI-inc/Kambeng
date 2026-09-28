"""Traction metrics for the admin growth report.

One pass over narrow column selects, aggregated in Python. Month bucketing is
done here rather than with ``date_trunc`` so the same code runs on Postgres in
production and SQLite in tests; at Kambeng's volume the rows involved are few.

Definitions the report relies on (repeated in the UI footnote):

- **Processed (GMV)**: gross amount donors paid on SUCCEEDED donations.
- **Revenue**: Kambeng's platform commission on SUCCEEDED organizer
  withdrawals. Gateway fees are HPG's, not ours, and are excluded.
- **Take rate**: revenue / GMV.
- **Donor**: a logged-in donor (by account) or a guest who left an email.
  Fully anonymous gifts count toward GMV but not toward donor counts.
- **Growth**: the last *complete* month against the one before it. The current
  month is partial and is flagged as such, never compared.
"""

from __future__ import annotations

import statistics
from collections import defaultdict
from datetime import UTC, date, datetime
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.campaign import Campaign
from app.models.donation import Donation
from app.models.fraud_report import FraudReport
from app.models.kyc import KYC
from app.models.moderation import ModerationReport
from app.models.organization import Organization, OrgVerificationStatus
from app.models.payout import Payout
from app.models.proof import Proof
from app.models.recurring_donation import RecurringDonation
from app.models.subscriber import Subscriber
from app.models.user import User

# Recurring plan amounts normalised to a monthly commitment.
_MONTHLY_FACTOR = {"WEEKLY": 52 / 12, "MONTHLY": 1.0, "QUARTERLY": 1 / 3, "ANNUAL": 1 / 12}

# Gift-size bands in GMD, chosen around local giving norms (D10 minimum).
_GIFT_BANDS: list[tuple[str, float, Optional[float]]] = [
    ("D10–49", 0, 50),
    ("D50–199", 50, 200),
    ("D200–499", 200, 500),
    ("D500–999", 500, 1000),
    ("D1k–4.9k", 1000, 5000),
    ("D5k+", 5000, None),
]

COHORT_COUNT = 6


def _aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def _month_key(dt: datetime | date) -> str:
    return f"{dt.year:04d}-{dt.month:02d}"


def _shift_month(key: str, delta: int) -> str:
    year, month = int(key[:4]), int(key[5:7])
    index = year * 12 + (month - 1) + delta
    return f"{index // 12:04d}-{index % 12 + 1:02d}"


def _month_diff(a: str, b: str) -> int:
    """Whole months from ``a`` to ``b``."""
    return (int(b[:4]) * 12 + int(b[5:7])) - (int(a[:4]) * 12 + int(a[5:7]))


def _pct(part: float, whole: float) -> Optional[float]:
    return round(part / whole * 100, 1) if whole else None


def _growth(current: float, previous: float) -> Optional[float]:
    if not previous:
        return None
    return round((current - previous) / previous * 100, 1)


def _cmgr(values: list[float]) -> Optional[float]:
    """Compound monthly growth from the first non-zero month to the last."""
    start = next((i for i, v in enumerate(values) if v > 0), None)
    if start is None or start >= len(values) - 1 or values[-1] <= 0:
        return None
    periods = len(values) - 1 - start
    return round(((values[-1] / values[start]) ** (1 / periods) - 1) * 100, 1)


def _status(value) -> str:
    return (getattr(value, "value", value) or "").upper()


async def _rows(db: AsyncSession, stmt) -> list:
    return (await db.execute(stmt)).all()


async def build_growth_metrics(db: AsyncSession, months: int = 12) -> dict:
    now = datetime.now(UTC)
    current_month = _month_key(now)
    window = [_shift_month(current_month, -i) for i in range(months - 1, -1, -1)]
    window_set = set(window)
    last_full = _shift_month(current_month, -1)
    prev_full = _shift_month(current_month, -2)

    # ── Raw rows ─────────────────────────────────────────────────────────
    users = await _rows(db, select(
        User.id, User.created_at, User.role, User.is_email_verified,
        User.kyc_status, User.kyc_verified_at,
    ))
    users = [u for u in users if (u.role or "USER").upper() != "ADMIN"]

    campaigns = await _rows(db, select(
        Campaign.id, Campaign.user_id, Campaign.title, Campaign.slug, Campaign.category,
        Campaign.mode, Campaign.target_amount, Campaign.amount_raised, Campaign.status,
        Campaign.organization_id, Campaign.created_at,
    ))
    campaign_by_id = {c.id: c for c in campaigns}

    donations = await _rows(db, select(
        Donation.campaign_id, Donation.user_id, Donation.donor_email, Donation.amount,
        Donation.status, Donation.provider, Donation.created_at,
    ))
    succeeded = [d for d in donations if _status(d.status) == "SUCCEEDED"]
    failed_count = sum(1 for d in donations if _status(d.status) == "FAILED")

    payouts = await _rows(db, select(
        Payout.campaign_id, Payout.gross_amount, Payout.net_amount, Payout.amount,
        Payout.platform_commission, Payout.status, Payout.created_at,
    ))
    organizer_payouts = [p for p in payouts if p.campaign_id is not None]
    paid = [p for p in organizer_payouts if _status(p.status) == "SUCCEEDED"]

    kyc_reviews = await _rows(db, select(KYC.status, KYC.created_at, KYC.reviewed_at))
    recurring = await _rows(db, select(
        RecurringDonation.amount, RecurringDonation.frequency,
        RecurringDonation.is_active, RecurringDonation.cancelled_at,
    ))
    orgs = await _rows(db, select(
        Organization.org_type, Organization.region, Organization.verification_status, Organization.created_at,
    ))
    proof_campaign_ids = {r.campaign_id for r in await _rows(db, select(Proof.campaign_id))}
    fraud_reports = (await db.execute(select(func.count(FraudReport.id)))).scalar() or 0
    moderation_reports = (await db.execute(select(func.count(ModerationReport.id)))).scalar() or 0
    subscribers = await _rows(db, select(Subscriber.confirmed, Subscriber.unsubscribed))

    # ── Monthly series ───────────────────────────────────────────────────
    monthly = {
        m: {
            "month": m, "is_partial": m == current_month,
            "new_users": 0, "kyc_approved": 0, "gmv": 0.0, "donations": 0,
            "unique_donors": 0, "new_donors": 0, "revenue": 0.0, "paid_out": 0.0,
            "new_campaigns": 0, "new_organizations": 0,
        }
        for m in window
    }

    users_before_window = 0
    for u in users:
        created = _aware(u.created_at)
        if created is None:
            continue
        key = _month_key(created)
        if key in window_set:
            monthly[key]["new_users"] += 1
        elif key < window[0]:
            users_before_window += 1
        verified = _aware(u.kyc_verified_at)
        if verified and (u.kyc_status or "").upper() == "APPROVED":
            vkey = _month_key(verified)
            if vkey in window_set:
                monthly[vkey]["kyc_approved"] += 1

    for c in campaigns:
        created = _aware(c.created_at)
        if created and _month_key(created) in window_set:
            monthly[_month_key(created)]["new_campaigns"] += 1

    for o in orgs:
        created = _aware(o.created_at)
        if created and _month_key(created) in window_set:
            monthly[_month_key(created)]["new_organizations"] += 1

    def donor_key(d) -> Optional[str]:
        if d.user_id:
            return f"u{d.user_id}"
        if d.donor_email:
            return f"e{d.donor_email.strip().lower()}"
        return None

    donors_by_month: dict[str, set[str]] = defaultdict(set)
    donor_months: dict[str, set[str]] = defaultdict(set)
    donor_gift_count: dict[str, int] = defaultdict(int)
    campaign_donors: dict[int, set[str]] = defaultdict(set)
    campaign_gmv: dict[int, float] = defaultdict(float)
    campaign_gifts: dict[int, int] = defaultdict(int)
    campaign_first_gift: dict[int, datetime] = {}

    for d in succeeded:
        created = _aware(d.created_at)
        amount = float(d.amount or 0)
        key = _month_key(created) if created else None
        if key in window_set:
            monthly[key]["gmv"] += amount
            monthly[key]["donations"] += 1
        dk = donor_key(d)
        if dk:
            donor_gift_count[dk] += 1
            if key:
                donors_by_month[key].add(dk)
                donor_months[dk].add(key)
            if d.campaign_id:
                campaign_donors[d.campaign_id].add(dk)
        if d.campaign_id:
            campaign_gmv[d.campaign_id] += amount
            campaign_gifts[d.campaign_id] += 1
            if created and (d.campaign_id not in campaign_first_gift or created < campaign_first_gift[d.campaign_id]):
                campaign_first_gift[d.campaign_id] = created

    first_month_of = {dk: min(ms) for dk, ms in donor_months.items()}
    for m in window:
        monthly[m]["unique_donors"] = len(donors_by_month.get(m, ()))
    for first in first_month_of.values():
        if first in window_set:
            monthly[first]["new_donors"] += 1

    for p in paid:
        created = _aware(p.created_at)
        key = _month_key(created) if created else None
        if key in window_set:
            monthly[key]["revenue"] += float(p.platform_commission or 0)
            monthly[key]["paid_out"] += float(p.net_amount if p.net_amount is not None else (p.amount or 0))

    running = users_before_window
    series = []
    for m in window:
        row = monthly[m]
        running += row["new_users"]
        row["cumulative_users"] = running
        row["gmv"] = round(row["gmv"], 2)
        row["revenue"] = round(row["revenue"], 2)
        row["paid_out"] = round(row["paid_out"], 2)
        series.append(row)

    def month_value(key: str, field: str) -> float:
        return monthly[key][field] if key in monthly else 0

    complete = [r for r in series if not r["is_partial"]]

    # ── Headline ─────────────────────────────────────────────────────────
    gmv_total = sum(float(d.amount or 0) for d in succeeded)
    revenue_total = sum(float(p.platform_commission or 0) for p in paid)
    paid_out_total = sum(float(p.net_amount if p.net_amount is not None else (p.amount or 0)) for p in paid)
    total_users = len(users)
    kyc_approved = sum(1 for u in users if (u.kyc_status or "").upper() == "APPROVED")
    identified_donors = len(donor_gift_count)
    repeat_donors = sum(1 for n in donor_gift_count.values() if n >= 2)

    active_plans = [r for r in recurring if r.is_active and r.cancelled_at is None]
    recurring_monthly = sum(
        float(r.amount or 0) * _MONTHLY_FACTOR.get((r.frequency or "MONTHLY").upper(), 1.0)
        for r in active_plans
    )

    def trend(field: str) -> dict:
        cur, prev = month_value(last_full, field), month_value(prev_full, field)
        return {
            "last_month": round(cur, 2),
            "previous_month": round(prev, 2),
            "growth_pct": _growth(cur, prev),
            "cmgr_pct": _cmgr([r[field] for r in complete]),
        }

    headline = {
        "gmv_total": round(gmv_total, 2),
        "revenue_total": round(revenue_total, 2),
        "take_rate_pct": round(revenue_total / gmv_total * 100, 2) if gmv_total else None,
        "paid_out_total": round(paid_out_total, 2),
        "total_users": total_users,
        "kyc_approved": kyc_approved,
        "kyc_rate_pct": _pct(kyc_approved, total_users),
        "donations_count": len(succeeded),
        "unique_donors": identified_donors,
        "avg_donation": round(gmv_total / len(succeeded), 2) if succeeded else None,
        "median_donation": round(statistics.median(float(d.amount or 0) for d in succeeded), 2) if succeeded else None,
        "repeat_donor_rate_pct": _pct(repeat_donors, identified_donors),
        "payment_success_rate_pct": _pct(len(succeeded), len(succeeded) + failed_count),
        "recurring_active_plans": len(active_plans),
        "recurring_monthly_committed": round(recurring_monthly, 2),
        "campaigns_total": len(campaigns),
        "campaigns_funded": len(campaign_gmv),
        "organizations_total": len(orgs),
        "organizations_verified": sum(1 for o in orgs if (o.verification_status or "") == OrgVerificationStatus.APPROVED.value),
        "waitlist_subscribers": sum(1 for s in subscribers if s.confirmed and not s.unsubscribed),
    }

    trends = {
        "gmv": trend("gmv"),
        "revenue": trend("revenue"),
        "new_users": trend("new_users"),
        "donations": trend("donations"),
        "unique_donors": trend("unique_donors"),
        "new_campaigns": trend("new_campaigns"),
    }

    # ── Organizer funnel ─────────────────────────────────────────────────
    user_ids = {u.id for u in users}
    launched = {c.user_id for c in campaigns if c.user_id in user_ids}
    received = {campaign_by_id[cid].user_id for cid in campaign_gmv if cid in campaign_by_id} & user_ids
    withdrew = {campaign_by_id[p.campaign_id].user_id for p in paid if p.campaign_id in campaign_by_id} & user_ids
    funnel_counts = [
        ("Signed up", total_users),
        ("Verified email", sum(1 for u in users if u.is_email_verified)),
        ("Submitted KYC", sum(1 for u in users if (u.kyc_status or "NOT_SUBMITTED").upper() != "NOT_SUBMITTED")),
        ("KYC approved", kyc_approved),
        ("Launched a campaign", len(launched)),
        ("Received a donation", len(received)),
        ("Withdrew funds", len(withdrew)),
    ]
    funnel = [{"stage": s, "count": n, "pct_of_signups": _pct(n, total_users)} for s, n in funnel_counts]

    # ── KYC ──────────────────────────────────────────────────────────────
    status_counts: dict[str, int] = defaultdict(int)
    for u in users:
        s = (u.kyc_status or "NOT_SUBMITTED").upper()
        status_counts["PENDING" if s in ("SUBMITTED", "REVIEWING") else s] += 1
    review_hours = [
        (_aware(k.reviewed_at) - _aware(k.created_at)).total_seconds() / 3600
        for k in kyc_reviews
        if k.reviewed_at and k.created_at and _status(k.status) in ("APPROVED", "REJECTED")
    ]
    decided = status_counts["APPROVED"] + status_counts["REJECTED"]
    kyc = {
        "not_submitted": status_counts["NOT_SUBMITTED"],
        "pending": status_counts["PENDING"],
        "approved": status_counts["APPROVED"],
        "rejected": status_counts["REJECTED"],
        "approval_rate_pct": _pct(status_counts["APPROVED"], decided),
        "median_review_hours": round(statistics.median(review_hours), 1) if review_hours else None,
    }

    # ── Donor retention cohorts ──────────────────────────────────────────
    cohort_months = [_shift_month(current_month, -i) for i in range(COHORT_COUNT - 1, -1, -1)]
    cohorts = []
    for cm in cohort_months:
        members = [dk for dk, first in first_month_of.items() if first == cm]
        max_offset = _month_diff(cm, current_month)
        retention = []
        for offset in range(1, COHORT_COUNT):
            if offset > max_offset:
                retention.append(None)
                continue
            target = _shift_month(cm, offset)
            returned = sum(1 for dk in members if target in donor_months[dk])
            retention.append(_pct(returned, len(members)) if members else None)
        cohorts.append({"cohort": cm, "size": len(members), "retention_pct": retention})

    # ── Breakdowns ───────────────────────────────────────────────────────
    by_category: dict[str, dict] = defaultdict(lambda: {"campaigns": 0, "gmv": 0.0})
    for c in campaigns:
        by_category[c.category or "uncategorized"]["campaigns"] += 1
        by_category[c.category or "uncategorized"]["gmv"] += campaign_gmv.get(c.id, 0.0)
    categories = sorted(
        ({"category": k, "campaigns": v["campaigns"], "gmv": round(v["gmv"], 2)} for k, v in by_category.items()),
        key=lambda r: (-r["gmv"], -r["campaigns"]),
    )

    by_rail: dict[str, dict] = defaultdict(lambda: {"count": 0, "gmv": 0.0})
    for d in succeeded:
        rail = (d.provider or "wave").lower()
        by_rail[rail]["count"] += 1
        by_rail[rail]["gmv"] += float(d.amount or 0)
    rails = sorted(
        ({"rail": k, "count": v["count"], "gmv": round(v["gmv"], 2), "share_pct": _pct(v["gmv"], gmv_total)} for k, v in by_rail.items()),
        key=lambda r: -r["gmv"],
    )

    bands = []
    for label, lo, hi in _GIFT_BANDS:
        in_band = [float(d.amount or 0) for d in succeeded if float(d.amount or 0) >= lo and (hi is None or float(d.amount or 0) < hi)]
        bands.append({"band": label, "count": len(in_band), "gmv": round(sum(in_band), 2)})

    org_types: dict[str, int] = defaultdict(int)
    org_regions: dict[str, int] = defaultdict(int)
    for o in orgs:
        org_types[o.org_type or "OTHER"] += 1
        if o.region:
            org_regions[o.region] += 1

    # ── Campaign outcomes ────────────────────────────────────────────────
    target_campaigns = [c for c in campaigns if _status(c.mode) == "TARGET" and c.target_amount]
    days_to_first = [
        (campaign_first_gift[c.id] - _aware(c.created_at)).total_seconds() / 86400
        for c in campaigns
        if c.id in campaign_first_gift and c.created_at
    ]
    funded = headline["campaigns_funded"]
    withdrawn_campaigns = {p.campaign_id for p in paid}
    outcomes = {
        "funded_rate_pct": _pct(funded, len(campaigns)),
        "target_campaigns": len(target_campaigns),
        "target_reached": sum(1 for c in target_campaigns if float(c.amount_raised or 0) >= float(c.target_amount)),
        "avg_raised_per_funded": round(gmv_total / funded, 2) if funded else None,
        "avg_donors_per_funded": round(sum(len(v) for v in campaign_donors.values()) / funded, 1) if funded else None,
        "median_days_to_first_donation": round(statistics.median(days_to_first), 1) if days_to_first else None,
    }

    top_campaigns = [
        {
            "title": campaign_by_id[cid].title,
            "slug": campaign_by_id[cid].slug,
            "category": campaign_by_id[cid].category,
            "gmv": round(amount, 2),
            "donations": campaign_gifts[cid],
            "is_organization": campaign_by_id[cid].organization_id is not None,
        }
        for cid, amount in sorted(campaign_gmv.items(), key=lambda kv: -kv[1])[:5]
        if cid in campaign_by_id
    ]

    # ── Trust & transparency ─────────────────────────────────────────────
    settled_payouts = [p for p in organizer_payouts if _status(p.status) in ("SUCCEEDED", "FAILED")]
    trust = {
        "payouts_completed": len(paid),
        "payout_success_rate_pct": _pct(len(paid), len(settled_payouts)),
        "proof_coverage_pct": _pct(len(withdrawn_campaigns & proof_campaign_ids), len(withdrawn_campaigns)),
        "suspended_campaigns": sum(1 for c in campaigns if _status(c.status) == "SUSPENDED"),
        "suspension_rate_pct": _pct(sum(1 for c in campaigns if _status(c.status) == "SUSPENDED"), len(campaigns)),
        "fraud_reports": fraud_reports,
        "moderation_reports": moderation_reports,
    }

    return {
        "generated_at": now,
        "months": months,
        "current_month": current_month,
        "headline": headline,
        "trends": trends,
        "monthly": series,
        "funnel": funnel,
        "kyc": kyc,
        "cohorts": cohorts,
        "categories": categories,
        "rails": rails,
        "gift_bands": bands,
        "organizations": {
            "by_type": sorted(({"type": k, "count": v} for k, v in org_types.items()), key=lambda r: -r["count"]),
            "by_region": sorted(({"region": k, "count": v} for k, v in org_regions.items()), key=lambda r: -r["count"]),
        },
        "outcomes": outcomes,
        "top_campaigns": top_campaigns,
        "trust": trust,
    }
