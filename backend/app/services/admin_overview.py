"""Everything an admin needs about one campaign or one user, in one response.

Backs the admin campaign and user pages, which used to show a handful of
fields and send admins hunting through the donations, payouts, KYC and
moderation screens to piece together a single story.
"""

from __future__ import annotations

from collections import Counter

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alias import CampaignAlias
from app.models.audit_log import AdminAuditLog
from app.models.campaign import Campaign, CampaignTag
from app.models.campaign_adjustment import CampaignBalanceAdjustment
from app.models.campaign_goal import CampaignGoal
from app.models.campaign_subscription import CampaignSubscription
from app.models.campaign_update import CampaignUpdate
from app.models.donation import Donation
from app.models.fraud_report import FraudReport
from app.models.kyc import KYC
from app.models.moderation import ModerationReport
from app.models.organization import Organization, OrganizationMember, WithdrawalRequest
from app.models.payout import Payout
from app.models.promotion import PromoApplication, Promotion
from app.models.proof import Proof
from app.models.recurring_donation import RecurringDonation
from app.models.referral import CampaignShareClick, Referral
from app.models.review import Review
from app.models.user import User
from app.models.user_follow import UserFollow
from app.services.campaign_audit import campaign_money, donation_net, payout_debit
from app.services.spending import spending_summary

LIST_LIMIT = 500
MONTHLY_FACTOR = {"WEEKLY": 52 / 12, "MONTHLY": 1.0, "QUARTERLY": 1 / 3, "ANNUAL": 1 / 12}


def _value(v):
    """Enum columns come back as enums; the page wants their string value."""
    return getattr(v, "value", v)


async def _names(db: AsyncSession, user_ids: set[int | None]) -> dict[int, str]:
    ids = {i for i in user_ids if i}
    if not ids:
        return {}
    rows = await db.execute(select(User.id, User.full_name, User.email).where(User.id.in_(ids)))
    return {r.id: r.full_name or r.email or f"User #{r.id}" for r in rows}


def _donation_row(d: Donation) -> dict:
    return {
        "id": d.id,
        "client_reference": d.client_reference,
        "campaign_id": d.campaign_id,
        "amount": d.amount,
        "net": donation_net(d) if d.status == "SUCCEEDED" else 0.0,
        "status": d.status,
        "provider": d.provider,
        "donor_name": d.donor_name,
        "donor_email": d.donor_email,
        "user_id": d.user_id,
        "message": d.message,
        "goal_id": d.goal_id,
        "reconciliation_source": d.reconciliation_source,
        "reconciliation_reason": d.reconciliation_reason,
        "reconciled_at": d.reconciled_at,
        "created_at": d.created_at,
    }


def _payout_row(p: Payout, names: dict[int, str]) -> dict:
    return {
        "id": p.id,
        "client_reference": p.client_reference,
        "campaign_id": p.campaign_id,
        "status": p.status,
        "gross_amount": p.gross_amount,
        "hexai_fee": p.hexai_fee,
        "platform_commission": p.platform_commission,
        "net_amount": p.net_amount or p.amount,
        "debit": payout_debit(p),
        "recipient_wave_number": p.recipient_wave_number,
        "requested_by": names.get(p.requested_by_user_id),
        "approved_by": names.get(p.approved_by_user_id),
        "has_gateway_id": bool(p.gateway_transaction_id),
        "reversed_at": p.reversed_at,
        "created_at": p.created_at,
    }


def _donation_stats(donations: list[Donation]) -> dict:
    succeeded = [d for d in donations if d.status == "SUCCEEDED"]
    status_counts = Counter(d.status for d in donations)
    donors = {d.user_id or (d.donor_email or "").strip().lower() for d in succeeded}
    donors.discard("")
    gross = round(sum(d.amount or 0 for d in succeeded), 2)
    by_provider: dict[str, dict] = {}
    for d in succeeded:
        bucket = by_provider.setdefault(d.provider or "unknown", {"provider": d.provider or "unknown", "count": 0, "gross": 0.0})
        bucket["count"] += 1
        bucket["gross"] = round(bucket["gross"] + (d.amount or 0), 2)
    dates = [d.created_at for d in succeeded if d.created_at]
    return {
        "succeeded": status_counts.get("SUCCEEDED", 0),
        "pending": status_counts.get("PENDING", 0),
        "failed": status_counts.get("FAILED", 0),
        "unique_donors": len(donors),
        "anonymous_gifts": sum(1 for d in succeeded if not d.user_id and not d.donor_email),
        "gross": gross,
        "net": round(sum(donation_net(d) for d in succeeded), 2),
        "average": round(gross / len(succeeded), 2) if succeeded else None,
        "largest": max((d.amount or 0 for d in succeeded), default=None),
        "first_at": min(dates) if dates else None,
        "last_at": max(dates) if dates else None,
        "by_provider": sorted(by_provider.values(), key=lambda b: -b["gross"]),
    }


