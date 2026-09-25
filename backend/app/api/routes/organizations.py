"""Organization profiles (Phase 1) and organization verification (Phase 2).

An organization is a profile on a normal user account, not an account of its
own. Its representative still does personal KYC; on top of that they submit
evidence that they may raise money for the organization. Withdrawals from an
organization campaign need both approved (see payments.withdraw_funds).
"""
from datetime import UTC, datetime
from typing import List, Optional

from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.api.routes.admin import _log_audit_action
from app.api.routes.auth import get_admin_user, get_current_user
from app.api.routes.uploads import _to_public_media_url
from app.core.config import settings
from app.core.logging_config import get_logger
from app.db.database import get_db
from app.models.audit_log import AuditActionType
from app.models.campaign import Campaign
from app.models.kyc_notification_email import KYCNotificationEmail
from app.models.organization import (
    ORG_LOCKED_STATUSES,
    MemberStatus,
    Organization,
    OrganizationMember,
    OrgEvidenceType,
    OrgVerification,
    OrgVerificationStatus,
    PayoutAccountHolder,
)
from app.models.user import User
from app.schemas.organization import (
    AdminOrgVerificationRead,
    MemberInvite,
    OrganizationCreate,
    OrganizationInvitation,
    OrganizationMemberRead,
    OrganizationPublic,
    OrganizationRead,
    OrganizationUpdate,
    OrgVerificationRead,
    OrgVerificationRejectRequest,
    normalize_wave_number,
)
from app.services.email_service import (
    render_org_verification_approved_email,
    render_org_verification_rejected_email,
    render_org_verification_submission_review,
    render_organization_invite_email,
    send_email,
)
from app.services.storage_strategy import get_storage_strategy

router = APIRouter(prefix="/organizations", tags=["Organizations"])
admin_router = APIRouter(prefix="/admin/org-verifications", tags=["Admin"])
storage_strategy = get_storage_strategy()
logger = get_logger("organizations")

MAX_ORGANIZATIONS_PER_USER = 10
MAX_MEMBERS_PER_ORGANIZATION = 20
MAX_LOGO_BYTES = 5 * 1024 * 1024
MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
LOGO_TYPES = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}
DOCUMENT_TYPES = {"image/png": "png", "image/jpeg": "jpg", "application/pdf": "pdf"}
PENDING_STATUSES = (OrgVerificationStatus.SUBMITTED.value, OrgVerificationStatus.REVIEWING.value)


def _org_read(org: Organization, viewer: User) -> OrganizationRead:
    """Requires org.verifications and org.owner to be loaded."""
    read = OrganizationRead.model_validate(org)
    if org.verifications:
        read.latest_verification = OrgVerificationRead.model_validate(org.verifications[0])
    read.my_role = "OWNER" if viewer.id == org.owner_user_id or viewer.role == "ADMIN" else "MANAGER"
    read.owner_name = org.owner.full_name if org.owner else None
    read.members = [
        OrganizationMemberRead(
            id=m.id, user_id=m.user_id, full_name=m.user.full_name if m.user else None, title=m.title,
            status=m.status, kyc_verified=bool(m.user and m.user.kyc_status == "APPROVED"),
            accepted_at=m.accepted_at, created_at=m.created_at,
        )
        for m in org.members
    ]
    return read


async def _load_org(db: AsyncSession, organization_id: int) -> Organization:
    result = await db.execute(
        select(Organization)
        .options(selectinload(Organization.verifications), selectinload(Organization.owner))
        .where(Organization.id == organization_id)
        # Re-fetches after a commit must pick up new verification/member rows.
        .execution_options(populate_existing=True)
    )
    org = result.scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


async def _get_owned_org(db: AsyncSession, organization_id: int, user: User) -> Organization:
    """Owner-only actions: team, verification, settings."""
    org = await _load_org(db, organization_id)
    if org.owner_user_id != user.id and user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Only the organization's owner can do this")
    return org


async def _get_managed_org(db: AsyncSession, organization_id: int, user: User) -> Organization:
    """Read access for the whole team."""
    org = await _load_org(db, organization_id)
    if user.id not in org.active_manager_ids() and user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized to view this organization")
    return org


async def _read_upload(file: UploadFile, allowed: dict[str, str], max_bytes: int, what: str) -> tuple[bytes, str]:
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail=f"Unsupported {what} type. Allowed: {', '.join(sorted(set(allowed.values())))}")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    if len(content) > max_bytes:
        raise HTTPException(status_code=400, detail=f"File too large. Maximum size is {max_bytes // (1024 * 1024)}MB")
    return content, allowed[file.content_type]


