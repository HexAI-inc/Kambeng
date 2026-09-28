from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, EmailStr, field_validator
from typing import List, Optional

from app.models.campaign import CAMPAIGN_CATEGORIES
from app.services.profile_handles import handle_problem, normalize_handle

MAX_FAVORITE_CAUSES = 3
from datetime import datetime

class UserBase(BaseModel):
    full_name: str
    email: EmailStr
    wave_number: str = Field(..., description="Gambian Wave number, e.g., +2201234567")

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    wave_number: str
    password: str

class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str

class EmailVerifyRequest(BaseModel):
    code: str | None = None
    email: EmailStr | None = None
    wave_number: str | None = None


class EmailVerificationResendRequest(BaseModel):
    email: EmailStr | None = None
    wave_number: str | None = None
    code: str | None = None

# Allowed hosts per social network; "website" accepts any host.
SOCIAL_HOSTS = {
    "facebook": ("facebook.com", "fb.com"),
    "instagram": ("instagram.com",),
    "x": ("x.com", "twitter.com"),
    "tiktok": ("tiktok.com",),
    "linkedin": ("linkedin.com",),
}


class SocialLinks(BaseModel):
    """Public links on an organizer profile. Blank clears a link."""
    website: Optional[str] = Field(default=None, max_length=200)
    facebook: Optional[str] = Field(default=None, max_length=200)
    instagram: Optional[str] = Field(default=None, max_length=200)
    x: Optional[str] = Field(default=None, max_length=200)
    tiktok: Optional[str] = Field(default=None, max_length=200)
    linkedin: Optional[str] = Field(default=None, max_length=200)

    @field_validator("*")
    @classmethod
    def normalize_url(cls, value: Optional[str], info) -> Optional[str]:
        value = (value or "").strip()
        if not value:
            return None
        if not value.lower().startswith(("http://", "https://")):
            value = f"https://{value}"
        parsed = urlparse(value)
        host = (parsed.hostname or "").lower()
        if parsed.scheme not in ("http", "https") or "." not in host:
            raise ValueError("Enter a valid link, e.g. https://example.com")
        allowed = SOCIAL_HOSTS.get(info.field_name)
        if allowed and not any(host == h or host.endswith(f".{h}") for h in allowed):
            raise ValueError(f"That doesn't look like a {info.field_name} link")
        return value


class UserProfileUpdate(BaseModel):
    """Fields a user can update on their own account."""
    full_name: Optional[str] = None
    bio: Optional[str] = Field(default=None, max_length=500)
    location: Optional[str] = Field(default=None, max_length=80)
    social_links: Optional[SocialLinks] = None
    show_supported_campaigns: Optional[bool] = None
    # "" clears the handle
    handle: Optional[str] = Field(default=None, max_length=31)
    favorite_causes: Optional[List[str]] = None
    account_purpose: Optional[str] = Field(default=None, pattern="^(DONATE|FUNDRAISE)$")
    email: Optional[EmailStr] = None
    wave_number: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


    @field_validator("handle")
    @classmethod
    def validate_handle(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = normalize_handle(value)
        if value and (problem := handle_problem(value)):
            raise ValueError(problem)
        return value

    @field_validator("favorite_causes")
    @classmethod
    def validate_causes(cls, value: Optional[List[str]]) -> Optional[List[str]]:
        if value is None:
            return None
        causes = list(dict.fromkeys(v.strip().lower() for v in value if v.strip()))
        if len(causes) > MAX_FAVORITE_CAUSES:
            raise ValueError(f"Pick at most {MAX_FAVORITE_CAUSES} causes")
        unknown = [c for c in causes if c not in CAMPAIGN_CATEGORIES]
        if unknown:
            raise ValueError(f"Unknown cause: {', '.join(unknown)}")
        return causes


class AdminUserUpdate(BaseModel):
    """Fields an admin can update on any user account."""
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    wave_number: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    kyc_status: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class UserRead(UserBase):
    id: int
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    cover_url: Optional[str] = None
    handle: Optional[str] = None
    favorite_causes: Optional[List[str]] = None
    location: Optional[str] = None
    social_links: Optional[dict[str, str]] = None
    show_supported_campaigns: bool = False
    account_purpose: Optional[str] = None
    email: str
    is_email_verified: bool
    role: str
    is_active: bool
    kyc_status: Optional[str] = None
    kyc_verified_at: Optional[datetime] = None
    kyc_rejection_reason: Optional[str] = None
    created_at: datetime

    # This tells Pydantic to read data from SQLAlchemy models
    model_config = ConfigDict(from_attributes=True)