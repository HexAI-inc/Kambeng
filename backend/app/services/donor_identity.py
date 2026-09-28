"""When a donation may be publicly tied to the donor's account.

A logged-in donor still chooses what name appears on their gift. We only
reveal their profile (photo, link, "campaigns I supported") when they gave
under their own account name — a gift as "Anonymous" or under a nickname
must never be traceable back to the person.
"""
from app.models.donation import Donation
from app.models.user import User


def _norm(name: str | None) -> str:
    return " ".join((name or "").split()).casefold()


def is_attributed(donation: Donation, donor: User | None) -> bool:
    if donor is None or donation.user_id != donor.id or not donor.is_active:
        return False
    name = _norm(donation.donor_name)
    return bool(name) and name != "anonymous" and name == _norm(donor.full_name)

