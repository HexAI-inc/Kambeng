import type { SocialLinks } from "@/lib/api";

export type HomeFeedCampaign = {
  id: number;
  title: string;
  slug: string;
  status: string;
  mode: string;
  amount_raised: number;
  target_amount: number | null;
  created_at: string;
  cover_image_url: string | null;
};

export type HomeFeedDonation = {
  id: number;
  amount: number;
  donor_name: string | null;
  client_reference: string;
  created_at: string;
  campaign: {
    id: number;
    title: string;
    slug: string;
  };
};

export type HomeFeedResponse = {
  featured_campaigns: HomeFeedCampaign[];
  recent_donations: HomeFeedDonation[];
  stats: {
    total_campaigns: number;
    active_campaigns: number;
    successful_donations: number;
    total_raised: number;
  };
};

export type CountsResponse = {
  counts: Record<string, number>;
};

export type FilterOptionsResponse = {
  campaign: { status: string[]; mode: string[] };
  kyc: { status: string[]; document_types: string[] };
  moderation: { status: string[]; reasons: string[] };
  transactions: { type: string[]; status: string[] };
  users: { role: string[]; kyc_status: string[] };
};

export type BootstrapResponse = {
  project: {
    name: string;
    environment: string;
    frontend_url: string;
  };
  docs: {
    openapi_url: string;
    docs_url: string;
    redoc_url: string;
  };
  limits: {
    max_campaign_images: number;
    max_campaign_image_size_mb: number;
  };
};

export type CampaignOwner = {
  id: number;
  full_name: string | null;
  handle?: string | null;
  avatar_url?: string | null;
  kyc_verified: boolean;
};

export type OrganizationType =
  | "SCHOOL"
  | "FAITH"
  | "HEALTH_CENTRE"
  | "COMMUNITY_ASSOCIATION"
  | "NGO"
  | "ALUMNI_ASSOCIATION"
  | "OTHER";

export type OrgVerificationStatus = "NOT_SUBMITTED" | "SUBMITTED" | "REVIEWING" | "APPROVED" | "REJECTED";
export type OrgEvidenceType = "REGISTRATION_CERTIFICATE" | "AUTHORIZATION_LETTER";
export type PayoutAccountHolder = "ORGANIZATION" | "REPRESENTATIVE";
export type BeneficiaryType = "self" | "someone_else" | "organization";

/** What donors see — never includes payout details. */
export type OrganizationPublic = {
  id: number;
  name: string;
  org_type: OrganizationType;
  region: string | null;
  village: string | null;
  logo_url: string | null;
  description: string | null;
  representative_role: string | null;
  is_verified: boolean;
};

export type OrgVerification = {
  id: number;
  organization_id: number;
  submitted_by_user_id: number;
  evidence_type: OrgEvidenceType;
  document_file_url: string;
  issuer: string | null;
  payout_wave_number: string;
  payout_account_holder: PayoutAccountHolder;
  status: OrgVerificationStatus;
  reviewed_by_admin_id: number | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string | null;
};

export type OrganizationMember = {
  id: number;
  user_id: number;
  full_name: string | null;
  title: string | null;
  status: "INVITED" | "ACTIVE";
  kyc_verified: boolean;
  accepted_at: string | null;
  created_at: string;
};

export type OrganizationInvitation = {
  member_id: number;
  organization: OrganizationPublic;
  title: string | null;
  invited_by_name: string | null;
  created_at: string;
};

export type WithdrawalRequest = {
  id: number;
  campaign_id: number;
  amount: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "FAILED";
  requested_by_user_id: number;
  requested_by_name: string | null;
  decided_by_name: string | null;
  decided_at: string | null;
  note: string | null;
  payout_id: number | null;
  created_at: string;
  can_approve: boolean;
  can_cancel: boolean;
};

export type ClassBoard = {
  enabled: boolean;
  classes: { graduating_class: number; total: number; donors: number }[];
};

export type SpendingSummary = {
  withdrawn: number;
  accounted_for: number;
  unaccounted: number;
  last_withdrawal_at: string | null;
  last_spending_update_at: string | null;
};

