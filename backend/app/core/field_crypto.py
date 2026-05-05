from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


@lru_cache(maxsize=1)
def get_fernet() -> Fernet:
    key = settings.FIELD_ENCRYPTION_KEY.strip()
    if not key:
        raise RuntimeError("FIELD_ENCRYPTION_KEY is not configured")
    return Fernet(key.encode("utf-8"))


def encrypt_string(value: str | None) -> str | None:
    if value is None:
        return None
    if value == "":
        return ""
    return get_fernet().encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_string(value: str | None) -> str | None:
    if value is None:
        return None
    if value == "":
        return ""
    try:
        return get_fernet().decrypt(value.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Unable to decrypt protected field") from exc