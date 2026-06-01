"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { api, getMyProfile } from "@/lib/api";
import {
  AdminAuditLog,
  AdminCampaign,
  AdminDonation,
  AdminKYCSubmission,
  AdminModerationReport,
  AdminPayoutOverview,
  AdminSystemStats,
  AdminTransaction,
  AdminTransactionSummary,
  AdminUserOverview,
  BootstrapResponse,
  CampaignAlias,
  CampaignDiscoveryItem,
  CampaignImage,
  CampaignGoal,
  CampaignReview,
  CampaignWithdrawalSummaryResponse,
  CampaignWithdrawalResponse,
  CommissionSummary,
  CommissionSourceItem,
  AdminCommissionWithdrawalResponse,
  AdminSearchResponse,
  CountsResponse,
  FilterOptionsResponse,
  HomeFeedResponse,
  KYCStatusResponse,
  Proof,
  PublicCampaignImage,
  RecurringDonation,
  RecurringDonationListResponse,
} from "@/types/frontend";

export function useBootstrap() {
  return useQuery({
    queryKey: ["bootstrap"],
    queryFn: async () => {
      const response = await api.get<BootstrapResponse>("/utils/frontend/v1/bootstrap");
      return response.data;
    },
  });
}

export function useHomeFeed() {
  return useQuery({
    queryKey: ["home-feed"],
    queryFn: async () => {
      const response = await api.get<HomeFeedResponse>("/utils/frontend/v1/home-feed");
      return response.data;
    },
  });
}

export function useFilterOptions() {
  return useQuery({
    queryKey: ["filter-options"],
    queryFn: async () => {
      const response = await api.get<FilterOptionsResponse>(
        "/utils/frontend/v1/filter-options",
      );
      return response.data;
    },
  });
}

export function useCounts(enabled = true) {
  return useQuery({
    queryKey: ["counts"],
    enabled,
    queryFn: async () => {
      const response = await api.get<CountsResponse>("/utils/frontend/v1/counts");
      return response.data;
    },
  });
}

export function useSessionProfile(enabled = true) {
  return useQuery({
    queryKey: ["session", "me"],
    enabled,
    retry: false,
    queryFn: getMyProfile,
  });
}

export function useMyCampaigns(enabled = true) {
  return useQuery({
    queryKey: ["my-campaigns"],
    enabled,
    queryFn: async () => {
      const response = await api.get<CampaignDiscoveryItem[]>("/campaigns/me");
      return response.data;
    },
  });
}

export function usePublicCampaignDiscovery() {
  return useQuery({
    queryKey: ["public-campaigns"],
    queryFn: async () => {
      const response = await api.get<CampaignDiscoveryItem[]>("/utils/frontend/v1/campaign-cards");
      return response.data;
    },
  });
}

export function usePublicCampaignReviews(slug?: string, enabled = true) {
  return useQuery({
    queryKey: ["public-campaign-reviews", slug],
    enabled: enabled && Boolean(slug),
    queryFn: async () => {
      const response = await api.get<CampaignReview[]>(`/reviews/campaigns/${slug}`);
      return response.data;
    },
  });
}

export function usePublicCampaignImages(slug?: string, enabled = true) {
  return useQuery({
    queryKey: ["public-campaign-images", slug],
    enabled: enabled && Boolean(slug),
    queryFn: async () => {
      const response = await api.get<PublicCampaignImage[]>(`/uploads/campaigns/${slug}/images`);
      return response.data;
    },
  });
}

export function useCampaignGoals(slug?: string, enabled = true) {
  return useQuery({
    queryKey: ["campaign-goals", slug],
    enabled: enabled && Boolean(slug),
    queryFn: async () => {
      const response = await api.get<CampaignGoal[]>(`/goals/campaigns/${slug}`);
      return response.data;
    },
  });
}

export function useManageCampaignGoals(slug?: string, enabled = true) {
  return useQuery({
    queryKey: ["manage-campaign-goals", slug],
    enabled: enabled && Boolean(slug),
    queryFn: async () => {
      const response = await api.get<CampaignGoal[]>(`/goals/campaigns/${slug}/manage`);
      return response.data;
    },
  });
}

export function useCreateCampaignGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ slug, payload }: { slug: string; payload: Partial<CampaignGoal> }) => {
      const response = await api.post<CampaignGoal>(`/goals/campaigns/${slug}`, payload);
      return response.data;
    },
    onSuccess: (_, { slug }) => {
      queryClient.invalidateQueries({ queryKey: ["manage-campaign-goals", slug] });
      queryClient.invalidateQueries({ queryKey: ["campaign-goals", slug] });
    },
  });
}

