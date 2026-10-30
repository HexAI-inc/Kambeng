"""Short-lived signed links for private files kept on local disk.

DO Spaces signs private objects itself; this gives local storage the same
behaviour so KYC documents are never readable from a bare /uploads URL.
"""

import hashlib
import hmac
import time
from urllib.parse import urlencode

from app.core.config import settings

PRIVATE_MEDIA_PREFIXES = ("kyc/",)


def is_private_media(relative_path: str) -> bool:
    return relative_path.lstrip("/").startswith(PRIVATE_MEDIA_PREFIXES)


def _signature(relative_path: str, expires_at: int) -> str:
    message = f"{relative_path.lstrip('/')}:{expires_at}".encode("utf-8")
    return hmac.new(settings.SECRET_KEY.encode("utf-8"), message, hashlib.sha256).hexdigest()


def signed_query(relative_path: str, expires_in: int) -> str:
    expires_at = int(time.time()) + expires_in
    return urlencode({"exp": expires_at, "sig": _signature(relative_path, expires_at)})


def verify_signed_query(relative_path: str, exp: str | None, sig: str | None) -> bool:
    if not exp or not sig or not exp.isdigit():
        return False
    if int(exp) < time.time():
        return False
    return hmac.compare_digest(_signature(relative_path, int(exp)), sig)
