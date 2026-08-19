"""Promotions engine — one generic engine, many promo types (see
docs/marketing module.txt §Promotions Engine). Every promo is a row in the
`promotions` table, not a code deployment.

Adaptation note: the spec's illustrative fee-calc code assumes a flat
per-donation commission. This codebase's real fee model is different —
HexAI takes a 2% collection fee at donation time (an external cost, not
Kambeng revenue), and Kambeng's actual commission is a fixed D10 GMD charged
at *withdrawal* time (see app/api/routes/payments.py `/withdraw`). This
engine is wired into those real touchpoints:

  - Campaign-level fee waivers (campaign_fee_waiver, ngo_onboarding,
    organiser_referral) reduce the platform_commission on a withdrawal.
  - Rebates (milestone_completion_rebate, transparency_rebate) are event-
    triggered ledger credits computed against commission already paid.
  - Donor-side promos (donor_fee_free_day, first_donation_bonus) have
    Kambeng absorb the HexAI collection fee, crediting the campaign the
    full gross donation instead of net-of-fee.
  - matched_donation adds money on top of the donation, drawn from a
    depleting pool with a row-level lock to avoid a race on the last slice.

Stacking (§7.1): only one promo applies per resolution point. Withdrawal-
time waivers, donation-time fee absorption, and matched-donation are
independent resolution points — a donation could receive both a fee waiver
and a match, since they are different economic levers (cost reduction vs.
extra funds), not competing discounts.
"""

import logging
import secrets
import string
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.campaign import Campaign
from app.models.donation import Donation
from app.models.ledger import TransactionLedger, TransactionStatus, TransactionType
from app.models.payout import Payout
from app.models.promotion import PromoApplication, Promotion, PromoType
from app.models.referral import Referral, ReferralType
from app.models.user import User

logger = logging.getLogger(__name__)

TRANSPARENCY_REBATE_WINDOW_DAYS = 7
REFERRAL_CODE_ALPHABET = string.ascii_uppercase + string.digits


def _now_utc() -> datetime:
    return datetime.now(UTC)


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def is_promo_live(promo: Promotion) -> bool:
    if not promo.is_active:
        return False
    now = _now_utc()
    if _aware(promo.starts_at) > now:
        return False
    if promo.ends_at is not None and _aware(promo.ends_at) < now:
        return False
    return True


async def get_promotion(db: AsyncSession, promo_id: int) -> Promotion | None:
    result = await db.execute(select(Promotion).where(Promotion.id == promo_id))
    return result.scalars().first()


async def get_active_promo_by_type(db: AsyncSession, promo_type: PromoType) -> Promotion | None:
    result = await db.execute(
        select(Promotion)
        .where(Promotion.promo_type == promo_type.value, Promotion.is_active.is_(True))
        .order_by(Promotion.created_at.asc())
    )
    for promo in result.scalars().all():
        if is_promo_live(promo):
            return promo
    return None


# ---------------------------------------------------------------------------
# Withdrawal-time fee waiver (campaign_fee_waiver, ngo_onboarding, organiser_referral)
# ---------------------------------------------------------------------------


class WithdrawalWaiverResult:
    def __init__(self, waiver_pct: float, promotion: Promotion | None, referral: Referral | None = None):
        self.waiver_pct = waiver_pct
        self.promotion = promotion
        self.referral = referral

    @property
    def applies(self) -> bool:
        return self.promotion is not None and self.waiver_pct > 0


async def resolve_withdrawal_fee_waiver(db: AsyncSession, campaign: Campaign, owner: User) -> WithdrawalWaiverResult:
    """Priority order, first match wins (no stacking, §7.1)."""

    # 1. Explicit campaign-level assignment (admin-curated: Founding Campaigns, seasonal windows)
    if campaign.active_promo_id:
        promo = await get_promotion(db, campaign.active_promo_id)
        if promo and promo.promo_type == PromoType.CAMPAIGN_FEE_WAIVER.value and is_promo_live(promo):
            return WithdrawalWaiverResult(promo.fee_waiver_pct or 0.0, promo)

    # 2. NGO onboarding — first campaign only, for organiser_type == 'ngo'
    if campaign.organiser_type == "ngo":
        promo = await get_active_promo_by_type(db, PromoType.NGO_ONBOARDING)
        if promo:
            count_result = await db.execute(select(func.count(Campaign.id)).where(Campaign.user_id == owner.id))
            campaign_count = count_result.scalar() or 0
            if campaign_count <= 1:  # this withdrawal's campaign is their only one so far
                return WithdrawalWaiverResult(promo.fee_waiver_pct or 100.0, promo)

    # 3. Organiser referral reward — granted once, consumed on the referrer's next withdrawal
    referral_result = await db.execute(
        select(Referral).where(
            Referral.referrer_user_id == owner.id,
            Referral.referral_type == ReferralType.ORGANISER_REFERRAL.value,
            Referral.reward_applied.is_(False),
            Referral.referred_user_id.isnot(None),
        ).order_by(Referral.created_at.asc())
    )
    referral = referral_result.scalars().first()
    if referral:
        promo = await get_active_promo_by_type(db, PromoType.ORGANISER_REFERRAL)
        if promo:
            return WithdrawalWaiverResult(promo.fee_waiver_pct or 100.0, promo, referral)

    return WithdrawalWaiverResult(0.0, None)