export function useUpdateCampaignGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ goalId, payload }: { goalId: number; payload: Partial<CampaignGoal>; slug?: string }) => {
      const response = await api.put<CampaignGoal>(`/goals/${goalId}`, payload);
      return response.data;
    },
    onSuccess: (_, { slug }) => {
      if (slug) {
        queryClient.invalidateQueries({ queryKey: ["manage-campaign-goals", slug] });
        queryClient.invalidateQueries({ queryKey: ["campaign-goals", slug] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["manage-campaign-goals"] });
      }
    },
  });
}

export function useSubmitCampaignReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      slug,
      rating,
      comment,
      donor_name,
    }: {
      slug: string;
      rating: number;
      comment: string;
      donor_name?: string;
    }) => {
      const response = await api.post<CampaignReview>(`/reviews/campaigns/${slug}`, {
        rating,
        comment,
        ...(donor_name && { donor_name }),
      });
      return response.data;
    },
    onSuccess: (_, { slug }) => {
      queryClient.invalidateQueries({ queryKey: ["public-campaign-reviews", slug] });
    },
  });
}

export function useAdminCampaigns(enabled = true) {
  return useQuery({
    queryKey: ["admin-campaigns"],
    enabled,
    queryFn: async () => {
      const response = await api.get<AdminCampaign[]>("/admin/campaigns");
      return response.data;
    },
  });
}

export function useAdminCampaignDetail(campaignId?: number, enabled = true) {
  return useQuery({
    queryKey: ["admin-campaign-detail", campaignId],
    enabled: enabled && !!campaignId,
    queryFn: async () => {
      const response = await api.get<AdminCampaign>(`/admin/campaigns/${campaignId}`);
      return response.data;
    },
  });
}

export function useAdminUsers(enabled = true) {
  return useQuery({
    queryKey: ["admin-users"],
    enabled,
    queryFn: async () => {
      const response = await api.get<AdminUserOverview[]>("/admin/users/overview");
      return response.data;
    },
  });
}

export function useAdminUserDetail(userId?: number, enabled = true) {
  return useQuery({
    queryKey: ["admin-user-detail", userId],
    enabled: enabled && !!userId,
    queryFn: async () => {
      const response = await api.get<AdminUserOverview>(`/admin/users/${userId}`);
      return response.data;
    },
  });
}

export function useUpdateAdminUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, status }: { userId: number; status: "ACTIVE" | "SUSPENDED" }) => {
      const response = await api.patch<AdminUserOverview>(`/admin/users/${userId}/status`, null, {
        params: { status },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-system-stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin-audit-logs"] });
    },
  });
}

export function useAdminModerationQueue(enabled = true) {
  return useQuery({
    queryKey: ["admin-moderation-queue"],
    enabled,
    queryFn: async () => {
      const response = await api.get<AdminModerationReport[]>("/moderation/reports/queue");
      return response.data;
    },
  });
}

export function useSubmitModerationReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      reportedEntityType,
      reportedEntityId,
      campaignId,
      reason,
      description,
    }: {
      reportedEntityType: "CAMPAIGN" | "REVIEW" | "USER";
      reportedEntityId: number;
      campaignId?: number | null;
      reason: "SCAM" | "INAPPROPRIATE_CONTENT" | "HATE_SPEECH" | "FALSE_INFORMATION" | "HARASSMENT" | "SPAM" | "OTHER";
      description: string;
    }) => {
      const response = await api.post("/moderation/reports", {
        reported_entity_type: reportedEntityType,
        reported_entity_id: reportedEntityId,
        campaign_id: campaignId ?? null,
        reason,
        description,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-moderation-queue"] });
    },
  });
}

export function useAdminTransactions(enabled = true) {
  return useQuery({
    queryKey: ["admin-transactions"],
    enabled,
    queryFn: async () => {
      const response = await api.get<AdminTransaction[]>("/admin/reports/transactions", {
        params: { limit: 200 },
      });
      return response.data;
    },
  });
}

export function useAdminFinancialSummary(enabled = true) {
  return useQuery({
    queryKey: ["admin-financial-summary"],
    enabled,
    queryFn: async () => {
      const response = await api.get<AdminTransactionSummary>("/admin/reports/summary");
      return response.data;
    },
  });
}

