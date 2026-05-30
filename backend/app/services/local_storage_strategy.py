"""
Local disk storage strategy for campaign images and KYC documents.
"""

from pathlib import Path
from typing import Dict, List
import uuid

from app.core.config import settings
from app.services.storage_strategy import StorageStrategy


class LocalStorageStrategy(StorageStrategy):
    """Store files locally on disk under MEDIA_ROOT."""

    def __init__(self):
        self.media_root = Path(settings.MEDIA_ROOT)
        self.media_root.mkdir(parents=True, exist_ok=True)

    def _campaign_dir(self, campaign_id: int) -> Path:
        """Get or create the campaign image directory."""
        campaign_dir = self.media_root / "campaigns" / str(campaign_id)
        campaign_dir.mkdir(parents=True, exist_ok=True)
        return campaign_dir

    def save_campaign_image(
        self,
        campaign_id: int,
        original_filename: str,
        content: bytes,
        content_type: str,
    ) -> Dict[str, str | int]:
        """Save a campaign image and return metadata with URL."""
        extension = self._resolve_extension(original_filename, content_type)
        file_name = f"{uuid.uuid4().hex}{extension}"

        campaign_dir = self._campaign_dir(campaign_id)
        file_path = campaign_dir / file_name
        file_path.write_bytes(content)

        relative = f"campaigns/{campaign_id}/{file_name}"
        url = f"{settings.MEDIA_URL_PREFIX}/{relative}"

        return {
            "file_name": file_name,
            "original_name": original_filename,
            "content_type": content_type,
            "size": len(content),
            "url": url,
            "path": str(file_path),
        }

    def list_campaign_images(self, campaign_id: int) -> List[Dict[str, str | int]]:
        """List all images for a campaign, sorted by modification time (newest first)."""
        campaign_dir = self._campaign_dir(campaign_id)
        files = sorted(
            [p for p in campaign_dir.iterdir() if p.is_file()],
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )

        images: List[Dict[str, str | int]] = []
        for file_path in files:
            relative = f"campaigns/{campaign_id}/{file_path.name}"
            images.append(
                {
                    "file_name": file_path.name,
                    "size": file_path.stat().st_size,
                    "url": f"{settings.MEDIA_URL_PREFIX}/{relative}",
                    "path": str(file_path),
                }
            )
        return images

    def delete_campaign_image(self, campaign_id: int, file_name: str) -> bool:
        """Delete a campaign image by file name."""
        campaign_dir = self._campaign_dir(campaign_id)
        file_path = campaign_dir / file_name

        if not file_path.exists() or not file_path.is_file():
            return False

        file_path.unlink()
        return True

    def _kyc_dir(self, user_id: int) -> Path:
        """Get or create the KYC document directory."""
        kyc_dir = self.media_root / "kyc" / str(user_id)
        kyc_dir.mkdir(parents=True, exist_ok=True)
        return kyc_dir

    def save_kyc_document(
        self, user_id: int, document_type: str, file_content: bytes, file_extension: str
    ) -> str:
        """Save a KYC document and return its URL."""
        extension = f".{file_extension.lstrip('.')}" if file_extension else ".bin"
        file_name = f"{uuid.uuid4().hex}{extension}"

        kyc_dir = self._kyc_dir(user_id)
        file_path = kyc_dir / file_name
        file_path.write_bytes(file_content)

        relative = f"kyc/{user_id}/{file_name}"
        url = f"{settings.MEDIA_URL_PREFIX}/{relative}"
        return url

    def presign_get(self, path: str, expires: int = 3600) -> str:
        """For local storage, the media URL is directly accessible via MEDIA_URL_PREFIX; return that URL.

        `path` may be a full file system path or a relative url; if it's a filesystem path we try to convert it.
        """
        # If path looks like an absolute file path, try to map to media url
        if path.startswith(str(self.media_root)):
            rel = path[len(str(self.media_root)):].lstrip("/\\")
            return f"{settings.MEDIA_URL_PREFIX}/{rel}"

        # If already a URL or relative path, return as-is or normalize
        if path.startswith("/"):
            return f"{settings.MEDIA_URL_PREFIX}/{path.lstrip('/')}"
        return path

    @staticmethod
    def _resolve_extension(original_filename: str, content_type: str) -> str:
        """Resolve file extension from filename or content type."""
        suffix = Path(original_filename).suffix.lower()
        if suffix in {".png", ".jpg", ".jpeg", ".webp", ".gif"}:
            return suffix

        mapping = {
            "image/png": ".png",
            "image/jpeg": ".jpg",
            "image/webp": ".webp",
            "image/gif": ".gif",
        }
        return mapping.get(content_type, ".bin")