export type Organization = OrganizationPublic & {
  owner_user_id: number;
  verification_status: OrgVerificationStatus;
  verified_at: string | null;
  rejection_reason: string | null;
  payout_wave_number: string | null;
  payout_account_holder: PayoutAccountHolder | null;
  created_at: string;
  updated_at: string | null;
  latest_verification: OrgVerification | null;
  approval_threshold: number | null;
  /** OWNER manages team, verification and settings; MANAGER runs campaigns. */
  my_role: "OWNER" | "MANAGER";
  owner_name: string | null;
  members: OrganizationMember[];
};

export type AdminOrgVerification = OrgVerification & {
  organization: OrganizationPublic;
  organization_verification_status: OrgVerificationStatus;
  submitter_name: string | null;
  submitter_email: string | null;
  submitter_wave_number: string | null;
  submitter_kyc_status: string | null;
  campaign_count: number;
};

export type CampaignDiscoveryItem = {
  id: number;
  user_id: number;
  title: string;
  slug: string;
  description: string;
  mode: string;
  target_amount: number | null;
  amount_raised: number;
  status: string;
  created_at: string;
  cover_image_url: string | null;
  category?: string | null;
  tags?: string[];
  owner?: CampaignOwner | null;
  beneficiary_type?: BeneficiaryType;
  organization_id?: number | null;
  /** Full profile on campaign endpoints; campaign-cards sends just name + badge. */
  organization?: (Pick<OrganizationPublic, "name" | "is_verified"> & Partial<OrganizationPublic>) | null;
  class_board_enabled?: boolean;
  /** Successful donations; sent on campaign cards. */
  donations_count?: number;
};

export type PublicProfileCampaign = {
  id: number;
  title: string;
  slug: string;
  mode: string;
  status: string;
  amount_raised: number;
  target_amount: number | null;
  cover_image_url: string | null;
  created_at: string;
};

export type PublicProfile = {
  id: number;
  full_name: string | null;
  bio: string | null;
  handle: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  favorite_causes: string[];
  location: string | null;
  social_links: SocialLinks;
  kyc_verified: boolean;
  member_since: string;
  total_raised: number;
  supporters_count: number;
  followers_count: number;
  is_following: boolean;
  /** Empty unless the owner opted in to showing it. */
  supported_campaigns: SupportedCampaign[];
  campaigns: PublicProfileCampaign[];
};

export type SupportedCampaign = {
  id: number;
  title: string;
  slug: string;
  cover_image_url: string | null;
};

/** A successful donation on the public campaign page. `donor` is set only
 *  when the donor gave under their own account name. */
export type PublicDonation = {
  id: number;
  amount: number;
  donor_name: string | null;
  message: string | null;
  graduating_class: number | null;
  created_at: string;
  donor: { id: number; handle: string | null; avatar_url: string | null } | null;
};

export type FollowedProfile = {
  id: number;
  full_name: string | null;
  handle: string | null;
  avatar_url: string | null;
  kyc_verified: boolean;
  followed_at: string;
};

export type HandleAvailability = { handle: string; available: boolean; reason: string | null };

export type AdminCampaign = CampaignDiscoveryItem;

export type CampaignReview = {
  id: number;
  campaign_id: number;
  donor_name: string | null;
  comment: string;
  rating: number;
  created_at: string;
};

export type PublicCampaignImage = {
  file_name: string;
  url: string;
  size: number;
  content_type: string | null;
  original_name: string | null;
};

export type CampaignGoalStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED";

export type CampaignGoal = {
  id: number;
  campaign_id: number;
  title: string;
  description: string | null;
  target_amount: number;
  amount_raised: number;
  due_date: string | null;
  status: CampaignGoalStatus;
  sort_order: number;
  created_at: string;
};

// Proof Types
export type ProofDocumentType = "STUDENT_ID" | "UTG_PORTAL" | "TRANSCRIPT" | "TUITION_RECEIPT" | "OTHER";
export type ProofVisibility = "PUBLIC" | "DONOR_ONLY" | "ADMIN_ONLY";

export type Proof = {
  id: number;
  campaign_id: number;
  file_url: string;
  description: string | null;
  document_type: ProofDocumentType;
  visibility: ProofVisibility;
  uploaded_by_user_id: number | null;
  created_at: string;
};