# ===== Owner endpoints =====

@router.post("", response_model=OrganizationRead, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=OrganizationRead, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def create_organization(
    body: OrganizationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = (await db.execute(
        select(func.count(Organization.id)).where(Organization.owner_user_id == current_user.id)
    )).scalar() or 0
    if count >= MAX_ORGANIZATIONS_PER_USER:
        raise HTTPException(status_code=400, detail=f"You can add at most {MAX_ORGANIZATIONS_PER_USER} organizations")

    org = Organization(owner_user_id=current_user.id, **body.model_dump())
    org.org_type = body.org_type.value
    db.add(org)
    await db.commit()

    logger.info("Organization created", extra={"action": "create_organization", "user_id": current_user.id, "organization_id": org.id})
    return _org_read(await _get_owned_org(db, org.id, current_user), current_user)


@router.get("/me", response_model=List[OrganizationRead])
async def list_my_organizations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member_of = select(OrganizationMember.organization_id).where(
        OrganizationMember.user_id == current_user.id,
        OrganizationMember.status == MemberStatus.ACTIVE.value,
    )
    result = await db.execute(
        select(Organization)
        .options(selectinload(Organization.verifications), selectinload(Organization.owner))
        .where(or_(Organization.owner_user_id == current_user.id, Organization.id.in_(member_of)))
        .order_by(Organization.created_at.asc())
    )
    return [_org_read(org, current_user) for org in result.scalars().all()]


# ===== Team (Phase 4) =====
# Declared before /{organization_id} so "invitations" isn't parsed as an id.

@router.get("/invitations/me", response_model=List[OrganizationInvitation])
async def list_my_invitations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (await db.execute(
        select(OrganizationMember, Organization, User)
        .join(Organization, Organization.id == OrganizationMember.organization_id)
        .outerjoin(User, User.id == OrganizationMember.invited_by_user_id)
        .where(OrganizationMember.user_id == current_user.id, OrganizationMember.status == MemberStatus.INVITED.value)
        .order_by(OrganizationMember.created_at.desc())
    )).all()
    return [
        OrganizationInvitation(
            member_id=member.id,
            organization=OrganizationPublic.model_validate(org),
            title=member.title,
            invited_by_name=inviter.full_name if inviter else None,
            created_at=member.created_at,
        )
        for member, org, inviter in rows
    ]


async def _get_my_invitation(db: AsyncSession, member_id: int, user: User) -> OrganizationMember:
    member = (await db.execute(select(OrganizationMember).where(OrganizationMember.id == member_id))).scalars().first()
    if not member or member.user_id != user.id or member.status != MemberStatus.INVITED.value:
        raise HTTPException(status_code=404, detail="Invitation not found")
    return member


@router.post("/invitations/{member_id}/accept", response_model=OrganizationRead)
async def accept_invitation(
    member_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = await _get_my_invitation(db, member_id, current_user)
    member.status = MemberStatus.ACTIVE.value
    member.accepted_at = datetime.now(UTC)
    await db.commit()
    logger.info("Organization invitation accepted", extra={"action": "org_member_accepted", "user_id": current_user.id, "organization_id": member.organization_id})
    return _org_read(await _get_managed_org(db, member.organization_id, current_user), current_user)


@router.post("/invitations/{member_id}/decline", status_code=status.HTTP_204_NO_CONTENT)
async def decline_invitation(
    member_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = await _get_my_invitation(db, member_id, current_user)
    await db.delete(member)
    await db.commit()


@router.post("/{organization_id}/members", response_model=OrganizationRead, status_code=status.HTTP_201_CREATED)
async def invite_member(
    organization_id: int,
    body: MemberInvite,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Invite an existing Kambeng user, by Wave number or email, to help manage."""
    org = await _get_owned_org(db, organization_id, current_user)
    if len(org.members) >= MAX_MEMBERS_PER_ORGANIZATION:
        raise HTTPException(status_code=400, detail=f"An organization can have at most {MAX_MEMBERS_PER_ORGANIZATION} team members")

    identifier = body.identifier.strip()
    if "@" in identifier:
        condition = func.lower(User.email) == identifier.lower()
    else:
        try:
            condition = User.wave_number == normalize_wave_number(identifier)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
    invitee = (await db.execute(select(User).where(condition))).scalars().first()
    if not invitee:
        raise HTTPException(
            status_code=404,
            detail="No Kambeng account uses that Wave number or email. Ask them to sign up first, then invite them.",
        )
    if invitee.id == org.owner_user_id:
        raise HTTPException(status_code=400, detail="That's the organization's owner.")
    if any(m.user_id == invitee.id for m in org.members):
        raise HTTPException(status_code=409, detail="They're already on the team (or invited).")

    member = OrganizationMember(
        organization_id=org.id, user_id=invitee.id, title=body.title,
        invited_by_user_id=current_user.id, status=MemberStatus.INVITED.value,
    )
    db.add(member)
    await db.commit()
    logger.info("Organization member invited", extra={"action": "org_member_invited", "user_id": current_user.id, "organization_id": org.id, "invitee_id": invitee.id})

    if invitee.email:
        try:
            send_email(
                invitee.email,
                f"{current_user.full_name or 'Someone'} invited you to manage {org.name}",
                render_organization_invite_email(
                    full_name=invitee.full_name or invitee.email,
                    inviter_name=current_user.full_name or current_user.email,
                    organization_name=org.name,
                    title=body.title,
                    accept_link=f"{settings.FRONTEND_URL.rstrip('/')}/dashboard/organizations",
                ),
            )
        except Exception:
            logger.exception("Failed to send organization invite email", extra={"member_id": member.id})

    return _org_read(await _get_owned_org(db, organization_id, current_user), current_user)


@router.delete("/{organization_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    organization_id: int,
    member_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The owner removes anyone; a member can remove themselves (leave)."""
    org = await _load_org(db, organization_id)
    member = next((m for m in org.members if m.id == member_id), None)
    if member is None:
        raise HTTPException(status_code=404, detail="Team member not found")
    if current_user.id not in (org.owner_user_id, member.user_id) and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Only the owner can remove other team members")
    await db.delete(member)
    await db.commit()
    logger.info("Organization member removed", extra={"action": "org_member_removed", "user_id": current_user.id, "organization_id": org.id, "removed_user_id": member.user_id})


@router.get("/public/{organization_id}", response_model=OrganizationPublic)
async def get_public_organization(organization_id: int, db: AsyncSession = Depends(get_db)):
    org = (await db.execute(select(Organization).where(Organization.id == organization_id))).scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


@router.get("/{organization_id}", response_model=OrganizationRead)
async def get_organization(
    organization_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _org_read(await _get_managed_org(db, organization_id, current_user), current_user)


@router.patch("/{organization_id}", response_model=OrganizationRead)
async def update_organization(
    organization_id: int,
    body: OrganizationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org = await _get_owned_org(db, organization_id, current_user)
    changes = body.model_dump(exclude_unset=True)

    # Name and type are what the reviewer verified — they can't change under
    # a pending review or after approval.
    identity_changed = (
        ("name" in changes and changes["name"] != org.name)
        or ("org_type" in changes and changes["org_type"] is not None and changes["org_type"].value != org.org_type)
    )
    if identity_changed and org.verification_status in ORG_LOCKED_STATUSES:
        raise HTTPException(
            status_code=409,
            detail="The name and type of a verified (or in-review) organization can't be changed. Contact support if they are wrong.",
        )

    if "approval_threshold" in changes and changes["approval_threshold"] is not None:
        active_members = [m for m in org.members if m.status == MemberStatus.ACTIVE.value]
        if not active_members:
            raise HTTPException(
                status_code=400,
                detail="Add a second team member first — someone has to be able to approve large withdrawals.",
            )

    for field, value in changes.items():
        if field in ("name", "org_type") and value is None:
            continue
        setattr(org, field, value.value if field == "org_type" else value)

    await db.commit()
    return _org_read(await _get_owned_org(db, organization_id, current_user), current_user)


@router.post("/{organization_id}/logo", response_model=OrganizationRead)
async def upload_organization_logo(
    organization_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org = await _get_owned_org(db, organization_id, current_user)
    content, extension = await _read_upload(file, LOGO_TYPES, MAX_LOGO_BYTES, "logo")
    org.logo_url = _to_public_media_url(storage_strategy.save_organization_file(
        organization_id=org.id, file_content=content, file_extension=extension,
        content_type=file.content_type, public=True,
    ))
    await db.commit()
    return _org_read(await _get_owned_org(db, organization_id, current_user), current_user)


@router.post("/{organization_id}/verification", response_model=OrganizationRead, status_code=status.HTTP_201_CREATED)
async def submit_organization_verification(
    organization_id: int,
    evidence_type: OrgEvidenceType = Form(...),
    payout_account_holder: PayoutAccountHolder = Form(...),
    payout_wave_number: str = Form(...),
    issuer: Optional[str] = Form(default=None),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit evidence that the representative may raise money for this
    organization, plus the payout account declaration.

    Resubmitting for an already-verified organization (e.g. to change the
    payout number) puts it back under review, which pauses withdrawals."""
    org = await _get_owned_org(db, organization_id, current_user)
    if org.owner_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the organization's representative can submit verification")
    if org.verification_status in PENDING_STATUSES:
        raise HTTPException(status_code=400, detail="This organization already has a submission under review.")

    try:
        payout_number = normalize_wave_number(payout_wave_number)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if payout_account_holder == PayoutAccountHolder.REPRESENTATIVE:
        # A personal number is only acceptable when a letter authorizes it,
        # and it has to be the representative's own (KYC'd) number.
        if evidence_type != OrgEvidenceType.AUTHORIZATION_LETTER:
            raise HTTPException(
                status_code=400,
                detail="Payouts to your personal number need an authorization letter that names that number.",
            )
        try:
            own_number = normalize_wave_number(current_user.wave_number or "")
        except ValueError:
            own_number = None
        if payout_number != own_number:
            raise HTTPException(
                status_code=400,
                detail="A personal payout number must be the Wave number on your own account.",
            )

    content, extension = await _read_upload(file, DOCUMENT_TYPES, MAX_DOCUMENT_BYTES, "document")
    document_url = _to_public_media_url(storage_strategy.save_organization_file(
        organization_id=org.id, file_content=content, file_extension=extension,
        content_type=file.content_type, public=False,
    ))

    submission = OrgVerification(
        organization_id=org.id,
        submitted_by_user_id=current_user.id,
        evidence_type=evidence_type.value,
        document_file_url=document_url,
        issuer=(issuer or "").strip()[:200] or None,
        payout_wave_number=payout_number,
        payout_account_holder=payout_account_holder.value,
        status=OrgVerificationStatus.SUBMITTED.value,
    )
    db.add(submission)
    org.verification_status = OrgVerificationStatus.SUBMITTED.value
    org.rejection_reason = None
    await db.commit()

    logger.info(
        "Organization verification submitted",
        extra={
            "action": "submit_org_verification",
            "user_id": current_user.id,
            "organization_id": org.id,
            "verification_id": submission.id,
            "evidence_type": evidence_type.value,
        },
    )

    # Same compliance recipients as KYC submissions.
    try:
        recipients = (await db.execute(
            select(KYCNotificationEmail).where(KYCNotificationEmail.is_active.is_(True))
        )).scalars().all()
        if recipients:
            html = render_org_verification_submission_review(
                full_name=current_user.full_name or "(no name)",
                user_email=current_user.email,
                organization_name=org.name,
                evidence_type=evidence_type.value.replace("_", " ").title(),
                review_link=f"{settings.FRONTEND_URL.rstrip('/')}/admin/org-verifications/{submission.id}",
            )
            for r in recipients:
                try:
                    send_email(r.email, f"New organization verification: {org.name}", html)
                except Exception:
                    logger.exception("Failed to send org verification notification", extra={"recipient": r.email})
    except Exception:
        logger.exception("Failed to fan-out org verification notification emails")

    return _org_read(await _get_owned_org(db, organization_id, current_user), current_user)


# ===== Admin review queue =====

async def _admin_read(db: AsyncSession, submission: OrgVerification) -> AdminOrgVerificationRead:
    org = submission.organization
    submitter = submission.submitted_by
    campaign_count = (await db.execute(
        select(func.count(Campaign.id)).where(Campaign.organization_id == org.id)
    )).scalar() or 0
    base = OrgVerificationRead.model_validate(submission).model_dump()
    return AdminOrgVerificationRead(
        **base,
        organization=OrganizationPublic.model_validate(org),
        organization_verification_status=org.verification_status,
        submitter_name=submitter.full_name if submitter else None,
        submitter_email=submitter.email if submitter else None,
        submitter_wave_number=submitter.wave_number if submitter else None,
        submitter_kyc_status=submitter.kyc_status if submitter else None,
        campaign_count=campaign_count,
    )


async def _get_submission(db: AsyncSession, submission_id: int) -> OrgVerification:
    result = await db.execute(
        select(OrgVerification)
        .options(selectinload(OrgVerification.organization), selectinload(OrgVerification.submitted_by))
        .where(OrgVerification.id == submission_id)
        .execution_options(populate_existing=True)
    )
    submission = result.scalars().first()
    if not submission:
        raise HTTPException(status_code=404, detail="Verification submission not found")
    return submission


@admin_router.get("", response_model=List[AdminOrgVerificationRead])
async def list_org_verification_queue(
    status: Optional[str] = Query(default=None, description="Filter by status; defaults to pending (SUBMITTED + REVIEWING)"),
    skip: int = 0,
    limit: int = Query(default=100, le=500),
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user),
):
    query = select(OrgVerification).options(
        selectinload(OrgVerification.organization), selectinload(OrgVerification.submitted_by)
    )
    if status == "ALL":
        pass
    elif status:
        if status not in [s.value for s in OrgVerificationStatus]:
            raise HTTPException(status_code=400, detail="Invalid status")
        query = query.where(OrgVerification.status == status)
    else:
        query = query.where(OrgVerification.status.in_(PENDING_STATUSES))

    result = await db.execute(query.order_by(OrgVerification.created_at.asc()).offset(skip).limit(limit))
    return [await _admin_read(db, s) for s in result.scalars().all()]


@admin_router.get("/{submission_id}", response_model=AdminOrgVerificationRead)
async def get_org_verification(
    submission_id: int,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user),
):
    return await _admin_read(db, await _get_submission(db, submission_id))


@admin_router.post("/{submission_id}/approve", response_model=AdminOrgVerificationRead)
async def approve_org_verification(
    submission_id: int,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user),
):
    submission = await _get_submission(db, submission_id)
    if submission.status not in PENDING_STATUSES:
        raise HTTPException(status_code=409, detail=f"Submission has already been processed ({submission.status})")

    now = datetime.now(UTC)
    submission.status = OrgVerificationStatus.APPROVED.value
    submission.reviewed_by_admin_id = admin_user.id
    submission.reviewed_at = now
    submission.rejection_reason = None

    org = submission.organization
    org.verification_status = OrgVerificationStatus.APPROVED.value
    org.verified_at = now
    org.rejection_reason = None
    # The declared payout account becomes the one withdrawals use.
    org.payout_wave_number = submission.payout_wave_number
    org.payout_account_holder = submission.payout_account_holder
    await db.commit()

    await _log_audit_action(
        db,
        action_type=AuditActionType.ORG_VERIFICATION_APPROVED,
        performed_by_admin_id=admin_user.id,
        target_entity_type="OrgVerification",
        target_entity_id=submission.id,
        target_user_id=submission.submitted_by_user_id,
        description=f"Organization '{org.name}' verified ({submission.evidence_type}); payouts to {submission.payout_wave_number} ({submission.payout_account_holder})",
    )

    submitter = submission.submitted_by
    if submitter and submitter.email:
        try:
            html = render_org_verification_approved_email(
                full_name=submitter.full_name or submitter.email,
                organization_name=org.name,
                payout_wave_number=submission.payout_wave_number,
                dashboard_link=f"{settings.FRONTEND_URL.rstrip('/')}/dashboard/organizations",
            )
            send_email(submitter.email, f"{org.name} is now a verified organization", html)
        except Exception:
            logger.exception("Failed to send org verification approval email", extra={"submission_id": submission.id})

    return await _admin_read(db, await _get_submission(db, submission_id))


@admin_router.post("/{submission_id}/reject", response_model=AdminOrgVerificationRead)
async def reject_org_verification(
    submission_id: int,
    payload: OrgVerificationRejectRequest = Body(...),
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user),
):
    submission = await _get_submission(db, submission_id)
    if submission.status not in PENDING_STATUSES:
        raise HTTPException(status_code=409, detail=f"Submission has already been processed ({submission.status})")

    reason = payload.rejection_reason.strip()
    submission.status = OrgVerificationStatus.REJECTED.value
    submission.reviewed_by_admin_id = admin_user.id
    submission.reviewed_at = datetime.now(UTC)
    submission.rejection_reason = reason

    org = submission.organization
    org.verification_status = OrgVerificationStatus.REJECTED.value
    org.verified_at = None
    org.rejection_reason = reason
    await db.commit()

    await _log_audit_action(
        db,
        action_type=AuditActionType.ORG_VERIFICATION_REJECTED,
        performed_by_admin_id=admin_user.id,
        target_entity_type="OrgVerification",
        target_entity_id=submission.id,
        target_user_id=submission.submitted_by_user_id,
        description=f"Organization '{org.name}' verification rejected",
        details=reason,
    )

    submitter = submission.submitted_by
    if submitter and submitter.email:
        try:
            html = render_org_verification_rejected_email(
                full_name=submitter.full_name or submitter.email,
                organization_name=org.name,
                rejection_reason=reason,
                dashboard_link=f"{settings.FRONTEND_URL.rstrip('/')}/dashboard/organizations",
            )
            send_email(submitter.email, f"Action needed: verification for {org.name}", html)
        except Exception:
            logger.exception("Failed to send org verification rejection email", extra={"submission_id": submission.id})

    return await _admin_read(db, await _get_submission(db, submission_id))
