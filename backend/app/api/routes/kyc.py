from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import cast, String
from datetime import UTC, datetime

from app.api.routes.auth import get_current_user
from app.db.database import get_db
from app.models.kyc import KYC, KYCDocumentType, KYCStatus
from app.models.user import User
from app.schemas.kyc import KYCSubmit, KYCRead, KYCStatusResponse
from app.services.storage_strategy import get_storage_strategy
from app.core.config import settings
from app.core.logging_config import get_logger

router = APIRouter(prefix="/kyc", tags=["KYC"])
storage_strategy = get_storage_strategy()
logger = get_logger("kyc")


@router.post("/submit", response_model=KYCRead, status_code=status.HTTP_201_CREATED)
async def submit_kyc(
    document_type: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit KYC documents for identity verification.
    
    Only one active submission per user allowed at a time. Resubmission requires previous submission to be reviewed.
    """
    # Validate document type
    try:
        doc_type_enum = KYCDocumentType(document_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid document_type. Must be one of: {', '.join([dt.value for dt in KYCDocumentType])}")
    
    # Check for existing active submissions
    active_submission = await db.execute(
        select(KYC).where(
            (KYC.user_id == current_user.id) & 
            (cast(KYC.status, String).in_([KYCStatus.SUBMITTED.value, KYCStatus.REVIEWING.value]))
        )
    )
    if active_submission.scalars().first():
        raise HTTPException(status_code=400, detail="You already have an active KYC submission. Please wait for review.")
    
    # Validate file
    allowed_types = {"image/png", "image/jpeg", "application/pdf"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only PNG, JPEG, and PDF files are supported")
    
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    
    # Check file size (max 10MB for KYC documents)
    max_size_mb = 10
    max_size_bytes = max_size_mb * 1024 * 1024
    if len(content) > max_size_bytes:
        raise HTTPException(status_code=400, detail=f"File too large. Maximum size is {max_size_mb}MB")
    
    # Save document
    file_url = storage_strategy.save_kyc_document(
        user_id=current_user.id,
        document_type=doc_type_enum,
        file_content=content,
        file_extension=file.filename.split('.')[-1] if file.filename else 'bin'
    )
    
    # Create KYC submission record
    kyc_submission = KYC(
        user_id=current_user.id,
        document_type=doc_type_enum,
        document_file_url=file_url,
        status=KYCStatus.SUBMITTED
    )
    db.add(kyc_submission)
    
    # Update user KYC status
    current_user.kyc_status = KYCStatus.SUBMITTED.value
    
    await db.commit()
    await db.refresh(kyc_submission)
    logger.info(
        "KYC submitted",
        extra={
            "action": "submit_kyc",
            "user_id": current_user.id,
            "email": current_user.email,
            "document_type": doc_type_enum.value,
            "kyc_id": kyc_submission.id,
        },
    )
    return kyc_submission


@router.get("/status", response_model=KYCStatusResponse)
async def get_kyc_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current user's KYC verification status."""
    # Get the latest KYC submission
    latest_submission = await db.execute(
        select(KYC)
        .where(KYC.user_id == current_user.id)
        .order_by(KYC.created_at.desc())
        .limit(1)
    )
    submission = latest_submission.scalars().first()

    logger.info(
        "KYC status viewed",
        extra={
            "action": "get_kyc_status",
            "user_id": current_user.id,
            "email": current_user.email,
            "kyc_status": current_user.kyc_status or "NOT_SUBMITTED",
        },
    )
    
    return KYCStatusResponse(
        status=current_user.kyc_status or "NOT_SUBMITTED",
        last_submission_id=submission.id if submission else None,
        last_submission_date=submission.created_at if submission else None,
        rejection_reason=current_user.kyc_rejection_reason
    )
