from fastapi import APIRouter, HTTPException, Query
from app.services.storage_strategy import get_storage_strategy
from app.core.config import settings

router = APIRouter()

storage_strategy = get_storage_strategy()


@router.get("/media/presign", tags=["Media"])
def presign_get(url: str = Query(..., description="The public URL or storage path to presign"), expires: int = 3600):
    """Return a URL suitable for GETting the provided media path.

    The `url` can be a full public URL previously returned by the storage layer, or a storage key/path.
    """
    if not url:
        raise HTTPException(status_code=400, detail="Missing url parameter")

    try:
        presigned = storage_strategy.presign_get(url, expires=expires)
        return {"url": presigned, "expires": expires}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate presigned url: {e}")
