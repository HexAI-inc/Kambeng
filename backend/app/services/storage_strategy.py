"""
Abstract storage strategy interface and factory for campaign image storage.

Supports both local disk and DigitalOcean Spaces via a configurable strategy pattern.
"""

from abc import ABC, abstractmethod
from typing import Dict, List
from app.core.config import settings
from app.core.logging_config import get_logger

logger = get_logger("storage_strategy")


class StorageStrategy(ABC):
    """Abstract base class for storage backends."""

    @abstractmethod
    def save_campaign_image(
        self, campaign_id: int, original_filename: str, content: bytes, content_type: str
    ) -> Dict[str, str | int]:
        """Save a campaign image and return metadata with URL."""
        pass

    @abstractmethod
    def list_campaign_images(self, campaign_id: int) -> List[Dict[str, str | int]]:
        """List all images for a campaign."""
        pass

    @abstractmethod
    def delete_campaign_image(self, campaign_id: int, file_name: str) -> bool:
        """Delete a campaign image by file name."""
        pass

    @abstractmethod
    def save_kyc_document(
        self, user_id: int, document_type: str, file_content: bytes, file_extension: str
    ) -> str:
        """Save a KYC document and return its URL."""
        pass


def get_storage_strategy() -> StorageStrategy:
    """Factory function that returns the active storage strategy based on STORAGE_STRATEGY env var."""
    strategy_name = getattr(settings, "STORAGE_STRATEGY", "local").lower()

    if strategy_name == "do_spaces":
        from app.services.do_spaces_strategy import DOSpacesStrategy

        logger.info("Initializing DO Spaces storage strategy")
        return DOSpacesStrategy()
    elif strategy_name == "local":
        from app.services.local_storage_strategy import LocalStorageStrategy

        logger.info("Initializing local storage strategy")
        return LocalStorageStrategy()
    else:
        raise ValueError(
            f"Unknown storage strategy: {strategy_name}. Must be 'local' or 'do_spaces'."
        )
