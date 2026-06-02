"""QR Code generation service for campaigns and donations."""
import io
import qrcode
from typing import Optional

from app.core.config import settings


class QRCodeService:
    """Service for generating QR codes for campaigns."""

    @staticmethod
    def generate_campaign_qr_code(
        campaign_slug: str,
        size: int = 10,
        border: int = 2,
    ) -> bytes:
        """
        Generate a QR code for a campaign.

        Args:
            campaign_slug: Campaign slug for URL
            size: Size of each box in pixels (default 10)
            border: Border size in boxes (default 2)

        Returns:
            PNG image bytes
        """
        # Create campaign URL
        campaign_url = f"{settings.FRONTEND_URL.rstrip('/')}/campaigns/{campaign_slug}"

        return QRCodeService._generate_qr_code_bytes(
            data=campaign_url,
            size=size,
            border=border,
        )

    @staticmethod
    def generate_short_code_qr(
        short_code: str,
        size: int = 10,
        border: int = 2,
    ) -> bytes:
        """
        Generate a QR code for a campaign short code.

        Args:
            short_code: Short code alias for the campaign
            size: Size of each box in pixels (default 10)
            border: Border size in boxes (default 2)

        Returns:
            PNG image bytes
        """
        short_url = f"{settings.FRONTEND_URL.rstrip('/')}/c/{short_code}"

        return QRCodeService._generate_qr_code_bytes(
            data=short_url,
            size=size,
            border=border,
        )

    @staticmethod
    def generate_donation_qr_code(
        campaign_slug: str,
        size: int = 10,
        border: int = 2,
    ) -> bytes:
        """
        Generate a QR code for a donation page.

        Args:
            campaign_slug: Campaign slug for donation link
            size: Size of each box in pixels (default 10)
            border: Border size in boxes (default 2)

        Returns:
            PNG image bytes
        """
        donation_url = f"{settings.FRONTEND_URL.rstrip('/')}/quick-pay/{campaign_slug}"

        return QRCodeService._generate_qr_code_bytes(
            data=donation_url,
            size=size,
            border=border,
        )

    @staticmethod
    def _generate_qr_code_bytes(
        data: str,
        size: int = 10,
        border: int = 2,
    ) -> bytes:
        """
        Generate a QR code and return as PNG bytes.

        Args:
            data: Data to encode in QR code
            size: Size of each box in pixels
            border: Border size in boxes

        Returns:
            PNG image bytes
        """
        qr = qrcode.QRCode(
            version=1,  # Auto-adjust size
            error_correction=qrcode.constants.ERROR_CORRECT_H,  # High error correction
            box_size=size,
            border=border,
        )
        qr.add_data(data)
        qr.make(fit=True)

        # Create image with white background and black QR code
        img = qr.make_image(fill_color="black", back_color="white")

        # Convert to PNG bytes
        img_bytes = io.BytesIO()
        img.save(img_bytes, format="PNG")
        img_bytes.seek(0)

        return img_bytes.getvalue()


# Legacy function for backward compatibility
def generate_and_upload_qr(url_data: str, prefix: str) -> str:
    """
    Legacy function - generates QR code (kept for backward compatibility).
    Now returns a data URL instead of uploading.
    """
    import base64

    qr_bytes = QRCodeService._generate_qr_code_bytes(url_data)
    # Return as base64 data URL
    b64_qr = base64.b64encode(qr_bytes).decode("utf-8")
    return f"data:image/png;base64,{b64_qr}"