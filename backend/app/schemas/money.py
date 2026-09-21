"""The whole-dalasi amount type used by every money input.

Kambeng deals in whole dalasi only (see app/services/money.py for why), so an
amount carrying bututs is rejected at the edge — with a message aimed at the
person who typed it — rather than quietly rounded somewhere downstream.

Only *input* schemas use this. Read models keep a plain float so a legacy row
written before this rule can still be serialized instead of 500ing.
"""

from typing import Annotated

from pydantic import AfterValidator

from app.core.config import settings
from app.services.money import floor_dalasi, is_whole_dalasi


def _validate_whole_dalasi(value: float | None) -> float | None:
    if value is None:
        return None
    if not is_whole_dalasi(value):
        raise ValueError(
            f"Amount must be a whole number of dalasi — got {value:.2f}. "
            "Kambeng does not handle bututs."
        )
    return floor_dalasi(value)


def _validate_donation_amount(value: float | None) -> float | None:
    """A donation is a whole dalasi AND at least the minimum we accept.

    Below the minimum the rail's cut and the per-transaction overhead swallow
    the gift, so we decline it outright rather than bank a donation the
    campaign barely sees.
    """
    value = _validate_whole_dalasi(value)
    if value is None:
        return None
    minimum = settings.MINIMUM_DONATION_GMD
    if value < minimum:
        raise ValueError(f"The smallest donation Kambeng accepts is {minimum:.0f} GMD.")
    return value


WholeDalasi = Annotated[float, AfterValidator(_validate_whole_dalasi)]
DonationAmount = Annotated[float, AfterValidator(_validate_donation_amount)]