export type PublicProof = Proof;

export type AdminUserOverview = {
  id: number;
  full_name: string;
  email: string;
  wave_number: string;
  role: string;
  is_active: boolean;
  kyc_status: string;
  created_at: string;
  campaign_count: number;
  total_raised: number;
  last_activity: string | null;
};

export type AdminModerationReport = {
  id: number;
  reported_entity_type: string;
  reported_entity_id: number;
  campaign_id: number | null;
  reported_by_user_id: number | null;
  reason: string;
  description: string;
  status: string;
  moderation_note: string | null;
  resolved_by_admin_id: number | null;
  resolved_at: string | null;
  action_taken: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminTransaction = {
  id: number;
  campaign_id: number;
  transaction_type: string;
  status: string;
  gross_amount: number;
  hexai_fee: number | null;
  platform_commission: number | null;
  net_amount: number;
  external_reference: string | null;
  description: string | null;
  created_by_user_id: number | null;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
};

export type AdminTransactionSummary = {
  total_donations: number;
  total_withdrawals: number;
  total_hexai_fees: number;
  total_platform_commissions: number;
  net_total: number;
  transaction_count: number;
  average_withdrawal: number | null;
};

export type AdminPayoutOverview = {
  payout_id: number;
  client_reference?: string | null;
  campaign_id: number;
  campaign_title: string;
  user_id: number;
  user_name: string;
  gross_amount: number;
  hexai_fee: number;
  platform_commission: number;
  net_amount: number;
  status: string;
  created_at: string;
};

export type AdminAuditLog = {
  id: number;
  action_type: string;
  performed_by_admin_id: number;
  target_entity_type: string;
  target_entity_id: number;
  campaign_id: number | null;
  target_user_id: number | null;
  description: string;
  details: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
};

export type AdminSystemStats = {
  total_users: number;
  total_campaigns: number;
  kyc_approved_count: number;
  kyc_pending_count: number;
  kyc_rejected_count: number;
  total_platform_revenue: number;
  active_campaigns: number;
  suspended_campaigns: number;
  last_audit_entry_date: string | null;
};

// Growth / traction report (GET /admin/growth)
export type GrowthTrend = {
  last_month: number;
  previous_month: number;
  growth_pct: number | null;
  cmgr_pct: number | null;
};

export type GrowthMonth = {
  month: string; // YYYY-MM
  is_partial: boolean;
  new_users: number;
  cumulative_users: number;
  kyc_approved: number;
  gmv: number;
  donations: number;
  unique_donors: number;
  new_donors: number;
  revenue: number;
  paid_out: number;
  new_campaigns: number;
  new_organizations: number;
};

export type GrowthMetrics = {
  generated_at: string;
  months: number;
  current_month: string;
  headline: {
    gmv_total: number;
    revenue_total: number;
    take_rate_pct: number | null;
    paid_out_total: number;
    total_users: number;
    kyc_approved: number;
    kyc_rate_pct: number | null;
    donations_count: number;
    unique_donors: number;
    avg_donation: number | null;
    median_donation: number | null;
    repeat_donor_rate_pct: number | null;
    payment_success_rate_pct: number | null;
    recurring_active_plans: number;
    recurring_monthly_committed: number;
    campaigns_total: number;
    campaigns_funded: number;
    organizations_total: number;
    organizations_verified: number;
    waitlist_subscribers: number;
  };
  trends: Record<"gmv" | "revenue" | "new_users" | "donations" | "unique_donors" | "new_campaigns", GrowthTrend>;
  monthly: GrowthMonth[];
  funnel: { stage: string; count: number; pct_of_signups: number | null }[];
  kyc: {
    not_submitted: number;
    pending: number;
    approved: number;
    rejected: number;
    approval_rate_pct: number | null;
    median_review_hours: number | null;
  };
  cohorts: { cohort: string; size: number; retention_pct: (number | null)[] }[];
  categories: { category: string; campaigns: number; gmv: number }[];
  rails: { rail: string; count: number; gmv: number; share_pct: number | null }[];
  gift_bands: { band: string; count: number; gmv: number }[];
  organizations: {
    by_type: { type: string; count: number }[];
    by_region: { region: string; count: number }[];
  };
  outcomes: {
    funded_rate_pct: number | null;
    target_campaigns: number;
    target_reached: number;
    avg_raised_per_funded: number | null;
    avg_donors_per_funded: number | null;
    median_days_to_first_donation: number | null;
  };
  top_campaigns: { title: string; slug: string; category: string | null; gmv: number; donations: number; is_organization: boolean }[];
  trust: {
    payouts_completed: number;
    payout_success_rate_pct: number | null;
    proof_coverage_pct: number | null;
    suspended_campaigns: number;
    suspension_rate_pct: number | null;
    fraud_reports: number;
    moderation_reports: number;
  };
};

// Admin one-page overviews (GET /admin/campaigns/{id}/overview, /admin/users/{id}/overview)
export type OverviewDonation = {
  id: number;
  client_reference: string;
  campaign_id: number;
  campaign_title?: string | null;
  amount: number;
  net: number;
  status: string;
  provider: string | null;
  donor_name: string | null;
  donor_email: string | null;
  user_id: number | null;
  message: string | null;
  goal_id: number | null;
  reconciliation_source: string | null;
  reconciliation_reason: string | null;
  reconciled_at: string | null;
  created_at: string;
};

export type OverviewPayout = {
  id: number;
  client_reference: string;
  campaign_id: number | null;
  campaign_title?: string | null;
  status: string;
  gross_amount: number | null;
  hexai_fee: number | null;
  platform_commission: number | null;
  net_amount: number | null;
  debit: number;
  recipient_wave_number: string | null;
  requested_by: string | null;
  approved_by: string | null;
  has_gateway_id: boolean;
  reversed_at: string | null;
  created_at: string;
};

export type OverviewKyc = {
  id: number;
  document_type: string;
  status: string;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type OverviewAuditEntry = {
  id: number;
  action_type: string;
  description: string;
  details: string | null;
  old_value: string | null;
  new_value: string | null;
  performed_by: string | null;
  created_at: string;
};

export type OverviewReports = {
  fraud: { id: number; campaign_id: number; reason: string; details: string | null; status: string; created_at: string }[];
  moderation: {
    id: number; campaign_id: number | null; entity_type: string; reason: string; description: string;
    status: string; action_taken: string | null; moderation_note: string | null; resolved_at: string | null; created_at: string | null;
  }[];
};

export type CampaignOverview = {
  campaign: {
    id: number; title: string; slug: string; description: string; status: string; mode: string;
    target_amount: number | null; amount_raised: number; category: string | null; tags: string[];
    cover_image_url: string | null; beneficiary_type: string; organiser_type: string; class_board_enabled: boolean;
    active_promo: string | null; qr_code_page_url: string | null; short_codes: string[]; created_at: string;
  };
  owner: {
    id: number; full_name: string | null; email: string | null; wave_number: string | null; handle: string | null;
    kyc_status: string | null; is_active: boolean; created_at: string; kyc_submissions: OverviewKyc[];
  } | null;
  organization: {
    id: number; name: string; org_type: string; verification_status: string; region: string | null;
    payout_wave_number: string | null; approval_threshold: number | null;
  } | null;
  money: {
    amount_raised: number; donations_net: number; promo_credit: number; expected: number; difference: number;
    withdrawn: number; adjustments: number; balance: number; true_balance: number; issues: CampaignAuditIssue[];
    spending: SpendingSummary;
  };
  donation_stats: {
    succeeded: number; pending: number; failed: number; unique_donors: number; anonymous_gifts: number;
    gross: number; net: number; average: number | null; largest: number | null; first_at: string | null; last_at: string | null;
    by_provider: { provider: string; count: number; gross: number }[];
  };
  donations: OverviewDonation[];
  payouts: OverviewPayout[];
  withdrawal_requests: {
    id: number; amount: number; status: string; requested_by: string | null; decided_by: string | null;
    decided_at: string | null; note: string | null; payout_id: number | null; created_at: string;
  }[];
  balance_adjustments: { id: number; amount: number; funded_by: string; reason: string; created_by: string | null; created_at: string }[];
  goals: { id: number; title: string; target_amount: number; amount_raised: number; status: string; due_date: string | null }[];
  updates: { id: number; title: string | null; text: string; category: string | null; amount_spent: number | null; posted_by: string | null; created_at: string }[];
  proofs: { id: number; description: string | null; document_type: string; visibility: string; file_url: string; created_at: string }[];
  reviews: { count: number; average: number | null; recent: { id: number; donor_name: string | null; rating: number; comment: string | null; created_at: string }[] };
  promotions: {
    id: number; name: string; promo_type: string; donation_id: number | null; payout_id: number | null;
    fee_waived_amount: number; match_contributed_amount: number | null; reversed: boolean; applied_at: string;
  }[];
  recurring: { active_plans: number; monthly_committed: number; cancelled_plans: number };
  engagement: { followers: number; share_clicks: number; share_click_donations: number };
  reports: OverviewReports;
  audit_log: OverviewAuditEntry[];
};

export type UserOverview = {
  user: {
    id: number; full_name: string | null; email: string | null; wave_number: string | null; handle: string | null;
    avatar_url: string | null; role: string; is_active: boolean; is_email_verified: boolean; account_purpose: string | null;
    kyc_status: string | null; kyc_verified_at: string | null; kyc_rejection_reason: string | null;
    referral_code: string | null; referred_by_code: string | null; created_at: string;
  };
  kyc_submissions: OverviewKyc[];
  totals: {
    campaigns: number; raised: number; donations_received: number; withdrawn: number; sent_to_wave: number;
    balance: number; donations_made: number; given: number; followers: number; following: number; referred_users: number;
  };
  campaigns: {
    id: number; title: string; slug: string; status: string; mode: string; target_amount: number | null;
    amount_raised: number; donations: number; withdrawn: number; balance: number; issues: CampaignAuditIssue[]; created_at: string;
  }[];
  donations_received: OverviewDonation[];
  donations_made: OverviewDonation[];
  withdrawals: OverviewPayout[];
  recurring_plans: {
    id: number; campaign_id: number; campaign_title: string | null; amount: number; frequency: string;
    is_active: boolean; next_charge_date: string | null; cancelled_at: string | null; created_at: string;
  }[];
  organizations: { id: number; name: string; role: string; org_type?: string; verification_status?: string; status?: string }[];
  reports: OverviewReports;
  audit_log: OverviewAuditEntry[];
};

export type CampaignPublicStats = {
  created_at: string | null;
  donations_count: number;
  donors_count: number;
  first_donation_at: string | null;
  last_donation_at: string | null;
  largest_donation: number | null;
  followers_count: number;
  updates_count: number;
  receipts_count: number;
  organizer_since: string | null;
  organizer_campaigns: number;
};

// KYC Types
export type KYCDocument = {
  id: number;
  document_type: string;
  file_url: string;
  upload_date: string;
};

export type KYCStatusResponse = {
  id: number;
  user_id: number;
  status: string;
  submitted_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  documents: KYCDocument[];
};

export type AdminKYCSubmission = {
  id: number;
  user_id: number;
  user_name: string | null;
  user_email: string | null;
  document_type: string;
  document_file_url: string;
  status: string;
  reviewed_by_admin_id: number | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
};

// Donation Types
export type AdminDonation = {
  id: number;
  campaign_id: number;
  campaign_title: string;
  donor_id: number | null;
  donor_name: string | null;
  amount: number;
  status: string;
  client_reference: string;
  created_at: string;
  reconciliation_source: string | null;
  reconciliation_reason: string | null;
  reconciled_by_admin_id: number | null;
  reconciled_at: string | null;
};

// Campaign money audit (GET /admin/reconciliation/campaigns)
export type CampaignAuditIssue = "over_credited" | "under_credited" | "overdrawn" | "goal_mismatch";

export type CampaignAuditGoal = {
  goal_id: number;
  title: string;
  amount_raised: number;
  expected: number;
  difference: number;
};

export type CampaignAuditRow = {
  campaign_id: number;
  slug: string;
  title: string;
  amount_raised: number;
  donations_net: number;
  promo_credit: number;
  expected: number;
  difference: number;
  withdrawn: number;
  adjustments: number;
  balance: number;
  true_balance: number;
  issues: CampaignAuditIssue[];
  goals: CampaignAuditGoal[];
};

export type CampaignAuditReport = {
  generated_at: string;
  summary: {
    total_campaigns: number;
    flagged_campaigns: number;
    stored: number;
    expected: number;
    withdrawn: number;
    owed_to_campaigns: number;
    over_credited: number;
    overdrawn: number;
    commissions_written_off: number;
  };
  campaigns: CampaignAuditRow[];
};

// Campaign Image Types
export type CampaignImage = {
  file_name: string;
  url: string;
  size: number;
  content_type: string | null;
  original_name: string | null;
};

// Campaign Alias Types
export type CampaignAlias = {
  id: number;
  campaign_id: number;
  short_code: string;
  full_url: string;
  created_at: string;
};

// Recurring Donation Types
export type RecurringDonation = {
  id: number;
  user_id: number;
  campaign_id: number;
  amount: number;
  frequency: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUAL";
  anchor_date: string;
  next_charge_date: string;
  last_charge_date: string | null;
  is_active: boolean;
  cancelled_at: string | null;
  created_at: string;
};

export type RecurringDonationListResponse = {
  total: number;
  recurring_donations: RecurringDonation[];
};

// Commissions & Revenue Types
export type CommissionSourceItem = {
  payout_id: number;
  campaign_id: number;
  campaign_title: string;
  user_id: number;
  user_name: string;
  gross_amount: number;
  platform_commission: number;
  status: string;
  created_at: string;
};

export type CommissionSummary = {
  total_commissions: number;
  withdrawn_commissions: number;
  pending_commissions: number;
  available_commissions: number;
  commission_count: number;
  written_off_commissions?: number;
  last_updated: string;
};

export type AdminCommissionWithdrawalResponse = {
  withdrawal_id: string;
  amount: number;
  status: string;
  created_at: string;
  message: string;
};

export type CampaignWithdrawalResponse = {
  message: string;
  client_reference: string;
  /** What the campaigner asked to withdraw, before the whole-dalasi rounding. */
  amount_requested: number;
  /** The requested amount less the sub-dalasi remainder left in the balance. */
  gross_amount: number;
  hexai_fee: number;
  platform_commission: number;
  /** Bututs kept in the campaign balance because payouts must be whole dalasi. */
  sub_dalasi_carried_forward: number;
  net_received: number;
  wave_number: string;
  status: "PENDING";
};

/** Returned instead when the amount is above the organization's approval threshold. */
export type WithdrawalPendingApprovalResponse = {
  status: "PENDING_APPROVAL";
  message: string;
  request_id: number;
  gross_amount: number;
};

export type WithdrawalHistoryItem = {
  id: number;
  client_reference: string;
  gross_amount: number;
  hexai_fee: number;
  platform_commission: number;
  net_amount: number;
  status: string;
  created_at: string;
};

export type CampaignWithdrawalSummaryResponse = {
  campaign_id: number;
  campaign_title: string;
  payout_wave_number?: string | null;
  organization_name?: string | null;
  organization_verification_status?: OrgVerificationStatus | null;
  /** Set while the campaign's organization isn't verified. */
  withdrawal_blocked_reason?: string | null;
  /** Withdrawals above this need a second manager's approval. */
  approval_threshold?: number | null;
  spent_accounted_for?: number;
  spent_unaccounted?: number;
  amount_raised: number;
  total_withdrawn: number;
  available_balance: number;
  withdrawal_history: WithdrawalHistoryItem[];
};

// Campaign Update Types
export type CampaignUpdateAttachment = {
  id: number;
  file_url: string;
  file_name: string | null;
  content_type: string | null;
};

export type CampaignUpdate = {
  id: number;
  campaign_id: number;
  title: string | null;
  text: string;
  category: string | null;
  amount_spent: number | null;
  created_at: string;
  author_name: string | null;
  attachments: CampaignUpdateAttachment[];
};

// Global admin search result types
export type AdminSearchResultItem = {
  model: string; // e.g., 'campaign', 'user', 'donation', 'review', 'payout', 'kyc', 'moderation'
  entity_id: string;
  title: string | null;
  subtitle: string | null;
  status: string | null;
  created_at: string;
};

export type AdminSearchResponse = {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  items: AdminSearchResultItem[];
};
