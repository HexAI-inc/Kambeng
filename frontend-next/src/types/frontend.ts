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
  kyc_verified: boolean;
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
  owner?: CampaignOwner | null;
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
  kyc_verified: boolean;
  member_since: string;
  campaigns: PublicProfileCampaign[];
};

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
  gross_amount: number;
  hexai_fee: number;
  platform_commission: number;
  net_received: number;
  wave_number: string;
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
