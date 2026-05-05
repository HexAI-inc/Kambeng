from typing import List

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import sqlalchemy as sa

from app.api.routes.auth import get_current_user
from app.api.routes.auth import get_current_user_optional
from app.db.database import get_db
from app.models.campaign import Campaign
from app.models.proof import Proof
from app.models.user import User
from app.models.donation import Donation
from app.core.config import settings
from app.schemas.media import CampaignImageRead, CampaignImageUploadResponse
from app.schemas.proof import ProofRead
from app.services.storage_strategy import get_storage_strategy
from app.services.storage_service import StorageService
from app.core.logging_config import get_logger


router = APIRouter(prefix="/uploads", tags=["Uploads"])
storage = StorageService()
storage_strategy = get_storage_strategy()
logger = get_logger("uploads")

ALLOWED_PROOF_TYPES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "application/pdf": ".pdf",
}


def _validate_proof_signature(content: bytes, content_type: str) -> bool:
    if content_type == "image/png":
        return content.startswith(b"\x89PNG\r\n\x1a\n")
    if content_type == "image/jpeg":
        return content.startswith(b"\xff\xd8\xff")
    if content_type == "application/pdf":
        return content.startswith(b"%PDF-")
    return False


@router.post("/proofs/{slug}", response_model=ProofRead, status_code=status.HTTP_201_CREATED)
async def upload_campaign_proof(
    slug: str,
    file: UploadFile = File(...),
    description: str = Form(default=""),
    document_type: str = Form(default=Proof.ProofType.OTHER.value),
    visibility: str = Form(default=Proof.VisibilityType.ADMIN_ONLY.value),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    campaign_result = await db.execute(select(Campaign).where(Campaign.slug == slug))
    campaign = campaign_result.scalars().first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.user_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized to upload proof for this campaign")

    if file.content_type not in ALLOWED_PROOF_TYPES:
        raise HTTPException(status_code=400, detail="Only PNG, JPEG, and PDF files are supported")

    max_file_size = settings.MAX_PROOF_FILE_SIZE_MB * 1024 * 1024
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    if len(content) > max_file_size:
        raise HTTPException(
            status_code=400,
            detail=f"Proof files must be {settings.MAX_PROOF_FILE_SIZE_MB}MB or smaller",
        )

    if not _validate_proof_signature(content, file.content_type or ""):
        raise HTTPException(status_code=400, detail="File content does not match the declared file type")

    cleaned_description = description.strip() if description else ""
    if len(cleaned_description) > 500:
        raise HTTPException(status_code=400, detail="Description must be 500 characters or fewer")

    # validate document type
    allowed_doc_types = {t.value for t in Proof.ProofType}
    if document_type not in allowed_doc_types:
        raise HTTPException(status_code=400, detail=f"Invalid document_type, must be one of: {', '.join(sorted(allowed_doc_types))}")

    # validate visibility
    allowed_visibility = {t.value for t in Proof.VisibilityType}
    if visibility not in allowed_visibility:
        raise HTTPException(status_code=400, detail=f"Invalid visibility, must be one of: {', '.join(sorted(allowed_visibility))}")

    preferred_extension = ALLOWED_PROOF_TYPES[file.content_type]
    safe_filename = file.filename or f"proof{preferred_extension}"
    if "." not in safe_filename:
        safe_filename = f"{safe_filename}{preferred_extension}"

    file_url = storage.upload_file(content, safe_filename, file.content_type)
    if not file_url:
        raise HTTPException(status_code=500, detail="Unable to upload file to storage")

    new_proof = Proof(
        campaign_id=campaign.id,
        file_url=file_url,
        description=cleaned_description or None,
        document_type=Proof.ProofType(document_type),
        visibility=Proof.VisibilityType(visibility),
        uploaded_by_user_id=current_user.id,
    )
    db.add(new_proof)
    await db.commit()
    await db.refresh(new_proof)
    logger.info(
        "Campaign proof uploaded",
        extra={
            "action": "upload_campaign_proof",
            "user_id": current_user.id,
            "email": current_user.email,
            "document_type": document_type,
            "campaign_id": campaign.id,
            "proof_id": new_proof.id,
            "filename": file.filename,
        },
    )
    return new_proof


@router.get("/proofs/{slug}", response_model=List[ProofRead])
async def list_campaign_proofs(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    campaign_result = await db.execute(select(Campaign).where(Campaign.slug == slug))
    campaign = campaign_result.scalars().first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # Determine viewer role relative to this campaign
    is_owner = bool(current_user and campaign.user_id == current_user.id)
    is_admin = bool(current_user and current_user.role == "ADMIN")
    
    # Check if viewer is a donor to this campaign
    from sqlalchemy import or_
    is_donor = False
    if current_user is not None:
        is_donor_query = await db.execute(
            select(sa.func.count()).select_from(Donation).where(
                (Donation.campaign_id == campaign.id) & (Donation.user_id == current_user.id)
            )
        )
        is_donor = is_donor_query.scalar() > 0

    proof_result = await db.execute(
        select(Proof)
        .where(Proof.campaign_id == campaign.id)
        .order_by(Proof.created_at.desc())
    )
    all_proofs = proof_result.scalars().all()

    # Filter proofs based on visibility and viewer role
    filtered_proofs = []
    for proof in all_proofs:
        if is_owner or is_admin:
            # Campaign owner and admins see all proofs
            filtered_proofs.append(proof)
        elif proof.visibility == Proof.VisibilityType.PUBLIC.value:
            # Everyone sees PUBLIC proofs
            filtered_proofs.append(proof)
        elif proof.visibility == Proof.VisibilityType.DONOR_ONLY.value and is_donor:
            # Donors see DONOR_ONLY proofs
            filtered_proofs.append(proof)
        # ADMIN_ONLY proofs are not shown to non-admin/non-owner viewers

    return filtered_proofs


@router.post("/campaigns/{slug}/images", response_model=CampaignImageUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_campaign_images(
    slug: str,
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    campaign_result = await db.execute(select(Campaign).where(Campaign.slug == slug))
    campaign = campaign_result.scalars().first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.user_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized to upload images for this campaign")

    if not files:
        raise HTTPException(status_code=400, detail="No files were uploaded")

    existing_images = storage_strategy.list_campaign_images(campaign_id=campaign.id)
    max_images = settings.MAX_CAMPAIGN_IMAGES
    if len(existing_images) + len(files) > max_images:
        raise HTTPException(
            status_code=400,
            detail=f"A campaign can only have up to {max_images} images at a time.",
        )

    allowed_types = {"image/png", "image/jpeg", "image/webp", "image/gif"}
    max_image_size_bytes = settings.MAX_CAMPAIGN_IMAGE_SIZE_MB * 1024 * 1024
    uploaded: List[CampaignImageRead] = []

    for upload in files:
        if upload.content_type not in allowed_types:
            raise HTTPException(status_code=400, detail="Only PNG, JPEG, WEBP, and GIF images are supported")

        content = await upload.read()
        if not content:
            raise HTTPException(status_code=400, detail=f"Uploaded image '{upload.filename}' is empty")

        if len(content) > max_image_size_bytes:
            raise HTTPException(
                status_code=400,
                detail=f"Each image must be {settings.MAX_CAMPAIGN_IMAGE_SIZE_MB}MB or smaller.",
            )

        stored = storage_strategy.save_campaign_image(
            campaign_id=campaign.id,
            original_filename=upload.filename or "image.bin",
            content=content,
            content_type=upload.content_type,
        )

        uploaded.append(
            CampaignImageRead(
                file_name=stored["file_name"],
                url=stored["url"],
                size=stored["size"],
                content_type=stored["content_type"],
                original_name=stored["original_name"],
            )
        )

    logger.info(
        "Campaign images uploaded",
        extra={
            "action": "upload_campaign_images",
            "user_id": current_user.id,
            "email": current_user.email,
            "campaign_id": campaign.id,
            "image_count": len(uploaded),
        },
    )

    return CampaignImageUploadResponse(uploaded=uploaded)


@router.get("/campaigns/{slug}/images", response_model=List[CampaignImageRead])
async def list_campaign_images(slug: str, db: AsyncSession = Depends(get_db)):
    campaign_result = await db.execute(select(Campaign).where(Campaign.slug == slug))
    campaign = campaign_result.scalars().first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    images = storage_strategy.list_campaign_images(campaign_id=campaign.id)
    return [
        CampaignImageRead(
            file_name=item["file_name"],
            url=item["url"],
            size=item["size"],
        )
        for item in images
    ]


@router.delete("/campaigns/{slug}/images/{file_name}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_campaign_image(
    slug: str,
    file_name: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    campaign_result = await db.execute(select(Campaign).where(Campaign.slug == slug))
    campaign = campaign_result.scalars().first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.user_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized to delete images for this campaign")

    deleted = storage_strategy.delete_campaign_image(campaign_id=campaign.id, file_name=file_name)
    if not deleted:
        raise HTTPException(status_code=404, detail="Image not found")

    logger.info(
        "Campaign image deleted",
        extra={
            "action": "delete_campaign_image",
            "user_id": current_user.id,
            "email": current_user.email,
            "campaign_id": campaign.id,
            "file_name": file_name,
        },
    )
