from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import jwt
import secrets
from jwt.exceptions import InvalidTokenError

from app.db.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserRead, PasswordResetRequest, PasswordResetConfirm, EmailVerifyRequest
from app.core.security import get_password_hash, verify_password, create_access_token, create_refresh_token
from app.core.config import settings
from app.core.logging_config import get_logger
from app.services.email_service import send_email
from datetime import UTC, datetime, timedelta

router = APIRouter(prefix="/auth", tags=["Authentication"])
logger = get_logger("auth")

# This tells FastAPI where the login URL is, used for Swagger UI and token extraction
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
oauth2_optional_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _normalize_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    """Dependency to securely get the currently logged-in user from the JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        wave_number: str = payload.get("sub")
        if wave_number is None:
            raise credentials_exception
    except InvalidTokenError:
        raise credentials_exception
    
    # Fetch user from DB
    result = await db.execute(select(User).where(User.wave_number == wave_number))
    user = result.scalars().first()
    if user is None:
        raise credentials_exception
    return user


async def get_current_user_optional(
    token: str | None = Depends(oauth2_optional_scheme),
    db: AsyncSession = Depends(get_db),
):
    if not token:
        return None

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        wave_number: str = payload.get("sub")
        if wave_number is None:
            return None
    except InvalidTokenError:
        return None

    result = await db.execute(select(User).where(User.wave_number == wave_number))
    return result.scalars().first()

async def get_admin_user(current_user: User = Depends(get_current_user)):
    """Dependency that only allows admin users"""
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    """Register a new Campaigner"""
    # Check if a user with this Wave number or email already exists
    result = await db.execute(select(User).where((User.wave_number == user_in.wave_number) | (User.email == user_in.email)))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="A user with this Wave number or Email already exists.")
    
    hashed_pwd = get_password_hash(user_in.password)
    new_user = User(
        full_name=user_in.full_name,
        email=user_in.email,
        wave_number=user_in.wave_number,
        password_hash=hashed_pwd
    )
    
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    logger.info(
        "User registered",
        extra={
            "action": "register",
            "user_id": new_user.id,
            "email": new_user.email,
            "role": new_user.role,
        },
    )
    return new_user

@router.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    """Login to get JWT tokens. Supports wave number or email in the username field."""
    result = await db.execute(
        select(User).where((User.wave_number == form_data.username) | (User.email == form_data.username))
    )
    user = result.scalars().first()
    if not user or not verify_password(form_data.password, user.password_hash):
        logger.info("Failed login attempt", extra={"action": "login", "username": form_data.username})
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect Wave number or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # Generate Token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.wave_number, "email": user.email, "role": user.role},
        expires_delta=access_token_expires,
    )
    refresh_token = create_refresh_token(
        data={"sub": user.wave_number, "email": user.email, "role": user.role},
        expires_delta=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    expires_in = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    logger.info(
        "User logged in",
        extra={
            "action": "login",
            "user_id": user.id,
            "email": user.email,
            "role": user.role,
            "ip": None,  # Optionally extract from request if available
        },
    )
    return {
        "status": "success",
        "data": {
            "user": {
                "id": str(user.id),
                "email": user.email,
                "role": user.role,
            },
            "tokens": {
                "accessToken": access_token,
                "refreshToken": refresh_token,
                "expiresIn": expires_in,
            },
        },
    }


@router.post("/refresh")
async def refresh_access_token(payload: dict):
    """Exchange a refresh token for a new access token."""
    refresh_token = payload.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=400, detail="refresh_token is required")

    try:
        decoded = jwt.decode(refresh_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    if decoded.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token type")

    wave_number = decoded.get("sub")
    if not wave_number:
        raise HTTPException(status_code=401, detail="Invalid refresh token payload")

    access_token = create_access_token(
        data={
            "sub": wave_number,
            "email": decoded.get("email"),
            "role": decoded.get("role"),
        },
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    expires_in = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    logger.info(
        "Access token refreshed",
        extra={
            "action": "refresh_token",
            "sub": wave_number,
            "email": decoded.get("email"),
            "role": decoded.get("role"),
        },
    )

    return {
        "status": "success",
        "data": {
            "tokens": {
                "accessToken": access_token,
                "refreshToken": refresh_token,
                "expiresIn": expires_in,
            }
        },
    }

@router.get("/me", response_model=UserRead)
async def get_my_profile(current_user: User = Depends(get_current_user)):
    """Get the currently logged-in user's details"""
    return current_user

@router.post("/request-password-reset")
async def request_password_reset(payload: PasswordResetRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalars().first()
    if user:
        reset_token = create_access_token(data={"sub": user.wave_number}, expires_delta=timedelta(minutes=15))
        # Send an email with the reset code/link
        send_email(
            user.email,
            "Kambeng - Password Reset",
            f"<p>Hi {user.full_name},</p><p>We received a request to reset your password. Use this token: <strong>{reset_token}</strong></p>"
        )
    logger.info("Password reset requested", extra={"action": "request_password_reset", "email": payload.email})
    return {"message": "If an account with that email exists, a reset link has been sent via Email."}

@router.post("/reset-password")
async def reset_password(payload: PasswordResetConfirm, db: AsyncSession = Depends(get_db)):
    try:
        decoded = jwt.decode(payload.token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        wave_number = decoded.get("sub")
        if wave_number is None:
            raise HTTPException(status_code=400, detail="Invalid token")
    except InvalidTokenError:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    result = await db.execute(select(User).where(User.wave_number == wave_number))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password_hash = get_password_hash(payload.new_password)
    await db.commit()
    logger.info(
        "Password reset completed",
        extra={"action": "reset_password", "user_id": user.id, "email": user.email},
    )
    return {"message": "Password successfully reset"}

@router.post("/request-email-verification")
async def request_email_verification(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.is_email_verified:
        raise HTTPException(status_code=400, detail="Email already verified")
    
    verification_code = f"{secrets.randbelow(1_000_000):06d}"
    current_user.email_verification_code_hash = get_password_hash(verification_code)
    current_user.email_verification_expires_at = _utc_now() + timedelta(minutes=10)

    db.add(current_user)
    await db.commit()

    send_email(
        current_user.email,
        "Verify your Kambeng Account",
        f"<p>Your Kambeng email verification code is: <strong>{verification_code}</strong></p><p>This code expires in 10 minutes.</p>"
    )
    logger.info(
        "Email verification requested",
        extra={"action": "request_email_verification", "user_id": current_user.id, "email": current_user.email},
    )
    return {"message": "Verification code sent via Email."}

@router.post("/verify-email")
async def verify_email(payload: EmailVerifyRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.email_verification_code_hash:
        raise HTTPException(status_code=400, detail="No verification code requested")

    if not current_user.email_verification_expires_at:
        raise HTTPException(status_code=400, detail="Verification code expired")

    if _normalize_utc(current_user.email_verification_expires_at) < _utc_now():
        raise HTTPException(status_code=400, detail="Verification code expired")

    is_valid = verify_password(payload.code, current_user.email_verification_code_hash)

    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid verification code")
    
    current_user.is_email_verified = True
    current_user.email_verification_code_hash = None
    current_user.email_verification_expires_at = None
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    logger.info(
        "Email verified",
        extra={"action": "verify_email", "user_id": current_user.id, "email": current_user.email},
    )
    return {"message": "Email address successfully verified"}