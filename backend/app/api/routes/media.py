import posixpath
from urllib.parse import unquote, urlparse

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.routes.auth import get_current_user_optional
from app.core.config import settings
from app.core.logging_config import get_logger
from app.models.user import User
from app.services.storage_strategy import get_storage_strategy

router = APIRouter()
logger = get_logger("kambeng.media")

storage_strategy = get_storage_strategy()

MAX_PRESIGN_SECONDS = 900


def _media_segments(url: str) -> list[str]:
    """Reduce a stored media URL or key to its path below the storage root,
    e.g. https://cdn/Kambeng/kyc/4/a.pdf or /uploads/kyc/4/a.pdf -> ["kyc", "4", "a.pdf"]."""
    path = posixpath.normpath("/" + unquote(urlparse(url).path).replace("\\", "/"))
    segments = [segment for segment in path.split("/") if segment]

    roots = {
        settings.MEDIA_URL_PREFIX.strip("/").lower(),
        (settings.DO_SPACES_PREFIX or "kambeng").strip("/").lower(),
    }
    while segments and segments[0].lower() in roots:
        segments = segments[1:]
    return segments


def _can_read(segments: list[str], user: User | None) -> bool:
    if not segments:
        return False
    area = segments[0].lower()
    is_admin = user is not None and user.role == "ADMIN"

    if area == "kyc":
        # Identity documents: the uploader and admins only.
        return is_admin or (user is not None and len(segments) > 1 and segments[1] == str(user.id))
    if area == "organizations":
        # Organisation verification documents are private; logos are public-read and need no presign.
        return is_admin
    # Campaign images, proofs and profile photos are public.
    return True


@router.get("/media/presign", tags=["Media"])
def presign_get(
    url: str = Query(..., description="The public URL or storage path to presign"),
    expires: int = Query(300, ge=1),
    current_user: User | None = Depends(get_current_user_optional),
):
    """Return a short-lived URL for GETting the provided media path.

    The `url` can be a full public URL previously returned by the storage layer, or a storage key/path.
    Private files (KYC, organisation documents) require the owner or an admin.
    """
    if not url:
        raise HTTPException(status_code=400, detail="Missing url parameter")

    if not _can_read(_media_segments(url), current_user):
        raise HTTPException(status_code=403 if current_user else 401, detail="Not allowed to access this file")

    expires = min(expires, MAX_PRESIGN_SECONDS)
    try:
        presigned = storage_strategy.presign_get(url, expires=expires)
        return {"url": presigned, "expires": expires}
    except Exception:
        logger.exception("Failed to generate presigned url")
        raise HTTPException(status_code=500, detail="Failed to generate presigned url")