async def record_withdrawal_waiver_application(
    db: AsyncSession,
    *,
    result: WithdrawalWaiverResult,
    campaign: Campaign,
    owner: User,
    payout: Payout,
    fee_waived_amount: float,
) -> PromoApplication | None:
    if not result.applies or result.promotion is None:
        return None

    application = PromoApplication(
        promotion_id=result.promotion.id,
        campaign_id=campaign.id,
        payout_id=payout.id,
        user_id=owner.id,
        fee_waived_amount=fee_waived_amount,
    )
    db.add(application)
    await db.flush()

    payout.promo_application_id = application.id

    if result.referral is not None:
        result.referral.reward_applied = True

    logger.info(
        "Promo applied at withdrawal",
        extra={
            "action": "promo_applied_withdrawal",
            "promotion_id": result.promotion.id,
            "campaign_id": campaign.id,
            "payout_id": payout.id,
            "fee_waived_amount": fee_waived_amount,
        },
    )
    return application


# ---------------------------------------------------------------------------
# Donation-time promos: fee absorption (donor_fee_free_day, first_donation_bonus)
# and matched donations
# ---------------------------------------------------------------------------


async def _is_donor_first_donation(db: AsyncSession, user_id: int, *, excluding_client_reference: str) -> bool:
    result = await db.execute(
        select(func.count(Donation.id)).where(
            Donation.user_id == user_id,
            Donation.status == "SUCCEEDED",
            Donation.client_reference != excluding_client_reference,
        )
    )
    return (result.scalar() or 0) == 0


class DonationPromoResult:
    def __init__(self):
        self.fee_waived_amount: float = 0.0  # extra credited to campaign, absorbed by Kambeng
        self.fee_waiver_promo: Promotion | None = None
        self.match_amount: float = 0.0
        self.match_promo: Promotion | None = None


async def resolve_donation_fee_absorption(
    db: AsyncSession, donation: Donation, *, collection_fee: float
) -> tuple[float, Promotion | None]:
    """Donor-side fee-free promos: Kambeng eats the HexAI collection fee so
    the campaign is credited the full gross amount. Priority, no stacking."""
    if collection_fee <= 0:
        return 0.0, None

    promo = await get_active_promo_by_type(db, PromoType.DONOR_FEE_FREE_DAY)
    if promo:
        return collection_fee, promo

    if donation.user_id:
        promo = await get_active_promo_by_type(db, PromoType.FIRST_DONATION_BONUS)
        if promo and await _is_donor_first_donation(db, donation.user_id, excluding_client_reference=donation.client_reference):
            return collection_fee, promo

    return 0.0, None


async def apply_match(db: AsyncSession, promo_id: int, donation_amount: float) -> float:
    """Atomically draw from a matched-donation pool. Row-level lock prevents
    two concurrent donations from over-claiming the last slice (§4.1)."""
    result = await db.execute(select(Promotion).where(Promotion.id == promo_id).with_for_update())
    promo = result.scalars().first()
    if promo is None or promo.match_pool_remaining is None or promo.match_pool_remaining <= 0:
        return 0.0

    requested_match = donation_amount * (promo.match_ratio or 0.0)
    actual_match = min(requested_match, promo.match_pool_remaining)
    if actual_match <= 0:
        return 0.0

    promo.match_pool_remaining -= actual_match
    if promo.match_pool_remaining <= 0:
        promo.is_active = False  # pool spent — auto-disable

    await db.flush()
    return round(actual_match, 2)


