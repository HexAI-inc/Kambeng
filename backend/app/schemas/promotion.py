from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.promotion import SELF_LIMITING_TYPES, PromoType


class PromotionCreate(BaseModel):
    slug: str = Field(..., min_length=3, max_length=80)
    name: str = Field(..., min_length=3, max_length=200)
    promo_type: PromoType
    description: str | None = Field(default=None, max_length=2000)

    fee_waiver_pct: float | None = Field(default=None, ge=0, le=100)
    rebate_pct: float | None = Field(default=None, ge=0, le=100)

    match_pool_total: float | None = Field(default=None, gt=0)
    match_ratio: float | None = Field(default=None, gt=0)

    max_campaigns: int | None = Field(default=None, gt=0)
    category_filter: str | None = None
    requires_first_donation: bool = False
    requires_organiser_type: str | None = None

    starts_at: datetime | None = None
    ends_at: datetime | None = None
    is_active: bool = True

    @field_validator("slug")
    @classmethod
    def normalize_slug(cls, value: str) -> str:
        return value.strip().lower().replace(" ", "-")

    @model_validator(mode="after")
    def check_type_specific_fields(self) -> "PromotionCreate":
        # §7.6 guardrail: every promo except the naturally self-limiting
        # types must have an end date in production.
        if self.promo_type not in SELF_LIMITING_TYPES and self.ends_at is None:
            raise ValueError(
                f"ends_at is required for promo_type={self.promo_type.value!r} "
                "(only organiser_referral and ngo_onboarding may be open-ended)"
            )

        if self.promo_type == PromoType.MATCHED_DONATION:
            if not self.match_pool_total or not self.match_ratio:
                raise ValueError("match_pool_total and match_ratio are required for matched_donation promos")
        else:
            if self.match_pool_total or self.match_ratio:
                raise ValueError("match_pool_total/match_ratio only apply to matched_donation promos")

        needs_fee_waiver_pct = self.promo_type in {
            PromoType.CAMPAIGN_FEE_WAIVER,
            PromoType.NGO_ONBOARDING,
            PromoType.ORGANISER_REFERRAL,
        }
        if needs_fee_waiver_pct and self.fee_waiver_pct is None:
            raise ValueError(f"fee_waiver_pct is required for promo_type={self.promo_type.value!r}")

        needs_rebate_pct = self.promo_type in {
            PromoType.MILESTONE_COMPLETION_REBATE,
            PromoType.TRANSPARENCY_REBATE,
        }
        if needs_rebate_pct and self.rebate_pct is None:
            raise ValueError(f"rebate_pct is required for promo_type={self.promo_type.value!r}")

        return self


class PromotionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=3, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    is_active: bool | None = None
    ends_at: datetime | None = None
    fee_waiver_pct: float | None = Field(default=None, ge=0, le=100)
    rebate_pct: float | None = Field(default=None, ge=0, le=100)
    max_campaigns: int | None = Field(default=None, gt=0)


class PromotionRead(BaseModel):
    id: int
    slug: str
    name: str
    promo_type: str
    description: str | None
    fee_waiver_pct: float | None
    rebate_pct: float | None
    match_pool_total: float | None
    match_pool_remaining: float | None
    match_ratio: float | None
    max_campaigns: int | None
    campaigns_used: int
    category_filter: str | None
    requires_first_donation: bool
    requires_organiser_type: str | None
    starts_at: datetime
    ends_at: datetime | None
    is_active: bool
    created_at: datetime
    total_fee_waived: float = 0.0

    model_config = ConfigDict(from_attributes=True)


class PromotionListResponse(BaseModel):
    total: int
    items: list[PromotionRead]


class PromoApplicationRead(BaseModel):
    id: int
    promotion_id: int
    campaign_id: int | None
    campaign_title: str | None = None
    donation_id: int | None
    payout_id: int | None
    user_id: int | None
    fee_waived_amount: float
    match_contributed_amount: float | None
    reversed: bool
    applied_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PromoApplicationListResponse(BaseModel):
    total: int
    items: list[PromoApplicationRead]


class AssignPromoRequest(BaseModel):
    promotion_id: int


class ActivePromoResponse(BaseModel):
    """Public — powers promo badges and match-pool status on the campaign page."""
    active: bool
    promo_type: str | None = None
    name: str | None = None
    fee_waiver_pct: float | None = None
    match_pool_total: float | None = None
    match_pool_remaining: float | None = None
    match_ratio: float | None = None
    ends_at: datetime | None = None


class ReferralInfoResponse(BaseModel):
    referral_code: str
    share_link: str


class RecordShareClickRequest(BaseModel):
    referral_code: str | None = None