async def _audit_entries(db: AsyncSession, condition) -> list[dict]:
    logs = (
        await db.execute(select(AdminAuditLog).where(condition).order_by(AdminAuditLog.created_at.desc()).limit(100))
    ).scalars().all()
    names = await _names(db, {log.performed_by_admin_id for log in logs})
    return [
        {
            "id": log.id,
            "action_type": log.action_type,
            "description": log.description,
            "details": log.details,
            "old_value": log.old_value,
            "new_value": log.new_value,
            "performed_by": names.get(log.performed_by_admin_id),
            "created_at": log.created_at,
        }
        for log in logs
    ]


async def _reports(db: AsyncSession, campaign_ids: list[int]) -> dict:
    if not campaign_ids:
        return {"fraud": [], "moderation": []}
    fraud = (
        await db.execute(select(FraudReport).where(FraudReport.campaign_id.in_(campaign_ids)).order_by(FraudReport.created_at.desc()))
    ).scalars().all()
    moderation = (
        await db.execute(
            select(ModerationReport).where(ModerationReport.campaign_id.in_(campaign_ids)).order_by(ModerationReport.id.desc())
        )
    ).scalars().all()
    return {
        "fraud": [
            {"id": r.id, "campaign_id": r.campaign_id, "reason": r.reason, "details": r.details, "status": r.status, "created_at": r.created_at}
            for r in fraud
        ],
        "moderation": [
            {
                "id": r.id,
                "campaign_id": r.campaign_id,
                "entity_type": _value(r.reported_entity_type),
                "reason": _value(r.reason),
                "description": r.description,
                "status": _value(r.status),
                "action_taken": r.action_taken,
                "moderation_note": r.moderation_note,
                "resolved_at": r.resolved_at,
                "created_at": getattr(r, "created_at", None),
            }
            for r in moderation
        ],
    }


def _kyc_rows(submissions: list[KYC], names: dict[int, str]) -> list[dict]:
    return [
        {
            "id": k.id,
            "document_type": k.document_type,
            "status": k.status,
            "rejection_reason": k.rejection_reason,
            "reviewed_by": names.get(k.reviewed_by_admin_id),
            "reviewed_at": k.reviewed_at,
            "created_at": k.created_at,
        }
        for k in submissions
    ]


