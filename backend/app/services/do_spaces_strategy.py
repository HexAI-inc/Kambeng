"""
DigitalOcean Spaces storage strategy for campaign images and KYC documents.

Uses boto3 to interact with S3-compatible DO Spaces endpoints.
"""

from typing import Dict, List
import uuid
import boto3
from botocore.exceptions import ClientError

from app.core.config import settings
from app.services.storage_strategy import StorageStrategy
from app.core.logging_config import get_logger

logger = get_logger("do_spaces_strategy")


class DOSpacesStrategy(StorageStrategy):
    """Store files in DigitalOcean Spaces using S3-compatible API."""

    def __init__(self):
        """Initialize DO Spaces client with credentials from settings."""
        if not all(
            [
                settings.DO_SPACES_KEY,
                settings.DO_SPACES_SECRET,
                settings.DO_SPACES_REGION,
                settings.DO_SPACES_BUCKET,
                settings.DO_SPACES_ENDPOINT,
            ]
        ):
            raise ValueError(
                "DO Spaces strategy requires DO_SPACES_KEY, DO_SPACES_SECRET, "
                "DO_SPACES_REGION, DO_SPACES_BUCKET, and DO_SPACES_ENDPOINT to be set"
            )

        self.bucket = settings.DO_SPACES_BUCKET
        self.region = settings.DO_SPACES_REGION.lower()
        self.prefix = (settings.DO_SPACES_PREFIX or "kambeng").strip("/")
        self.public_endpoint = settings.DO_SPACES_PUBLIC_ENDPOINT.rstrip("/")

        # Create S3 client configured for DO Spaces
        self.s3_client = boto3.client(
            "s3",
            region_name=self.region,
            endpoint_url=settings.DO_SPACES_ENDPOINT,
            aws_access_key_id=settings.DO_SPACES_KEY,
            aws_secret_access_key=settings.DO_SPACES_SECRET,
        )
        logger.info(f"DO Spaces client initialized for bucket: {self.bucket}")

    def _key(self, *parts: str) -> str:
        return "/".join([self.prefix, *[part.strip("/") for part in parts if part]])

    def _public_url(self, key: str) -> str:
        return f"{self.public_endpoint}/{key.lstrip('/')}"

    def _ensure_bucket_exists(self) -> None:
        """Create the configured bucket if it does not already exist."""
        try:
            self.s3_client.head_bucket(Bucket=self.bucket)
        except ClientError as exc:
            error_code = str(exc.response.get("Error", {}).get("Code", ""))
            status_code = exc.response.get("ResponseMetadata", {}).get("HTTPStatusCode")

            if error_code == "403" or status_code == 403:
                logger.warning(
                    "Skipping DO Spaces bucket existence check for %s because HeadBucket returned 403",
                    self.bucket,
                )
                return

            if error_code not in {"404", "NoSuchBucket", "NotFound"}:
                raise

            create_kwargs = {"Bucket": self.bucket}
            if self.region != "us-east-1":
                create_kwargs["CreateBucketConfiguration"] = {"LocationConstraint": self.region}

            try:
                self.s3_client.create_bucket(**create_kwargs)
                logger.info(f"Created missing DO Spaces bucket: {self.bucket}")
            except ClientError as create_exc:
                create_error_code = str(create_exc.response.get("Error", {}).get("Code", ""))
                if create_error_code not in {"BucketAlreadyOwnedByYou", "BucketAlreadyExists"}:
                    raise

    def save_campaign_image(
        self,
        campaign_id: int,
        original_filename: str,
        content: bytes,
        content_type: str,
    ) -> Dict[str, str | int]:
        """Upload a campaign image to DO Spaces and return metadata with URL."""
        extension = self._resolve_extension(original_filename, content_type)
        file_name = f"{uuid.uuid4().hex}{extension}"
        key = self._key("campaigns", str(campaign_id), file_name)

        try:
            self._ensure_bucket_exists()
            self.s3_client.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=content,
                ContentType=content_type,
                ACL='public-read',
            )

            url = self._public_url(key)
            return {
                "file_name": file_name,
                "original_name": original_filename,
                "content_type": content_type,
                "size": len(content),
                "url": url,
                "path": key,
            }
        except ClientError as e:
            logger.error(f"Failed to upload campaign image: {e}")
            raise

    def list_campaign_images(self, campaign_id: int) -> List[Dict[str, str | int]]:
        """List all images for a campaign from DO Spaces."""
        prefix = self._key("campaigns", str(campaign_id)) + "/"
        images: List[Dict[str, str | int]] = []

        try:
            response = self.s3_client.list_objects_v2(Bucket=self.bucket, Prefix=prefix)
            if "Contents" not in response:
                return images

            # Sort by modification time, newest first
            objects = sorted(response["Contents"], key=lambda x: x["LastModified"], reverse=True)

            for obj in objects:
                key = obj["Key"]
                file_name = key.split("/")[-1]

                images.append(
                    {
                        "file_name": file_name,
                        "size": obj["Size"],
                        "url": self._public_url(key),
                        "path": key,
                    }
                )
            return images
        except ClientError as e:
            logger.error(f"Failed to list campaign images: {e}")
            raise

    def delete_campaign_image(self, campaign_id: int, file_name: str) -> bool:
        """Delete a campaign image from DO Spaces."""
        key = self._key("campaigns", str(campaign_id), file_name)

        try:
            self.s3_client.delete_object(Bucket=self.bucket, Key=key)
            return True
        except ClientError as e:
            logger.error(f"Failed to delete campaign image: {e}")
            return False

    def save_kyc_document(
        self, user_id: int, document_type: str, file_content: bytes, file_extension: str
    ) -> str:
        """Upload a KYC document to DO Spaces and return its URL."""
        extension = f".{file_extension.lstrip('.')}" if file_extension else ".bin"
        file_name = f"{uuid.uuid4().hex}{extension}"
        key = self._key("kyc", str(user_id), file_name)

        try:
            self._ensure_bucket_exists()
            _mime_map = {
                "pdf": "application/pdf",
                "png": "image/png",
                "jpg": "image/jpeg",
                "jpeg": "image/jpeg",
                "webp": "image/webp",
                "gif": "image/gif",
            }
            content_type = _mime_map.get(file_extension.lstrip(".").lower(), "application/octet-stream") if file_extension else "application/octet-stream"
            self.s3_client.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=file_content,
                ContentType=content_type,
                ACL='public-read',
            )
            return self._public_url(key)
        except ClientError as e:
            logger.error(f"Failed to upload KYC document: {e}")
            raise

    def presign_get(self, path: str, expires: int = 3600) -> str:
        """Return a presigned GET URL for the given object key or public URL.

        `path` may be a full public URL previously returned by `_public_url`, or a bucket key.
        """
        # Normalize key if a full URL was provided
        key = path
        if path.startswith(self.public_endpoint):
            key = path[len(self.public_endpoint):].lstrip("/")

        try:
            url = self.s3_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket, "Key": key},
                ExpiresIn=expires,
            )
            return url
        except ClientError as e:
            logger.error(f"Failed to generate presigned GET url for {path}: {e}")
            # Fall back to public URL
            return self._public_url(key)

    @staticmethod
    def _resolve_extension(original_filename: str, content_type: str) -> str:
        """Resolve file extension from filename or content type."""
        suffix = str(original_filename).split(".")[-1].lower() if "." in original_filename else ""
        if f".{suffix}" in {".png", ".jpg", ".jpeg", ".webp", ".gif"}:
            return f".{suffix}"

        mapping = {
            "image/png": ".png",
            "image/jpeg": ".jpg",
            "image/webp": ".webp",
            "image/gif": ".gif",
        }
        return mapping.get(content_type, ".bin")