export function useAdminCampaignFinancialReport(campaignId?: number, enabled = true) {
  return useQuery({
    queryKey: ["admin-campaign-financial-summary", campaignId],
    enabled: enabled && typeof campaignId === "number" && campaignId > 0,
    queryFn: async () => {
      const response = await api.get<AdminTransactionSummary>(`/admin/reports/campaign/${campaignId}`);
      return response.data;
    },
  });
}

export function useAdminPayoutsOverview(enabled = true) {
  return useQuery({
    queryKey: ["admin-payouts-overview"],
    enabled,
    queryFn: async () => {
      const response = await api.get<AdminPayoutOverview[]>("/admin/payouts/overview", {
        params: { limit: 100 },
      });
      return response.data;
    },
  });
}

export function useAdminSystemStats(enabled = true) {
  return useQuery({
    queryKey: ["admin-system-stats"],
    enabled,
    queryFn: async () => {
      const response = await api.get<AdminSystemStats>("/admin/system/stats");
      return response.data;
    },
  });
}

export function useAdminAuditLogs(enabled = true) {
  return useQuery({
    queryKey: ["admin-audit-logs"],
    enabled,
    queryFn: async () => {
      const response = await api.get<AdminAuditLog[]>("/admin/audit-logs", {
        params: { limit: 100 },
      });
      return response.data;
    },
  });
}

// ===== KYC Queries & Mutations =====

export function useKYCStatus(userKey?: number | string, enabled = true) {
  return useQuery({
    queryKey: ["kyc-status", userKey ?? "anonymous"],
    enabled: enabled && userKey !== undefined,
    queryFn: async () => {
      const response = await api.get<KYCStatusResponse>("/kyc/status");
      return response.data;
    },
  });
}

export function useAdminKYCQueue(enabled = true) {
  return useQuery({
    queryKey: ["admin-kyc-queue"],
    enabled,
    queryFn: async () => {
      const response = await api.get<AdminKYCSubmission[]>("/admin/kyc/queue");
      return response.data;
    },
  });
}

export function useAdminKYCDetail(submissionId?: number, enabled = true) {
  return useQuery({
    queryKey: ["admin-kyc-detail", submissionId],
    enabled: enabled && !!submissionId,
    queryFn: async () => {
      const response = await api.get<AdminKYCSubmission>(`/admin/kyc/${submissionId}`);
      return response.data;
    },
  });
}

export function useApproveKYC() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (submissionId: number) => {
      const response = await api.post<AdminKYCSubmission>(`/admin/kyc/${submissionId}/approve`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-kyc-queue"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-system-stats"] });
    },
  });
}

export function useRejectKYC() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ submissionId, reason }: { submissionId: number; reason: string }) => {
      const response = await api.post<AdminKYCSubmission>(`/admin/kyc/${submissionId}/reject`, {
        rejection_reason: reason,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-kyc-queue"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-system-stats"] });
    },
  });
}

export function useSubmitKYC() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await api.post<KYCStatusResponse>("/kyc/submit", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kyc-status"] });
    },
  });
}

// ===== Donation Queries & Mutations =====

export function useAdminPendingDonations(enabled = true) {
  return useQuery({
    queryKey: ["admin-pending-donations"],
    enabled,
    queryFn: async () => {
      const response = await api.get<AdminDonation[]>("/admin/donations/pending", {
        params: { limit: 100 },
      });
      return response.data;
    },
  });
}

export function useAdminSuccessfulDonations(enabled = true) {
  return useQuery({
    queryKey: ["admin-successful-donations"],
    enabled,
    queryFn: async () => {
      const response = await api.get<AdminDonation[]>("/admin/donations/successful", {
        params: { limit: 100 },
      });
      return response.data;
    },
  });
}

export function useApproveDonation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (clientReference: string) => {
      const response = await api.post<AdminDonation>(
        `/payments/admin/donations/${clientReference}/approve`,
        {},
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pending-donations"] });
      queryClient.invalidateQueries({ queryKey: ["admin-audit-logs"] });
      queryClient.invalidateQueries({ queryKey: ["admin-financial-summary"] });
    },
  });
}

export function useRejectDonation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      clientReference,
      reason,
    }: {
      clientReference: string;
      reason: string;
    }) => {
      const response = await api.post<AdminDonation>(
        `/payments/admin/donations/${clientReference}/reject`,
        { reason },
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pending-donations"] });
      queryClient.invalidateQueries({ queryKey: ["admin-audit-logs"] });
      queryClient.invalidateQueries({ queryKey: ["admin-financial-summary"] });
    },
  });
}