async def resolve_matched_donation(db: AsyncSession, campaign: Campaign, donation: Donation) -> tuple[float, Promotion | None]:
    promo = await get_active_promo_by_type(db, PromoType.MATCHED_DONATION)
    if not promo or promo.match_pool_remaining is None or promo.match_pool_remaining <= 0:
        return 0.0, None
    if promo.category_filter:
        # No category field on Campaign today — category-scoped match pools
        # are opt-in only when a future category field exists; skip filter.
        pass
    actual_match = await apply_match(db, promo.id, donation.amount)
    if actual_match <= 0:
        return 0.0, None
    return actual_match, promo


async def apply_donation_promos(db: AsyncSession, campaign: Campaign, donation: Donation, *, collection_fee: float) -> DonationPromoResult:
    outcome = DonationPromoResult()

    outcome.fee_waived_amount, outcome.fee_waiver_promo = await resolve_donation_fee_absorption(
        db, donation, collection_fee=collection_fee
    )
    outcome.match_amount, outcome.match_promo = await resolve_matched_donation(db, campaign, donation)

    last_application_id: int | None = None

    if outcome.fee_waiver_promo is not None:
        application = PromoApplication(
            promotion_id=outcome.fee_waiver_promo.id,
            campaign_id=campaign.id,
            donation_id=donation.id,
            user_id=donation.user_id,
            fee_waived_amount=outcome.fee_waived_amount,
        )
        db.add(application)
        await db.flush()
        last_application_id = application.id
        logger.info(
            "Donation fee absorbed by promo",
            extra={"action": "promo_applied_donation_fee", "promotion_id": outcome.fee_waiver_promo.id, "donation_id": donation.id},
        )

    if outcome.match_promo is not None:
        application = PromoApplication(
            promotion_id=outcome.match_promo.id,
            campaign_id=campaign.id,
            donation_id=donation.id,
            user_id=donation.user_id,
            fee_waived_amount=0.0,
            match_contributed_amount=outcome.match_amount,
        )
        db.add(application)
        await db.flush()
        last_application_id = application.id

        match_ledger = TransactionLedger(
            campaign_id=campaign.id,
            transaction_type=TransactionType.DONATION,
            status=TransactionStatus.SUCCEEDED,
            gross_amount=outcome.match_amount,
            net_amount=outcome.match_amount,
            external_reference=f"{donation.client_reference}-MATCH",
            description=f"Matched contribution — {outcome.match_promo.name}",
            confirmed_at=_now_utc(),
        )
        db.add(match_ledger)
        logger.info(
            "Donation matched by promo",
            extra={"action": "promo_applied_match", "promotion_id": outcome.match_promo.id, "donation_id": donation.id, "amount": outcome.match_amount},
        )

    if last_application_id is not None:
        donation.promo_application_id = last_application_id

    return outcome


# ---------------------------------------------------------------------------
# Rebates — event-triggered ledger credits against commission already paid
# ---------------------------------------------------------------------------


async def process_completion_rebate(db: AsyncSession, campaign: Campaign) -> None:
    """§3.3 — campaign fully funded. Rebates a % of the platform commission
    already paid on this campaign's successful withdrawals."""
    promo = await get_active_promo_by_type(db, PromoType.MILESTONE_COMPLETION_REBATE)
    if not promo or not promo.rebate_pct:
        return

    result = await db.execute(
        select(func.sum(Payout.platform_commission)).where(Payout.campaign_id == campaign.id, Payout.status == "SUCCEEDED")
    )
    total_commission = result.scalar() or 0.0
    if total_commission <= 0:
        return

    rebate_amount = round(total_commission * (promo.rebate_pct / 100), 2)
    if rebate_amount <= 0:
        return

    await _credit_rebate(db, campaign=campaign, promo=promo, rebate_amount=rebate_amount, note=f"Completion rebate: {promo.name}")


async def process_transparency_rebate(db: AsyncSession, campaign: Campaign, upload_created_at: datetime) -> None:
    """§3.4 — proof uploaded within N days of the latest payout."""
    promo = await get_active_promo_by_type(db, PromoType.TRANSPARENCY_REBATE)
    if not promo or not promo.rebate_pct:
        return

    payout_result = await db.execute(
        select(Payout)
        .where(Payout.campaign_id == campaign.id, Payout.status == "SUCCEEDED")
        .order_by(Payout.created_at.desc())
        .limit(1)
    )
    payout = payout_result.scalars().first()
    if payout is None or not payout.platform_commission:
        return

    days_elapsed = (_aware(upload_created_at) - _aware(payout.created_at)).days
    if days_elapsed > TRANSPARENCY_REBATE_WINDOW_DAYS or days_elapsed < 0:
        return

    rebate_amount = round(payout.platform_commission * (promo.rebate_pct / 100), 2)
    if rebate_amount <= 0:
        return

    await _credit_rebate(
        db, campaign=campaign, promo=promo, rebate_amount=rebate_amount,
        note=f"Transparency rebate — proof uploaded on time: {promo.name}", payout=payout,
    )


