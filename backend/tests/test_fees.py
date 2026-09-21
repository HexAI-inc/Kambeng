"""Rail fees and the whole-dalasi rounding policy.

Collections: card payments run over Waychit at 6%, mobile money (Wave, APS)
at 2%, both floored. Payouts: HPG charges 2% rounded up with a D2 floor —
what it bills us — and Kambeng adds its flat D10 commission per the TOR.
"""

import pytest

from app.core.config import settings
from app.services.fees import (
    collection_fee,
    collection_fee_percent,
    is_card_provider,
    withdrawal_fee,
)
from app.services.money import ceil_dalasi, floor_dalasi, require_whole_dalasi


@pytest.mark.parametrize("provider", ["waychit_card", "WAYCHIT_CARD", "card", "waychit"])
def test_card_rails_are_charged_six_percent(provider):
    assert collection_fee_percent(provider) == pytest.approx(0.06)
    assert is_card_provider(provider)


@pytest.mark.parametrize("provider", ["wave", "aps", None, ""])
def test_mobile_money_rails_are_charged_two_percent(provider):
    assert collection_fee_percent(provider) == pytest.approx(0.02)
    assert not is_card_provider(provider)


def test_card_donation_costs_three_times_a_wave_donation():
    assert collection_fee(1000, "waychit_card") == 60.0
    assert collection_fee(1000, "wave") == 20.0
    # …and the campaign is credited the difference, not 4% it can't withdraw.
    assert 1000 - collection_fee(1000, "waychit_card") == 940.0


def test_collection_fees_round_down():
    # 6% of 25 is 1.50 — the campaign is charged 1, and the half-dalasi the
    # rail really takes comes out of the platform's margin.
    assert collection_fee(25, "waychit_card") == 1.0
    assert collection_fee(125, "wave") == 2.0   # 2.50


@pytest.mark.parametrize(
    "gross, fee",
    [
        (100, 2.0),    # 2% of D100 — the headline rate
        (50, 2.0),     # 2% would be 1: the D2 floor applies
        (20, 2.0),     # …and still D2 well below D100
        (99, 2.0),
        (101, 3.0),    # 2.02 rounds up
        (150, 3.0),
        (250, 5.0),
        (1000, 20.0),
    ],
)
def test_payout_fee_is_two_percent_rounded_up_with_a_d2_floor(gross, fee):
    """HPG bills 2% rounded up, never less than D2 — recording less than we
    are billed would leave the wallet short."""
    assert withdrawal_fee(gross) == fee


def test_a_collection_fee_below_a_dalasi_is_not_charged():
    """Nothing in the system holds bututs, so a sub-dalasi collection fee is
    simply 0. Payouts are different — they have the D2 floor."""
    assert collection_fee(10, "waychit_card") == 0.0   # 0.60
    assert withdrawal_fee(10) == 2.0


def test_whole_gross_and_whole_fees_leave_a_whole_net():
    """The invariant the rest of the system relies on: gross == net + fees."""
    for gross in range(13, 2000):
        hexai = withdrawal_fee(gross)
        net = gross - hexai - 10  # Kambeng's flat D10 commission, per the TOR
        assert net == floor_dalasi(net), f"fractional net for gross {gross}"
        assert gross == net + hexai + 10


def test_rounding_helpers():
    assert floor_dalasi(41.94) == 41.0
    assert floor_dalasi(0.97) == 0.0
    assert ceil_dalasi(1.06) == 2.0
    assert ceil_dalasi(6.0) == 6.0
    assert require_whole_dalasi(134) == 134.0
    with pytest.raises(ValueError, match="whole number of dalasi"):
        require_whole_dalasi(134.06)


def test_rates_are_configurable():
    assert settings.HEXAI_CARD_COLLECTION_FEE_PERCENT == pytest.approx(0.06)
    assert settings.HEXAI_MINIMUM_WITHDRAWAL_FEE_GMD == 2.0
    assert settings.PLATFORM_FIXED_COMMISSION_GMD == 10.0
