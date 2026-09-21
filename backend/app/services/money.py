"""Kambeng's money rules. Every amount in the system is a whole dalasi.

Two things forced this. The payment rail refuses payouts carrying butut
precision — D134.06 is rejected where D134.00 settles (HPG integration
notice, 20 Sep 2026) — and a system that stores bututs anywhere ends up
showing a campaigner a balance it cannot pay out. So dalasi is the unit of
account: amounts enter whole (the API rejects fractional ones) and every
derived figure is quantized before it is stored.

**Money rounds down; a fee we are actually billed rounds up.**

`floor_dalasi` is the default and covers everything we credit, pay out or
hold: a balance is never larger than the money behind it, and a payout's
sub-dalasi remainder is carried forward (`split_whole_dalasi`) rather than
dropped, so the campaigner keeps it.

`ceil_dalasi` exists for one case: HPG's payout fee, which it charges us as
2% rounded up with a D2 floor (see app/services/fees.py). Recording less
than we are billed would leave the wallet short, so that one rounds up.
Collection fees stay floored — the sub-dalasi difference there comes out of
the platform's margin rather than the campaign's credit.

Either way the amounts entering are whole and the fees are whole, so
`gross == net + fees` holds exactly in whole dalasi.

Arithmetic runs on integer bututs — 0.1 + 0.2 is not 0.3 in binary floating
point, and money is stored in Float columns throughout the codebase.
"""

from decimal import ROUND_HALF_UP, Decimal

BUTUTS_PER_DALASI = 100


def to_bututs(amount: float | int | Decimal) -> int:
    """Convert a GMD amount to integer bututs, rounding to the nearest butut.

    Nearest, not truncated: 137.99999999 is float noise for 138.00, and
    truncating it would quietly pay a dalasi less than owed.
    """
    quantized = Decimal(str(amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return int(quantized * BUTUTS_PER_DALASI)


def is_whole_dalasi(amount: float | int | Decimal) -> bool:
    return to_bututs(amount) % BUTUTS_PER_DALASI == 0


def floor_dalasi(amount: float | int | Decimal) -> float:
    """Round down to a whole dalasi — the default for anything we hold,
    credit or pay out."""
    bututs = to_bututs(amount)
    if bututs < 0:
        raise ValueError(f"Cannot round a negative amount: {amount}")
    return (bututs // BUTUTS_PER_DALASI * BUTUTS_PER_DALASI) / BUTUTS_PER_DALASI


def ceil_dalasi(amount: float | int | Decimal) -> float:
    """Round up to a whole dalasi — only for a fee the gateway bills us at a
    rounded-up rate, where recording less would leave the wallet short."""
    bututs = to_bututs(amount)
    if bututs < 0:
        raise ValueError(f"Cannot round a negative amount: {amount}")
    return -(-bututs // BUTUTS_PER_DALASI) * BUTUTS_PER_DALASI / BUTUTS_PER_DALASI


def split_whole_dalasi(amount: float | int | Decimal) -> tuple[float, float]:
    """Split a GMD amount into (payable, remainder).

    `payable` is the amount floored to a whole dalasi — what the rail
    accepts. `remainder` is the sub-dalasi leftover the caller must carry
    forward. Together they add back up to `amount` exactly, to the butut.

    >>> split_whole_dalasi(134.06)
    (134.0, 0.06)
    """
    bututs = to_bututs(amount)
    if bututs < 0:
        raise ValueError(f"Cannot split a negative amount: {amount}")
    payable = (bututs // BUTUTS_PER_DALASI) * BUTUTS_PER_DALASI
    return payable / BUTUTS_PER_DALASI, (bututs - payable) / BUTUTS_PER_DALASI


def require_whole_dalasi(amount: float | int | Decimal, *, label: str = "Amount") -> float:
    """Validate an amount entering the system. Raises ValueError with a
    message meant for the person who typed it."""
    if not is_whole_dalasi(amount):
        raise ValueError(
            f"{label} must be a whole number of dalasi — got {amount:.2f}. "
            "Kambeng does not handle bututs."
        )
    return floor_dalasi(amount)