async def _credit_rebate(
    db: AsyncSession, *, campaign: Campaign, promo: Promotion, rebate_amount: float, note: str, payout: Payout | None = None
) -> None:
    ledger_entry = TransactionLedger(
        campaign_id=campaign.id,
        transaction_type=TransactionType.REFUND,
        status=TransactionStatus.SUCCEEDED,
        gross_amount=rebate_amount,
        net_amount=rebate_amount,
        description=note,
        confirmed_at=_now_utc(),
    )
    db.add(ledger_entry)
    campaign.amount_raised = (campaign.amount_raised or 0.0) + rebate_amount

    application = PromoApplication(
        promotion_id=promo.id,
        campaign_id=campaign.id,
        payout_id=payout.id if payout else None,
        user_id=campaign.user_id,
        fee_waived_amount=rebate_amount,
    )
    db.add(application)
    await db.flush()
    logger.info(
        "Rebate credited",
        extra={"action": "promo_rebate_credited", "promotion_id": promo.id, "campaign_id": campaign.id, "amount": rebate_amount},
    )


# ---------------------------------------------------------------------------
# Referral program
# ---------------------------------------------------------------------------


def _generate_code(length: int = 6) -> str:
    return "".join(secrets.choice(REFERRAL_CODE_ALPHABET) for _ in range(length))


async def ensure_referral_code(db: AsyncSession, user: User) -> str:
    if user.referral_code:
        return user.referral_code
    for _ in range(10):
        candidate = _generate_code()
        existing = await db.execute(select(User.id).where(User.referral_code == candidate))
        if existing.scalars().first() is None:
            user.referral_code = candidate
            await db.flush()
            return candidate
    raise RuntimeError("Could not generate a unique referral code")


async def capture_referral_signup(db: AsyncSession, new_user: User, ref_code: str | None) -> None:
    """Called right after registration. §7.5: a user cannot refer themselves."""
    if not ref_code:
        return
    ref_code = ref_code.strip().upper()
    if not ref_code:
        return

    referrer_result = await db.execute(select(User).where(User.referral_code == ref_code))
    referrer = referrer_result.scalars().first()
    if referrer is None or referrer.id == new_user.id:
        return

    new_user.referred_by_code = ref_code
    db.add(
        Referral(
            referrer_user_id=referrer.id,
            referred_user_id=new_user.id,
            referral_code=f"{ref_code}-{secrets.token_hex(4)}",
            referral_type=ReferralType.ORGANISER_REFERRAL.value,
        )
    )
    await db.flush()
    logger.info(
        "Referral captured at signup",
        extra={"action": "referral_captured", "referrer_user_id": referrer.id, "referred_user_id": new_user.id},
    )


async def notify_referrer_of_new_campaign(db: AsyncSession, new_campaign: Campaign) -> None:
    """Best-effort notification when a referred organiser's campaign goes
    live. The actual fee waiver is granted lazily at the referrer's next
    withdrawal (resolve_withdrawal_fee_waiver) — see module docstring."""
    from app.services.email_service import send_email

    result = await db.execute(
        select(Referral, User).join(User, Referral.referrer_user_id == User.id).where(
            Referral.referred_user_id == new_campaign.user_id,
            Referral.referral_type == ReferralType.ORGANISER_REFERRAL.value,
            Referral.reward_applied.is_(False),
        )
    )
    row = result.first()
    if not row:
        return
    _referral, referrer = row
    if not referrer.email:
        return
    try:
        send_email(
            referrer.email,
            "Someone you referred just launched a campaign on Kambeng",
            (
                f"<p>Good news — someone you referred to Kambeng just launched their first campaign: "
                f"<strong>{new_campaign.title}</strong>.</p>"
                f"<p>As a thank-you, your next campaign withdrawal will have Kambeng's platform fee waived.</p>"
            ),
        )
    except Exception:
        logger.exception("Failed to send referral notification email", extra={"campaign_id": new_campaign.id})
