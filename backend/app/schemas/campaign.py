from pydantic import BaseModel, ConfigDict, field_validator, model_validator
from typing import List, Literal, Optional
from datetime import datetime
import re
from app.models.campaign import CAMPAIGN_CATEGORIES, CampaignMode, CampaignStatus
from app.schemas.money import WholeDalasi
from app.schemas.organization import OrganizationPublic

BeneficiaryType = Literal["self", "someone_else", "organization"]

MAX_TAGS = 8
MAX_TAG_LENGTH = 32
_TAG_JUNK = re.compile(r"[^a-z0-9 &-]+")


def normalize_category(value: Optional[str]) -> Optional[str]:
    if value is None or not value.strip():
        return None
    value = value.strip().lower()
    if value not in CAMPAIGN_CATEGORIES:
        raise ValueError(f"category must be one of: {', '.join(CAMPAIGN_CATEGORIES)}")
    return value


def normalize_tags(values: Optional[List[str]]) -> List[str]:
    """Lowercase, strip '#' and punctuation, collapse whitespace, dedupe
    (order kept). 'Clean Water!' and '#clean  water' become the same tag."""
    tags: List[str] = []
    for raw in values or []:
        tag = " ".join(_TAG_JUNK.sub(" ", str(raw).lower()).split())
        if not tag or tag in tags:
            continue
        if len(tag) > MAX_TAG_LENGTH:
            raise ValueError(f"tags must be at most {MAX_TAG_LENGTH} characters")
        tags.append(tag)
    if len(tags) > MAX_TAGS:
        raise ValueError(f"a campaign can have at most {MAX_TAGS} tags")
    return tags


class CampaignClassification(BaseModel):
    """Category + tags — settable at creation and editable afterwards."""
    category: Optional[str] = None
    tags: List[str] = []

    _normalize_category = field_validator("category")(normalize_category)
    _normalize_tags = field_validator("tags")(normalize_tags)

class CampaignBase(BaseModel):
    title: str
    description: str
    mode: CampaignMode # TARGET or ONGOING
    target_amount: Optional[float] = None

class CampaignCreate(CampaignBase, CampaignClassification):
    # Targets are money too — whole dalasi. Overridden here so CampaignRead
    # can still serialize a target set before the rule.
    target_amount: Optional[WholeDalasi] = None

    # Self-declared organiser type: "individual" or "diaspora" only. "ngo"
    # can't be self-declared — it comes from linking an organization, and
    # the NGO onboarding promo also needs that organization verified (see
    # app/services/promotions.py).
    organiser_type: Optional[str] = "individual"

    # Who the money is for. "organization" requires organization_id, one of
    # the caller's own organization profiles.
    beneficiary_type: BeneficiaryType = "self"
    organization_id: Optional[int] = None
    # Ask donors for their class and show a giving-by-class board. Left
    # unset, it's on for school and alumni-association campaigns.
    class_board_enabled: Optional[bool] = None

    @model_validator(mode="after")
    def _check_beneficiary(self):
        if self.beneficiary_type == "organization":
            if self.organization_id is None:
                raise ValueError("organization_id is required when raising for an organization")
        else:
            self.organization_id = None
        return self

class CampaignRead(CampaignBase):
    id: int
    user_id: int
    slug: str
    amount_raised: float
    status: CampaignStatus
    qr_code_page_url: Optional[str] = None
    qr_code_direct_url: Optional[str] = None
    cover_image_url: Optional[str] = None
    category: Optional[str] = None
    tags: List[str] = []
    beneficiary_type: str = "self"
    organization_id: Optional[int] = None
    organization: Optional[OrganizationPublic] = None
    class_board_enabled: bool = False
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CampaignOwner(BaseModel):
    """Public organizer attribution — who a campaign belongs to."""
    id: int
    full_name: Optional[str] = None
    kyc_verified: bool = False

    model_config = ConfigDict(from_attributes=True)


class CampaignDetailRead(CampaignRead):
    """Campaign detail including the owner. Only used by endpoints that
    eagerly load the owner relationship."""
    owner: Optional[CampaignOwner] = None

class ClassBoardEntry(BaseModel):
    graduating_class: int
    total: float
    donors: int


class ClassBoard(BaseModel):
    enabled: bool
    classes: List[ClassBoardEntry] = []


class SpendingSummary(BaseModel):
    withdrawn: float
    accounted_for: float
    unaccounted: float
    last_withdrawal_at: Optional[datetime] = None
    last_spending_update_at: Optional[datetime] = None
