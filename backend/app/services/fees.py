"""What each rail charges, and what Kambeng charges on top.

**Collections (money in).** The rate depends on the rail: mobile money
(Wave, APS) costs 2%, while card payments run over Waychit and cost 6% — the
card schemes' own cut. Charging every collection at 2% credited the campaign
4% more than actually settled on every card donation. These are floored, so
the sub-dalasi difference comes out of the platform's margin.

**Payouts (money out).** HPG charges 2% with a **D2 floor**, rounded up to
the dalasi: D2 per D100, and still D2 on anything smaller. This is what HPG
bills us, so it is recorded as billed rather than rounded in our favour.

**Kambeng's own commission** is a flat D10 per organizer withdrawal, per the
TOR — it is not a percentage and is applied on top of HPG's fee in
payments.py (the promotions engine can waive it for a campaign).

Every figure here comes back as a whole dalasi. See app/services/money.py
for the rounding rules.
"""

from app.core.config import settings
from app.services.money import ceil_dalasi, floor_dalasi

# Donation.provider values that run over the card rail. "waychit_card" is what
# the API accepts today; the others are tolerated so an older row or a renamed
# rail can't silently fall back to the cheaper mobile-money rate.
CARD_PROVIDERS = {"waychit_card", "waychit", "card"}


def collection_fee_percent(provider: str | None) -> float:
    """The gateway's cut of a collection, as a rate, for this rail."""
    if (provider or "").strip().lower() in CARD_PROVIDERS:
        return settings.HEXAI_CARD_COLLECTION_FEE_PERCENT
    return settings.HEXAI_COLLECTION_FEE_PERCENT


def collection_fee(amount: float, provider: str | None) -> float:
    """The gateway's cut of a collection, in whole dalasi."""
    return min(floor_dalasi(amount * collection_fee_percent(provider)), float(amount))


def withdrawal_fee(amount: float) -> float:
    """HPG's cut of a payout, in whole dalasi: 2% rounded up, never less
    than the D2 floor.

    >>> withdrawal_fee(100)   # 2% of 100
    2.0
    >>> withdrawal_fee(50)    # 2% would be 1 — the floor applies
    2.0
    >>> withdrawal_fee(150)   # 2% of 150, rounded up
    3.0
    """
    percentage_fee = ceil_dalasi(amount * settings.HEXAI_WITHDRAWAL_FEE_PERCENT)
    return max(percentage_fee, settings.HEXAI_MINIMUM_WITHDRAWAL_FEE_GMD)


def is_card_provider(provider: str | None) -> bool:
    return (provider or "").strip().lower() in CARD_PROVIDERS