// ===== Campaign Image Mutations =====

export function useUploadCampaignImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ slug, formData }: { slug: string; formData: FormData }) => {
      const response = await api.post(`/uploads/campaigns/${slug}/images`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data;
    },
    onSuccess: (_, { slug }) => {
      queryClient.invalidateQueries({ queryKey: ["campaign-images", slug] });
    },
  });
}

export function useDeleteCampaignImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ slug, fileName }: { slug: string; fileName: string }) => {
      await api.delete(`/uploads/campaigns/${slug}/images/${fileName}`);
    },
    onSuccess: (_, { slug }) => {
      queryClient.invalidateQueries({ queryKey: ["campaign-images", slug] });
    },
  });
}

export function useCampaignImages(slug?: string, enabled = true) {
  return useQuery({
    queryKey: ["campaign-images", slug],
    enabled: enabled && !!slug,
    queryFn: async () => {
      const response = await api.get<CampaignImage[]>(`/uploads/campaigns/${slug}/images`);
      return response.data;
    },
  });
}

// ===== Campaign Alias Mutations =====

export function useCreateCampaignAlias() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      campaignId,
      shortCode,
    }: {
      campaignId: number;
      shortCode: string;
    }) => {
      const response = await api.post<CampaignAlias>(`/aliases/campaigns/${campaignId}`, {
        short_code: shortCode,
      });
      return response.data;
    },
    onSuccess: (_, { campaignId }) => {
      queryClient.invalidateQueries({ queryKey: ["campaign-aliases", campaignId] });
    },
  });
}

export function useDeleteCampaignAlias() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ campaignId, aliasId }: { campaignId: number; aliasId: number }) => {
      await api.delete(`/aliases/campaigns/${campaignId}/${aliasId}`);
    },
    onSuccess: (_, { campaignId }) => {
      queryClient.invalidateQueries({ queryKey: ["campaign-aliases", campaignId] });
    },
  });
}

export function useCampaignAliases(campaignId?: number, enabled = true) {
  return useQuery({
    queryKey: ["campaign-aliases", campaignId],
    enabled: enabled && !!campaignId,
    queryFn: async () => {
      const response = await api.get<CampaignAlias[]>(
        `/aliases/campaigns/${campaignId}`,
      );
      return response.data;
    },
  });
}

// ===== Moderation Mutations =====

export function useResolveModerationReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      reportId,
      action,
      note,
    }: {
      reportId: number;
      action: string;
      note?: string;
    }) => {
      const response = await api.post<AdminModerationReport>(
        `/moderation/reports/${reportId}/resolve`,
        {
          action_taken: action,
          moderation_note: note,
        },
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-moderation-queue"] });
    },
  });
}

// ===== QR Code Queries =====

export function useCampaignQRCode(slug?: string, enabled = true) {
  return useQuery({
    queryKey: ["campaign-qr", slug],
    enabled: enabled && !!slug,
    queryFn: async () => {
      const response = await api.get<{
        campaign_slug: string;
        qr_code_base64: string;
        qr_code_url: string;
      }>(`/utils/qrcode/campaign/${slug}/base64`);
      return response.data;
    },
  });
}

export function useDonationQRCode(slug?: string, enabled = true) {
  return useQuery({
    queryKey: ["donation-qr", slug],
    enabled: enabled && !!slug,
    queryFn: async () => {
      const qrCode = await api.get(`/utils/qrcode/donation/${slug}`, {
        responseType: "blob",
      });
      // Convert blob to data URL
      const reader = new FileReader();
      return new Promise<string>((resolve) => {
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.readAsDataURL(qrCode.data);
      });
    },
  });
}

export function useShortCodeQRCode(shortCode?: string, enabled = true) {
  return useQuery({
    queryKey: ["shortcode-qr", shortCode],
    enabled: enabled && !!shortCode,
    queryFn: async () => {
      const qrCode = await api.get(`/utils/qrcode/short/${shortCode}`, {
        responseType: "blob",
      });
      // Convert blob to data URL
      const reader = new FileReader();
      return new Promise<string>((resolve) => {
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.readAsDataURL(qrCode.data);
      });
    },
  });
}

// ===== Recurring Donation Queries & Mutations =====

export function useUserRecurringDonations(enabled = true) {
  return useQuery({
    queryKey: ["user-recurring-donations"],
    enabled,
    queryFn: async () => {
      const response = await api.get<RecurringDonationListResponse>("/payments/donations/recurring");
      return response.data;
    },
  });
}