async def campaign_overview(db: AsyncSession, campaign_id: int) -> dict | None:
    campaign = (await db.execute(select(Campaign).where(Campaign.id == campaign_id))).scalars().first()
    if campaign is None:
        return None

    owner = (await db.execute(select(User).where(User.id == campaign.user_id))).scalars().first()
    organization = None
    if campaign.organization_id:
        organization = (await db.execute(select(Organization).where(Organization.id == campaign.organization_id))).scalars().first()
    tags = (await db.execute(select(CampaignTag.tag).where(CampaignTag.campaign_id == campaign.id).order_by(CampaignTag.tag))).scalars().all()

    donations = (
        await db.execute(select(Donation).where(Donation.campaign_id == campaign.id).order_by(Donation.created_at.desc()))
    ).scalars().all()
    payouts = (
        await db.execute(select(Payout).where(Payout.campaign_id == campaign.id).order_by(Payout.created_at.desc()))
    ).scalars().all()
    requests = (
        await db.execute(select(WithdrawalRequest).where(WithdrawalRequest.campaign_id == campaign.id).order_by(WithdrawalRequest.created_at.desc()))
    ).scalars().all()
    goals = (await db.execute(select(CampaignGoal).where(CampaignGoal.campaign_id == campaign.id).order_by(CampaignGoal.sort_order))).scalars().all()
    updates = (
        await db.execute(select(CampaignUpdate).where(CampaignUpdate.campaign_id == campaign.id).order_by(CampaignUpdate.created_at.desc()))
    ).scalars().all()
    proofs = (await db.execute(select(Proof).where(Proof.campaign_id == campaign.id).order_by(Proof.created_at.desc()))).scalars().all()
    reviews = (await db.execute(select(Review).where(Review.campaign_id == campaign.id).order_by(Review.created_at.desc()))).scalars().all()
    plans = (await db.execute(select(RecurringDonation).where(RecurringDonation.campaign_id == campaign.id))).scalars().all()
    adjustments = (
        await db.execute(select(CampaignBalanceAdjustment).where(CampaignBalanceAdjustment.campaign_id == campaign.id).order_by(CampaignBalanceAdjustment.created_at.desc()))
    ).scalars().all()
    promos = (
        await db.execute(
            select(PromoApplication, Promotion.name, Promotion.promo_type)
            .join(Promotion, Promotion.id == PromoApplication.promotion_id)
            .where(PromoApplication.campaign_id == campaign.id)
            .order_by(PromoApplication.applied_at.desc())
        )
    ).all()
    active_promo_name = None
    if campaign.active_promo_id:
        active_promo_name = (await db.execute(select(Promotion.name).where(Promotion.id == campaign.active_promo_id))).scalar()
    followers = (await db.execute(select(func.count()).select_from(CampaignSubscription).where(CampaignSubscription.campaign_id == campaign.id))).scalar() or 0
    clicks, click_donations = (
        await db.execute(
            select(func.count(), func.count().filter(CampaignShareClick.resulted_in_donation.is_(True)))
            .select_from(CampaignShareClick).where(CampaignShareClick.campaign_id == campaign.id)
        )
    ).one()
    aliases = (await db.execute(select(CampaignAlias.short_code).where(CampaignAlias.campaign_id == campaign.id))).scalars().all()

    names = await _names(
        db,
        {p.requested_by_user_id for p in payouts} | {p.approved_by_user_id for p in payouts}
        | {r.requested_by_user_id for r in requests} | {r.decided_by_user_id for r in requests}
        | {a.created_by_admin_id for a in adjustments} | {u.user_id for u in updates},
    )
    owner_kyc = []
    if owner:
        submissions = (await db.execute(select(KYC).where(KYC.user_id == owner.id).order_by(KYC.created_at.desc()))).scalars().all()
        owner_kyc = _kyc_rows(submissions, await _names(db, {k.reviewed_by_admin_id for k in submissions}))

    return {
        "campaign": {
            "id": campaign.id,
            "title": campaign.title,
            "slug": campaign.slug,
            "description": campaign.description,
            "status": _value(campaign.status),
            "mode": _value(campaign.mode),
            "target_amount": campaign.target_amount,
            "amount_raised": campaign.amount_raised,
            "category": campaign.category,
            "tags": list(tags),
            "cover_image_url": campaign.cover_image_url,
            "beneficiary_type": campaign.beneficiary_type,
            "organiser_type": campaign.organiser_type,
            "class_board_enabled": campaign.class_board_enabled,
            "active_promo": active_promo_name,
            "qr_code_page_url": campaign.qr_code_page_url,
            "short_codes": list(aliases),
            "created_at": campaign.created_at,
        },
        "owner": owner and {
            "id": owner.id,
            "full_name": owner.full_name,
            "email": owner.email,
            "wave_number": owner.wave_number,
            "handle": owner.handle,
            "kyc_status": owner.kyc_status,
            "is_active": owner.is_active,
            "created_at": owner.created_at,
            "kyc_submissions": owner_kyc,
        },
        "organization": organization and {
            "id": organization.id,
            "name": organization.name,
            "org_type": organization.org_type,
            "verification_status": organization.verification_status,
            "region": organization.region,
            "payout_wave_number": organization.payout_wave_number,
            "approval_threshold": organization.approval_threshold,
        },
        "money": {**await campaign_money(db, campaign), "spending": await spending_summary(db, campaign.id)},
        "donation_stats": _donation_stats(list(donations)),
        "donations": [_donation_row(d) for d in donations[:LIST_LIMIT]],
        "payouts": [_payout_row(p, names) for p in payouts],
        "withdrawal_requests": [
            {
                "id": r.id,
                "amount": r.amount,
                "status": r.status,
                "requested_by": names.get(r.requested_by_user_id),
                "decided_by": names.get(r.decided_by_user_id),
                "decided_at": r.decided_at,
                "note": r.note,
                "payout_id": r.payout_id,
                "created_at": r.created_at,
            }
            for r in requests
        ],
        "balance_adjustments": [
            {"id": a.id, "amount": a.amount, "funded_by": a.funded_by, "reason": a.reason, "created_by": names.get(a.created_by_admin_id), "created_at": a.created_at}
            for a in adjustments
        ],
        "goals": [
            {"id": g.id, "title": g.title, "target_amount": g.target_amount, "amount_raised": g.amount_raised, "status": _value(g.status), "due_date": g.due_date}
            for g in goals
        ],
        "updates": [
            {"id": u.id, "title": u.title, "text": u.text, "category": u.category, "amount_spent": u.amount_spent, "posted_by": names.get(u.user_id), "created_at": u.created_at}
            for u in updates
        ],
        "proofs": [
            {"id": p.id, "description": p.description, "document_type": _value(p.document_type), "visibility": _value(p.visibility), "file_url": p.file_url, "created_at": p.created_at}
            for p in proofs
        ],
        "reviews": {
            "count": len(reviews),
            "average": round(sum(r.rating or 0 for r in reviews) / len(reviews), 2) if reviews else None,
            "recent": [{"id": r.id, "donor_name": r.donor_name, "rating": r.rating, "comment": r.comment, "created_at": r.created_at} for r in reviews[:10]],
        },
        "promotions": [
            {
                "id": app.id,
                "name": name,
                "promo_type": _value(promo_type),
                "donation_id": app.donation_id,
                "payout_id": app.payout_id,
                "fee_waived_amount": app.fee_waived_amount,
                "match_contributed_amount": app.match_contributed_amount,
                "reversed": app.reversed,
                "applied_at": app.applied_at,
            }
            for app, name, promo_type in promos
        ],
        "recurring": {
            "active_plans": sum(1 for p in plans if p.is_active),
            "monthly_committed": round(sum((p.amount or 0) * MONTHLY_FACTOR.get(p.frequency or "MONTHLY", 1.0) for p in plans if p.is_active), 2),
            "cancelled_plans": sum(1 for p in plans if p.cancelled_at),
        },
        "engagement": {"followers": followers, "share_clicks": clicks or 0, "share_click_donations": click_donations or 0},
        "reports": await _reports(db, [campaign.id]),
        "audit_log": await _audit_entries(db, AdminAuditLog.campaign_id == campaign.id),
    }


