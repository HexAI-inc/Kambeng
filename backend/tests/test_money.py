"""Whole-dalasi rounding for payouts.

The payment rail rejects any payout amount carrying butut precision (D134.06
fails, D134.00 settles), so every payout is floored — and the remainder must
survive the split rather than vanish.
"""

import pytest

from app.services.money import is_whole_dalasi, split_whole_dalasi, to_bututs


@pytest.mark.parametrize(
    "amount, payable, remainder",
    [
        (134.06, 134.0, 0.06),   # the 16 Sep payout that the rail refused
        (10.06, 10.0, 0.06),     # HexAI's reproduction case
        (10.0, 10.0, 0.0),       # already whole — untouched
        (41.94, 41.0, 0.94),
        (0.97, 0.0, 0.97),       # below a dalasi: nothing payable
        (0.1 + 0.2, 0.0, 0.3),   # float noise must not leak into the split
    ],
)
def test_split_whole_dalasi(amount, payable, remainder):
    assert split_whole_dalasi(amount) == (payable, remainder)


def test_split_is_lossless():
    """payable + remainder must add back up to the original, to the butut."""
    for bututs in range(0, 5000, 7):
        amount = bututs / 100
        payable, remainder = split_whole_dalasi(amount)
        assert to_bututs(payable) + to_bututs(remainder) == bututs


def test_split_never_rounds_up():
    payable, _ = split_whole_dalasi(134.99)
    assert payable == 134.0


def test_is_whole_dalasi():
    assert is_whole_dalasi(134.0)
    assert is_whole_dalasi(134)
    assert not is_whole_dalasi(134.06)
    assert not is_whole_dalasi(134.5)


def test_negative_amount_rejected():
    with pytest.raises(ValueError):
        split_whole_dalasi(-5.0)


@pytest.mark.parametrize(
    "amount, expected",
    [(41.94, 41.0), (0.97, 0.0), (10.0, 10.0), (0.1 + 0.2, 0.0)],
)
def test_floor_dalasi(amount, expected):
    from app.services.money import floor_dalasi

    assert floor_dalasi(amount) == expected


@pytest.mark.parametrize(
    "amount, expected",
    [(1.06, 2.0), (1.5, 2.0), (6.0, 6.0), (0.0, 0.0), (0.01, 1.0)],
)
def test_ceil_dalasi(amount, expected):
    """Only HPG's payout fee rounds up — see app/services/fees.py."""
    from app.services.money import ceil_dalasi

    assert ceil_dalasi(amount) == expected


def test_require_whole_dalasi_rejects_bututs():
    from app.services.money import require_whole_dalasi

    assert require_whole_dalasi(134) == 134.0
    assert require_whole_dalasi(134.00) == 134.0
    with pytest.raises(ValueError, match="whole number of dalasi"):
        require_whole_dalasi(134.06)