export function useCreateRecurringDonation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      campaign_id,
      amount,
      frequency,
      anchor_date,
    }: {
      campaign_id: number;
      amount: number;
      frequency: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUAL";
      anchor_date?: string;
    }) => {
      const response = await api.post<RecurringDonation>("/payments/donations/recurring", {
        campaign_id,
        amount,
        frequency,
        anchor_date,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-recurring-donations"] });
    },
  });
}

export function useUpdateRecurringDonation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      recurring_donation_id,
      amount,
      frequency,
      is_active,
    }: {
      recurring_donation_id: number;
      amount?: number;
      frequency?: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUAL";
      is_active?: boolean;
    }) => {
      const response = await api.patch<RecurringDonation>(
        `/payments/donations/recurring/${recurring_donation_id}`,
        {
          amount,
          frequency,
          is_active,
        }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-recurring-donations"] });
    },
  });
}

export function useCancelRecurringDonation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (recurring_donation_id: number) => {
      await api.delete(`/payments/donations/recurring/${recurring_donation_id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-recurring-donations"] });
    },
  });
}

// ===== Proof Queries & Mutations =====

export function useCampaignProofs(slug?: string, enabled = true) {
  return useQuery({
    queryKey: ["campaign-proofs", slug],
    enabled: enabled && !!slug,
    queryFn: async () => {
      const response = await api.get<Proof[]>(`/uploads/proofs/${slug}`);
      return response.data;
    },
  });
}

export function useUploadCampaignProof() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      slug,
      formData,
    }: {
      slug: string;
      formData: FormData;
    }) => {
      const response = await api.post<Proof>(`/uploads/proofs/${slug}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data;
    },
    onSuccess: (_, { slug }) => {
      queryClient.invalidateQueries({ queryKey: ["campaign-proofs", slug] });
    },
  });
}

// ===== Commissions & Revenue Management =====

export function useAdminCommissionsSummary(enabled = true) {
  return useQuery({
    queryKey: ["admin-commissions-summary"],
    enabled,
    queryFn: async () => {
      const response = await api.get<CommissionSummary>("/admin/commissions");
      return response.data;
    },
  });
}

export function useAdminCommissionSources(skip: number = 0, limit: number = 100, enabled = true) {
  return useQuery({
    queryKey: ["admin-commission-sources", skip, limit],
    enabled,
    queryFn: async () => {
      const response = await api.get<CommissionSourceItem[]>("/admin/commissions/sources", {
        params: { skip, limit },
      });
      return response.data;
    },
  });
}

export function useWithdrawCommissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ amount, reason }: { amount: number; reason?: string }) => {
      const response = await api.post<AdminCommissionWithdrawalResponse>("/admin/commissions/withdraw", {
        amount,
        reason,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-commissions-summary"] });
      queryClient.invalidateQueries({ queryKey: ["admin-payouts-overview"] });
      queryClient.invalidateQueries({ queryKey: ["admin-financial-summary"] });
    },
  });
}

export function useWithdrawCampaignFunds() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ campaignId, amount }: { campaignId: number; amount: number }) => {
      const response = await api.post<CampaignWithdrawalResponse>("/payments/withdraw", {
        campaign_id: campaignId,
        amount,
      });
      return { ...response.data, campaignId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["my-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["session", "me"] });
      queryClient.invalidateQueries({ queryKey: ["campaign-withdrawal-summary", variables.campaignId] });
    },
  });
}

export function useCampaignWithdrawalSummary(campaignId?: number, enabled = true) {
  return useQuery({
    queryKey: ["campaign-withdrawal-summary", campaignId],
    enabled: enabled && Boolean(campaignId),
    queryFn: async () => {
      const response = await api.get<CampaignWithdrawalSummaryResponse>(`/payments/withdraw/summary/${campaignId}`);
      return response.data;
    },
  });
}

// ===== Admin Global Search =====

export function useAdminGlobalSearch(
  q: string | undefined,
  models?: string,
  page = 1,
  pageSize = 20,
  enabled = true,
) {
  return useQuery({
    queryKey: ["admin-global-search", q, models, page, pageSize],
    enabled: enabled && !!q && q.trim().length > 0,
    queryFn: async () => {
      const params: Record<string, unknown> = { page, page_size: pageSize };
      if (q) params.q = q;
      if (models) params.models = models;
      const response = await api.get<AdminSearchResponse>("/search", { params });
      return response.data;
    },
  });
}