async def user_overview(db: AsyncSession, user_id: int) -> dict | None:
    user = (await db.execute(select(User).where(User.id == user_id))).scalars().first()
    if user is None:
        return None

    submissions = (await db.execute(select(KYC).where(KYC.user_id == user.id).order_by(KYC.created_at.desc()))).scalars().all()
    campaigns = (await db.execute(select(Campaign).where(Campaign.user_id == user.id).order_by(Campaign.created_at.desc()))).scalars().all()
    campaign_ids = [c.id for c in campaigns]
    titles = {c.id: c.title for c in campaigns}

    received = []
    payouts = []
    if campaign_ids:
        received = (
            await db.execute(select(Donation).where(Donation.campaign_id.in_(campaign_ids)).order_by(Donation.created_at.desc()))
        ).scalars().all()
    payout_filter = Payout.requested_by_user_id == user.id
    if campaign_ids:
        payout_filter = or_(payout_filter, Payout.campaign_id.in_(campaign_ids))
    payouts = (await db.execute(select(Payout).where(payout_filter).order_by(Payout.created_at.desc()))).scalars().all()

    made_filter = Donation.user_id == user.id
    if user.email:
        made_filter = or_(made_filter, func.lower(Donation.donor_email) == user.email.lower())
    made = (await db.execute(select(Donation).where(made_filter).order_by(Donation.created_at.desc()))).scalars().all()
    other_titles = {
        r.id: r.title
        for r in await db.execute(select(Campaign.id, Campaign.title).where(Campaign.id.in_({d.campaign_id for d in made} | {p.campaign_id for p in payouts} - set(campaign_ids))))
    }
    titles.update(other_titles)

    plans = (await db.execute(select(RecurringDonation).where(RecurringDonation.user_id == user.id).order_by(RecurringDonation.created_at.desc()))).scalars().all()
    owned_orgs = (await db.execute(select(Organization).where(Organization.owner_user_id == user.id))).scalars().all()
    memberships = (
        await db.execute(
            select(OrganizationMember, Organization.name)
            .join(Organization, Organization.id == OrganizationMember.organization_id)
            .where(OrganizationMember.user_id == user.id)
        )
    ).all()
    followers = (await db.execute(select(func.count()).select_from(UserFollow).where(UserFollow.followed_id == user.id))).scalar() or 0
    following = (await db.execute(select(func.count()).select_from(UserFollow).where(UserFollow.follower_id == user.id))).scalar() or 0
    referred = (await db.execute(select(func.count()).select_from(Referral).where(Referral.referrer_user_id == user.id, Referral.referred_user_id.isnot(None)))).scalar() or 0

    names = await _names(db, {k.reviewed_by_admin_id for k in submissions} | {p.requested_by_user_id for p in payouts} | {p.approved_by_user_id for p in payouts})

    campaign_rows = []
    for c in campaigns:
        money = await campaign_money(db, c)
        campaign_rows.append({
            "id": c.id,
            "title": c.title,
            "slug": c.slug,
            "status": _value(c.status),
            "mode": _value(c.mode),
            "target_amount": c.target_amount,
            "amount_raised": c.amount_raised,
            "donations": sum(1 for d in received if d.campaign_id == c.id and d.status == "SUCCEEDED"),
            "withdrawn": money["withdrawn"],
            "balance": money["balance"],
            "issues": money["issues"],
            "created_at": c.created_at,
        })

    succeeded_payouts = [p for p in payouts if p.status == "SUCCEEDED"]
    made_ok = [d for d in made if d.status == "SUCCEEDED"]
    with_titles = lambda rows: [{**row, "campaign_title": titles.get(row["campaign_id"])} for row in rows]  # noqa: E731

    return {
        "user": {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "wave_number": user.wave_number,
            "handle": user.handle,
            "avatar_url": user.avatar_url,
            "role": user.role,
            "is_active": user.is_active,
            "is_email_verified": user.is_email_verified,
            "account_purpose": user.account_purpose,
            "kyc_status": user.kyc_status,
            "kyc_verified_at": user.kyc_verified_at,
            "kyc_rejection_reason": user.kyc_rejection_reason,
            "referral_code": user.referral_code,
            "referred_by_code": user.referred_by_code,
            "created_at": user.created_at,
        },
        "kyc_submissions": _kyc_rows(list(submissions), names),
        "totals": {
            "campaigns": len(campaigns),
            "raised": round(sum(c.amount_raised or 0 for c in campaigns), 2),
            "donations_received": sum(1 for d in received if d.status == "SUCCEEDED"),
            "withdrawn": round(sum(payout_debit(p) for p in succeeded_payouts), 2),
            "sent_to_wave": round(sum(p.net_amount or p.amount or 0 for p in succeeded_payouts), 2),
            "balance": round(sum(r["balance"] for r in campaign_rows), 2),
            "donations_made": len(made_ok),
            "given": round(sum(d.amount or 0 for d in made_ok), 2),
            "followers": followers,
            "following": following,
            "referred_users": referred,
        },
        "campaigns": campaign_rows,
        "donations_received": with_titles([_donation_row(d) for d in received[:LIST_LIMIT]]),
        "donations_made": with_titles([_donation_row(d) for d in made[:LIST_LIMIT]]),
        "withdrawals": with_titles([_payout_row(p, names) for p in payouts]),
        "recurring_plans": [
            {
                "id": p.id,
                "campaign_id": p.campaign_id,
                "campaign_title": titles.get(p.campaign_id),
                "amount": p.amount,
                "frequency": p.frequency,
                "is_active": p.is_active,
                "next_charge_date": p.next_charge_date,
                "cancelled_at": p.cancelled_at,
                "created_at": p.created_at,
            }
            for p in plans
        ],
        "organizations": [
            {"id": o.id, "name": o.name, "role": "Owner", "org_type": o.org_type, "verification_status": o.verification_status}
            for o in owned_orgs
        ] + [
            {"id": m.organization_id, "name": name, "role": m.title or "Member", "status": m.status}
            for m, name in memberships
            if m.organization_id not in {o.id for o in owned_orgs}
        ],
        "reports": await _reports(db, campaign_ids),
        "audit_log": await _audit_entries(
            db,
            or_(AdminAuditLog.target_user_id == user.id, AdminAuditLog.campaign_id.in_(campaign_ids)) if campaign_ids else AdminAuditLog.target_user_id == user.id,
        ),
    }
