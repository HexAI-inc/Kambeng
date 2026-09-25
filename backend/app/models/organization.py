from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.database import Base
import enum


class OrganizationType(str, enum.Enum):
    SCHOOL = "SCHOOL"
    FAITH = "FAITH"  # mosque / church
    HEALTH_CENTRE = "HEALTH_CENTRE"
    COMMUNITY_ASSOCIATION = "COMMUNITY_ASSOCIATION"
    NGO = "NGO"
    ALUMNI_ASSOCIATION = "ALUMNI_ASSOCIATION"
    OTHER = "OTHER"


class OrgVerificationStatus(str, enum.Enum):
    """Same lifecycle as KYCStatus, plus NOT_SUBMITTED for a fresh profile."""
    NOT_SUBMITTED = "NOT_SUBMITTED"
    SUBMITTED = "SUBMITTED"
    REVIEWING = "REVIEWING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class MemberStatus(str, enum.Enum):
    INVITED = "INVITED"
    ACTIVE = "ACTIVE"


class WithdrawalRequestStatus(str, enum.Enum):
    PENDING = "PENDING"  # waiting for a second manager
    APPROVED = "APPROVED"  # approved and the payout was sent
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"  # withdrawn by the requester
    FAILED = "FAILED"  # approved, but the gateway refused the payout


class OrgEvidenceType(str, enum.Enum):
    # NGO Affairs Agency, business registry, Ministry of Education school number
    REGISTRATION_CERTIFICATE = "REGISTRATION_CERTIFICATE"
    # Signed, stamped letter from a head teacher, school management committee,
    # alkalo or imam. The route for village schools and community groups that
    # have no formal registration.
    AUTHORIZATION_LETTER = "AUTHORIZATION_LETTER"


class PayoutAccountHolder(str, enum.Enum):
    ORGANIZATION = "ORGANIZATION"  # the Wave number belongs to the organization
    REPRESENTATIVE = "REPRESENTATIVE"  # the representative's own number, named in the letter


# Statuses during which the verified identity (name, type) and the declared
# payout number are frozen, so they can't be swapped under a reviewer or
# after approval.
ORG_LOCKED_STATUSES = (
    OrgVerificationStatus.SUBMITTED.value,
    OrgVerificationStatus.REVIEWING.value,
    OrgVerificationStatus.APPROVED.value,
)


class Organization(Base):
    """An organization profile carried by a normal user account (the
    representative). Phase 1 of organization support — there is no separate
    org account, membership or permission model; the owner is the only one
    who can manage it."""
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    owner_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    org_type = Column(String, nullable=False)  # OrganizationType
    region = Column(String, nullable=True)
    village = Column(String, nullable=True)
    logo_url = Column(String, nullable=True)
    description = Column(String, nullable=True)
    representative_role = Column(String, nullable=True)  # "Bursar", "PTA chair", "Alumni president"

    # Denormalised from the latest reviewed OrgVerification, like User.kyc_status.
    verification_status = Column(String, default=OrgVerificationStatus.NOT_SUBMITTED.value, nullable=False, index=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(String, nullable=True)
    # Copied from the approved submission. Null means payouts go to the
    # owner's own wave_number.
    payout_wave_number = Column(String, nullable=True)
    payout_account_holder = Column(String, nullable=True)  # PayoutAccountHolder

    # Two-person rule: a withdrawal above this many dalasi needs a second
    # manager's approval before any money moves. Null = no approval needed.
    approval_threshold = Column(Float, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    owner = relationship("User", foreign_keys=[owner_user_id])
    campaigns = relationship("Campaign", back_populates="organization")
    verifications = relationship(
        "OrgVerification", back_populates="organization", cascade="all, delete-orphan",
        order_by="OrgVerification.created_at.desc()",
    )
    # selectin: permission checks read this on every campaign request.
    members = relationship(
        "OrganizationMember", back_populates="organization", cascade="all, delete-orphan",
        lazy="selectin", order_by="OrganizationMember.created_at",
    )

    def active_manager_ids(self) -> set[int]:
        """Everyone who can manage this organization's campaigns: the owner
        (representative) plus accepted members. Requires members loaded."""
        return {self.owner_user_id} | {
            m.user_id for m in self.members if m.status == MemberStatus.ACTIVE.value
        }

    @property
    def is_verified(self) -> bool:
        return self.verification_status == OrgVerificationStatus.APPROVED.value


class OrgVerification(Base):
    """One evidence submission for an organization, reviewed through the same
    admin-queue pattern as KYC. The representative's personal KYC is still
    required separately."""
    __tablename__ = "org_verifications"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    submitted_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    evidence_type = Column(String, nullable=False)  # OrgEvidenceType
    document_file_url = Column(String, nullable=False)
    # Who issued the evidence, e.g. "Head teacher, Sukuta Lower Basic School"
    # or "NGO Affairs Agency, reg. no. 1234".
    issuer = Column(String, nullable=True)

    # Payout account declaration.
    payout_wave_number = Column(String, nullable=False)
    payout_account_holder = Column(String, nullable=False)  # PayoutAccountHolder

    status = Column(String, default=OrgVerificationStatus.SUBMITTED.value, nullable=False, index=True)
    reviewed_by_admin_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    organization = relationship("Organization", back_populates="verifications")
    submitted_by = relationship("User", foreign_keys=[submitted_by_user_id])
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_admin_id])


class OrganizationMember(Base):
    """A team member other than the owner (Phase 4). Members manage the
    organization's campaigns and approve each other's large withdrawals;
    only the owner manages the team, verification and settings."""
    __tablename__ = "organization_members"
    __table_args__ = (UniqueConstraint("organization_id", "user_id", name="uq_organization_members_org_user"),)

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=True)  # "Treasurer", "Head teacher"
    status = Column(String, default=MemberStatus.INVITED.value, nullable=False)
    invited_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    organization = relationship("Organization", back_populates="members")
    user = relationship("User", foreign_keys=[user_id], lazy="selectin")


class WithdrawalRequest(Base):
    """A withdrawal above the organization's approval threshold, waiting for
    a second manager. No money moves until it is approved."""
    __tablename__ = "withdrawal_requests"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    amount = Column(Float, nullable=False)  # gross, whole dalasi
    requested_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String, default=WithdrawalRequestStatus.PENDING.value, nullable=False, index=True)
    decided_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    decided_at = Column(DateTime(timezone=True), nullable=True)
    note = Column(String, nullable=True)  # rejection reason or gateway error
    payout_id = Column(Integer, ForeignKey("payouts.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    requested_by = relationship("User", foreign_keys=[requested_by_user_id], lazy="selectin")
    decided_by = relationship("User", foreign_keys=[decided_by_user_id], lazy="selectin")
