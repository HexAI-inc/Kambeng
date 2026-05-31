from pydantic import BaseModel, ConfigDict, Field, EmailStr
from typing import Optional
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

class UserRead(UserBase):
    id: int
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