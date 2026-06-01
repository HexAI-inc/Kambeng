import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "dev")
    PROJECT_NAME: str = "Kambeng - GambiaGive API"
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "https://kambeng.hexai.gm")
    BACKEND_PUBLIC_URL: str = os.getenv("BACKEND_PUBLIC_URL", "http://127.0.0.1:8001")
    MEDIA_ROOT: str = os.getenv("MEDIA_ROOT", "uploads")
    MEDIA_URL_PREFIX: str = os.getenv("MEDIA_URL_PREFIX", "/uploads")
    MAX_CAMPAIGN_IMAGES: int = int(os.getenv("MAX_CAMPAIGN_IMAGES", "5"))
    MAX_CAMPAIGN_IMAGE_SIZE_MB: int = int(os.getenv("MAX_CAMPAIGN_IMAGE_SIZE_MB", "5"))
    MAX_PROOF_FILE_SIZE_MB: int = int(os.getenv("MAX_PROOF_FILE_SIZE_MB", "8"))
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/kambeng")
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
    FIELD_ENCRYPTION_KEY: str = os.getenv("FIELD_ENCRYPTION_KEY", "")

    # API docs configuration
    API_OPENAPI_URL: str = os.getenv("API_OPENAPI_URL", "/openapi.json")
    API_DOCS_URL: str = os.getenv("API_DOCS_URL", "/docs")
    API_REDOC_URL: str = os.getenv("API_REDOC_URL", "/redoc")
    SWAGGER_PERSIST_AUTHORIZATION: bool = os.getenv("SWAGGER_PERSIST_AUTHORIZATION", "true").lower() == "true"
    
    # Resend Email Service
    RESEND_API_KEY: str = os.getenv("RESEND_API_KEY", "")
    RESEND_FROM_EMAIL: str = os.getenv("RESEND_FROM_EMAIL", "Kambeng <onboarding@resend.dev>")
    
    # HexAI Gateway
    HEXAI_BASE_URL: str = "https://api.hpg.hexai.gm/api/v1"
    HEXAI_API_KEY: str = os.getenv("HEXAI_API_KEY", "")
    HEXAI_WEBHOOK_SECRET: str = os.getenv("HEXAI_WEBHOOK_SECRET", "")
    
    # DO Spaces
    DO_SPACES_KEY: str = os.getenv("DO_SPACES_KEY", "")
    DO_SPACES_SECRET: str = os.getenv("DO_SPACES_SECRET", "")
    DO_SPACES_REGION: str = os.getenv("DO_SPACES_REGION", "fra1")
    DO_SPACES_BUCKET: str = os.getenv("DO_SPACES_BUCKET", "hexaistorage")
    DO_SPACES_ENDPOINT: str = os.getenv("DO_SPACES_ENDPOINT", "https://fra1.digitaloceanspaces.com")
    DO_SPACES_PUBLIC_ENDPOINT: str = os.getenv(
        "DO_SPACES_PUBLIC_ENDPOINT",
        "https://hexaistorage.lon1.digitaloceanspaces.com",
    )
    DO_SPACES_PREFIX: str = os.getenv("DO_SPACES_PREFIX", "kambeng")
    
    # Storage Strategy ("local" or "do_spaces")
    STORAGE_STRATEGY: str = os.getenv("STORAGE_STRATEGY", "do_spaces")
    
    # Fees & Commission
    # HexAI charges 2% on all transactions (collections and payouts)
    HEXAI_COLLECTION_FEE_PERCENT: float = float(os.getenv("HEXAI_COLLECTION_FEE_PERCENT", "0.02"))
    HEXAI_WITHDRAWAL_FEE_PERCENT: float = float(os.getenv("HEXAI_WITHDRAWAL_FEE_PERCENT", "0.02"))
    # Kambeng fixed commission per withdrawal in GMD
    PLATFORM_FIXED_COMMISSION_GMD: float = float(os.getenv("PLATFORM_FIXED_COMMISSION_GMD", "10.0"))

    class Config:
        env_file = ".env"

    def validate_required_secrets(self) -> None:
        environment = self.ENVIRONMENT.lower()
        if environment not in {"dev", "test", "prod"}:
            raise RuntimeError("ENVIRONMENT must be one of: dev, test, prod")

        required_by_env = {
            "dev": ["SECRET_KEY"],
            "test": ["SECRET_KEY", "HEXAI_WEBHOOK_SECRET"],
            "prod": [
                "SECRET_KEY",
                "HEXAI_WEBHOOK_SECRET",
                "HEXAI_API_KEY",
                "RESEND_API_KEY",
                "FIELD_ENCRYPTION_KEY",
                "DO_SPACES_KEY",
                "DO_SPACES_SECRET",
            ],
        }

        missing = [name for name in required_by_env[environment] if not getattr(self, name, "")]
        if missing:
            missing_list = ", ".join(missing)
            raise RuntimeError(
                f"Missing required secrets for ENVIRONMENT={environment}: {missing_list}. "
                "Set them in backend/.env or environment variables."
            )

settings = Settings()