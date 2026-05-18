"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import {
  AppAlert,
  AppButton,
  AppCard,
  AppCol,
  AppInput,
  AppParagraph,
  AppProgress,
  AppRow,
  AppSpace,
  AppText,
  AppTitle,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useCampaignGoals } from "@/hooks/use-frontend-data";
import type { CampaignDiscoveryItem, CampaignGoal } from "@/types/frontend";

export default function QuickPayPage() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const slug = params?.slug;
  const [amount, setAmount] = useState("");
  const [donorName, setDonorName] = useState("");
  const [message, setMessage] = useState("");
  const [selectedGoalId, setSelectedGoalId] = useState<number | null>(
    searchParams?.get("goalId") ? Number(searchParams.get("goalId")) : null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["quick-pay-campaign", slug],
    enabled: Boolean(slug),
    queryFn: async () => {
      const response = await api.get<CampaignDiscoveryItem>(`/campaigns/${slug}`);
      return response.data;
    },
  });

  const campaign = data;
  const { data: goals } = useCampaignGoals(slug, Boolean(slug));
  const availableGoals = goals ?? [];
  const percent = campaign?.target_amount
    ? Math.min((campaign.amount_raised / campaign.target_amount) * 100, 100)
    : 0;

  const activeGoals = availableGoals.filter((goal) => goal.status === "ACTIVE");
  const selectedGoal = activeGoals.find((goal) => goal.id === selectedGoalId) ?? null;

  const handleDonate = async () => {
    if (!campaign) {
      setError("Campaign details are not ready yet.");
      return;
    }

    if (selectedGoalId && !selectedGoal) {
      setError("That campaign goal is no longer accepting funding.");
      return;
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter a valid donation amount greater than 0.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/backend/payments/donate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_id: campaign.id,
          goal_id: selectedGoalId ?? undefined,
          amount: parsedAmount,
          donor_name: donorName.trim() || "Anonymous",
          message: message.trim() || undefined,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.detail ?? "Unable to initiate donation.");
      }

      const redirectUrl = payload?.redirect_url as string | undefined;
      if (!redirectUrl) {
        throw new Error("Payment session started but no redirect URL was returned.");
      }

      window.location.assign(redirectUrl);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to initiate donation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main style={{ padding: "clamp(16px, 4vw, 32px)" }}>
      <AppRow gutter={[24, 24]}>
        <AppCol xs={24} lg={14}>
          <AppCard loading={isLoading} style={{ borderRadius: 0, boxShadow: "var(--shadow)" }}>
            {campaign ? (
              <AppSpace direction="vertical" size={16} style={{ width: "100%" }}>
                <AppText type="secondary">Donate with Wave</AppText>
                <AppTitle level={2} style={{ margin: 0, letterSpacing: "-0.03em" }}>
                  {campaign.title}
                </AppTitle>
                <AppParagraph style={{ fontSize: 16, lineHeight: 1.8, marginBottom: 0 }}>
                  {campaign.description}
                </AppParagraph>
                <AppProgress percent={percent} strokeColor="#1dc5ff" />
                <AppSpace>
                  <AppText>
                    Raised {campaign.amount_raised.toLocaleString()} / {campaign.target_amount?.toLocaleString() ?? "0"} GMD
                  </AppText>
                </AppSpace>
              </AppSpace>
            ) : (
              <AppText type="secondary">Loading donation details...</AppText>
            )}
          </AppCard>
        </AppCol>

        <AppCol xs={24} lg={10}>
          <AppCard style={{ borderRadius: 0, boxShadow: "var(--shadow)" }}>
            <AppSpace direction="vertical" size={14} style={{ width: "100%" }}>
              <AppTitle level={3} style={{ margin: 0 }}>
                Payment details
              </AppTitle>
              <AppInput
                placeholder="Donation amount in GMD"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
              <AppInput
                placeholder="Your name"
                value={donorName}
                onChange={(event) => setDonorName(event.target.value)}
              />
              <div>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  Fund a campaign goal (optional)
                </label>
                <select
                  value={selectedGoalId ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSelectedGoalId(value ? Number(value) : null);
                  }}
                  style={{ width: "100%", minHeight: 42, borderRadius: 8, border: "1px solid var(--line)", padding: "0 12px" }}
                >
                  <option value="">General campaign support</option>
                  {activeGoals.map((goal: CampaignGoal) => (
                    <option key={goal.id} value={goal.id}>
                      {goal.title} - {goal.amount_raised.toLocaleString()} / {goal.target_amount.toLocaleString()} GMD
                    </option>
                  ))}
                </select>
                {selectedGoal ? (
                  <AppText type="secondary" style={{ fontSize: 13, lineHeight: 1.6, display: "block", marginTop: 8 }}>
                    You are funding <strong>{selectedGoal.title}</strong>.
                  </AppText>
                ) : null}
              </div>
              <AppInput.TextArea
                placeholder="Optional message"
                rows={4}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
              <AppButton
                type="primary"
                size="large"
                block
                onClick={() => void handleDonate()}
                loading={isSubmitting}
              >
                Donate with Wave
              </AppButton>
              {error ? <AppAlert type="error" title={error} showIcon /> : null}
              <AppText type="secondary" style={{ fontSize: 13, lineHeight: 1.6 }}>
                You will be redirected to Wave checkout to complete payment securely.
              </AppText>
              <Link href={`/campaigns/${slug}`}>
                <AppButton block>View campaign details</AppButton>
              </Link>
            </AppSpace>
          </AppCard>
        </AppCol>
      </AppRow>
    </main>
  );
}
