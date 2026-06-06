"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useSearchParams } from "next/navigation";
import { ThunderboltOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";

import { api } from "@/lib/api";
import { useCampaignGoals } from "@/hooks/use-frontend-data";
import type { CampaignDiscoveryItem, CampaignGoal } from "@/types/frontend";

const QUICK_AMOUNTS = [50, 100, 200, 500, 1000];

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
      <div style={{
        height: "100%",
        width: `${pct}%`,
        background: "linear-gradient(90deg, #1dc5ff, #079bd4)",
        borderRadius: 3,
        transition: "width 0.6s ease",
      }} />
    </div>
  );
}

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

  const { data: campaign, isLoading } = useQuery({
    queryKey: ["quick-pay-campaign", slug],
    enabled: Boolean(slug),
    queryFn: async () => {
      const response = await api.get<CampaignDiscoveryItem>(`/campaigns/${slug}`);
      return response.data;
    },
  });

  const { data: goals } = useCampaignGoals(slug, Boolean(slug));
  const activeGoals = (goals ?? []).filter((g) => g.status === "ACTIVE");
  const selectedGoal = activeGoals.find((g) => g.id === selectedGoalId) ?? null;
  const percent = campaign?.target_amount
    ? Math.min((campaign.amount_raised / campaign.target_amount) * 100, 100)
    : 0;

  const handleDonate = async () => {
    if (!campaign) { setError("Campaign details not ready."); return; }
    if (selectedGoalId && !selectedGoal) { setError("That goal is no longer accepting funding."); return; }
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
      if (!response.ok) throw new Error(payload?.detail ?? "Unable to initiate donation.");
      const redirectUrl = payload?.redirect_url as string | undefined;
      if (!redirectUrl) throw new Error("Payment session started but no redirect URL returned.");
      window.location.assign(redirectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to initiate donation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1a", padding: "32px clamp(16px, 4vw, 48px) 80px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Back link */}
        <Link href={`/campaigns/${slug}`} style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          color: "#8899aa", fontSize: 14, marginBottom: 32,
          transition: "color 0.2s",
        }}>
          ← Back to campaign
        </Link>

        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 420px",
          gap: 32,
          alignItems: "start",
        }}
          className="quick-pay-grid"
        >
          {/* Campaign info */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
          >
            {isLoading ? (
              <div style={{
                background: "#111827", borderRadius: 20,
                border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden",
              }}>
                <div style={{ height: 280, background: "rgba(255,255,255,0.04)" }} />
                <div style={{ padding: 28 }}>
                  <div style={{ height: 14, width: "30%", background: "rgba(255,255,255,0.06)", borderRadius: 6, marginBottom: 16 }} />
                  <div style={{ height: 24, width: "70%", background: "rgba(255,255,255,0.06)", borderRadius: 6, marginBottom: 12 }} />
                  <div style={{ height: 14, width: "90%", background: "rgba(255,255,255,0.04)", borderRadius: 6 }} />
                </div>
              </div>
            ) : campaign ? (
              <div style={{
                background: "#111827", borderRadius: 20,
                border: "1px solid rgba(255,255,255,0.06)",
                overflow: "hidden",
              }}>
                {campaign.cover_image_url && (
                  <div style={{ position: "relative", height: 280 }}>
                    <Image
                      src={campaign.cover_image_url}
                      alt={campaign.title}
                      fill unoptimized
                      sizes="(max-width: 768px) 100vw, 60vw"
                      style={{ objectFit: "cover" }}
                    />
                    <div style={{
                      position: "absolute", inset: 0,
                      background: "linear-gradient(to bottom, transparent 40%, rgba(17,24,39,0.95))",
                    }} />
                  </div>
                )}
                <div style={{ padding: 28 }}>
                  <div style={{
                    display: "inline-block",
                    padding: "3px 10px", borderRadius: 4,
                    background: "rgba(29,197,255,0.1)",
                    color: "#1dc5ff", fontSize: 11, fontWeight: 600,
                    textTransform: "uppercase", letterSpacing: "0.05em",
                    marginBottom: 12,
                  }}>
                    {campaign.mode}
                  </div>
                  <h2 style={{
                    margin: "0 0 12px", fontSize: 24, fontWeight: 800,
                    color: "#f0f6ff", lineHeight: 1.2,
                  }}>
                    {campaign.title}
                  </h2>
                  <p style={{ margin: "0 0 24px", color: "#8899aa", lineHeight: 1.7, fontSize: 15 }}>
                    {campaign.description}
                  </p>

                  {/* Progress */}
                  <ProgressBar value={campaign.amount_raised} max={campaign.target_amount ?? 0} />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#1dc5ff" }}>
                      {campaign.amount_raised.toLocaleString()} GMD raised
                    </span>
                    <span style={{ fontSize: 13, color: "#4a5568" }}>
                      {percent.toFixed(0)}% of {(campaign.target_amount ?? 0).toLocaleString()} GMD
                    </span>
                  </div>

                  {/* Goals */}
                  {activeGoals.length > 0 && (
                    <div style={{ marginTop: 24 }}>
                      <p style={{ color: "#8899aa", fontSize: 13, fontWeight: 600, marginBottom: 12 }}>ACTIVE GOALS</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {activeGoals.map((goal: CampaignGoal) => {
                          const gPct = Math.min(100, (goal.amount_raised / goal.target_amount) * 100);
                          return (
                            <div key={goal.id} style={{
                              padding: "14px 16px",
                              background: "rgba(255,255,255,0.03)",
                              borderRadius: 12,
                              border: selectedGoalId === goal.id
                                ? "1px solid rgba(29,197,255,0.4)"
                                : "1px solid rgba(255,255,255,0.06)",
                              cursor: "pointer",
                              transition: "all 0.2s",
                            }}
                              onClick={() => setSelectedGoalId(selectedGoalId === goal.id ? null : goal.id)}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                                <span style={{ fontSize: 14, fontWeight: 600, color: selectedGoalId === goal.id ? "#1dc5ff" : "#f0f6ff" }}>
                                  {goal.title}
                                </span>
                                <span style={{ fontSize: 12, color: "#4a5568" }}>
                                  {gPct.toFixed(0)}%
                                </span>
                              </div>
                              <ProgressBar value={goal.amount_raised} max={goal.target_amount} />
                              <div style={{ fontSize: 12, color: "#4a5568", marginTop: 6 }}>
                                {goal.amount_raised.toLocaleString()} / {goal.target_amount.toLocaleString()} GMD
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </motion.div>

          {/* Donation form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            style={{ position: "sticky", top: 88 }}
          >
            <div style={{
              background: "#111827",
              borderRadius: 20,
              border: "1px solid rgba(255,255,255,0.08)",
              padding: 28,
              boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
            }}>
              <h3 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 700, color: "#f0f6ff" }}>
                Make a donation
              </h3>
              {selectedGoal && (
                <p style={{ margin: "0 0 20px", fontSize: 13, color: "#1dc5ff" }}>
                  Funding: {selectedGoal.title}
                </p>
              )}
              {!selectedGoal && (
                <p style={{ margin: "0 0 20px", fontSize: 13, color: "#8899aa" }}>
                  General campaign support
                </p>
              )}

              {/* Quick amounts */}
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 12, color: "#8899aa", fontWeight: 600, marginBottom: 10, letterSpacing: "0.05em" }}>
                  QUICK SELECT (GMD)
                </p>
                <div className="qp-amounts" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
                  {QUICK_AMOUNTS.map((qa) => (
                    <button
                      key={qa}
                      onClick={() => setAmount(String(qa))}
                      style={{
                        padding: "8px 4px",
                        borderRadius: 8,
                        border: amount === String(qa)
                          ? "1px solid rgba(29,197,255,0.5)"
                          : "1px solid rgba(255,255,255,0.08)",
                        background: amount === String(qa)
                          ? "rgba(29,197,255,0.1)"
                          : "rgba(255,255,255,0.04)",
                        color: amount === String(qa) ? "#1dc5ff" : "#8899aa",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                    >
                      {qa}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, color: "#8899aa", fontWeight: 600, marginBottom: 8, letterSpacing: "0.04em" }}>
                    AMOUNT (GMD)
                  </label>
                  <input
                    type="number"
                    placeholder="Enter custom amount"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(255,255,255,0.05)",
                      color: "#f0f6ff",
                      fontSize: 16,
                      fontWeight: 600,
                      outline: "none",
                    }}
                    onFocus={(e) => { e.target.style.borderColor = "rgba(29,197,255,0.4)"; }}
                    onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 13, color: "#8899aa", fontWeight: 600, marginBottom: 8, letterSpacing: "0.04em" }}>
                    YOUR NAME
                  </label>
                  <input
                    type="text"
                    placeholder="Anonymous"
                    value={donorName}
                    onChange={(e) => setDonorName(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(255,255,255,0.05)",
                      color: "#f0f6ff",
                      fontSize: 15,
                      outline: "none",
                    }}
                    onFocus={(e) => { e.target.style.borderColor = "rgba(29,197,255,0.4)"; }}
                    onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 13, color: "#8899aa", fontWeight: 600, marginBottom: 8, letterSpacing: "0.04em" }}>
                    MESSAGE (OPTIONAL)
                  </label>
                  <textarea
                    placeholder="Leave a message of support..."
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(255,255,255,0.05)",
                      color: "#f0f6ff",
                      fontSize: 14,
                      outline: "none",
                      resize: "vertical",
                      fontFamily: "inherit",
                    }}
                    onFocus={(e) => { e.target.style.borderColor = "rgba(29,197,255,0.4)"; }}
                    onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; }}
                  />
                </div>

                {error && (
                  <div style={{
                    padding: "12px 16px",
                    borderRadius: 10,
                    background: "rgba(255,107,107,0.1)",
                    border: "1px solid rgba(255,107,107,0.2)",
                    color: "#ff6b6b",
                    fontSize: 13,
                  }}>
                    {error}
                  </div>
                )}

                <button
                  onClick={() => void handleDonate()}
                  disabled={isSubmitting}
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: 12,
                    border: "none",
                    background: isSubmitting
                      ? "rgba(29,197,255,0.4)"
                      : "linear-gradient(135deg, #1dc5ff, #079bd4)",
                    color: "#fff",
                    fontSize: 16,
                    fontWeight: 700,
                    cursor: isSubmitting ? "not-allowed" : "pointer",
                    boxShadow: isSubmitting ? "none" : "0 8px 24px rgba(29,197,255,0.35)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    transition: "all 0.2s",
                  }}
                >
                  <ThunderboltOutlined /> {isSubmitting ? "Redirecting to Wave..." : "Donate with Wave"}
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center", marginTop: 4 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 2L3 6v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V6l-9-4z" fill="rgba(27,191,136,0.2)" stroke="#1bbf88" strokeWidth="1.5"/><path d="M9 12l2 2 4-4" stroke="#1bbf88" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <span style={{ fontSize: 12, color: "#4a5568" }}>
                    Secured by Wave Mobile Money
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .quick-pay-grid { grid-template-columns: 1fr !important; }
          .qp-amounts { grid-template-columns: repeat(3, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}
