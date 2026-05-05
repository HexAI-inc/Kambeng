from pathlib import Path
import uuid

from app.core.config import settings

class StorageService:
    def __init__(self):
        self.media_root = Path(settings.MEDIA_ROOT)
        self.media_root.mkdir(parents=True, exist_ok=True)
        self.proofs_dir = self.media_root / "proofs"
        self.proofs_dir.mkdir(parents=True, exist_ok=True)

    def upload_file(self, file_content: bytes, original_filename: str, content_type: str) -> str | None:
        """Stores proof files locally under uploads and returns a DB-storable URL path."""
        try:
            suffix = Path(original_filename).suffix.lower() or self._suffix_from_content_type(content_type)
            file_name = f"{uuid.uuid4().hex}{suffix}"
            file_path = self.proofs_dir / file_name
            file_path.write_bytes(file_content)

            relative = f"proofs/{file_name}"
            return f"{settings.MEDIA_URL_PREFIX}/{relative}"
        except Exception:
            return None

    @staticmethod
    def _suffix_from_content_type(content_type: str) -> str:
        mapping = {
            "image/png": ".png",
            "image/jpeg": ".jpg",
            "application/pdf": ".pdf",
        }
        return mapping.get(content_type, ".bin")