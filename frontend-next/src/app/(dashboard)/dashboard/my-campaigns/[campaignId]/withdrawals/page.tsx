"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";

import { useAppFeedback } from "@/components/ui";
import { useCampaignWithdrawalSummary, useSessionProfile, useWithdrawCampaignFunds } from "@/hooks/use-frontend-data";
import { WithdrawalRequestsPanel } from "@/components/campaigns/withdrawal-requests";

const BLUE = "#14784a";
const GREEN = "#1f9960";

function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.38, delay, ease: "easeOut" as const },
  };
}

function fmt(value: number) {
  return value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M`
    : value >= 1_000 ? `${(value / 1_000).toFixed(1)}K`
    : Math.round(value).toLocaleString();
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    ACTIVE: { color: GREEN, bg: "#e4f3ec" },
    DRAFT: { color: "#d9870b", bg: "#fbf3e7" },
    PAUSED: { color: "#56625b", bg: "rgba(21,32,26,0.06)" },
    COMPLETED: { color: BLUE, bg: "#e8f2ed" },
    REJECTED: { color: "#d42f2f", bg: "#fdecec" },
  };
  const chip = map[status] ?? map.PAUSED;

  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const,
      padding: "2px 8px", borderRadius: 20, color: chip.color, background: chip.bg,
    }}>
      {status}
    </span>
  );
}

export default function CampaignWithdrawalsPage() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const params = useParams();
  const { message } = useAppFeedback();
  const withdrawMutation = useWithdrawCampaignFunds();

  const campaignId = Array.isArray(params?.campaignId)
    ? Number(params.campaignId[0])
    : Number(params?.campaignId);

  const { data: me, isLoading: sessionLoading } = useSessionProfile(true);
  const { data: summary, isLoading: summaryLoading, isError: summaryError } = useCampaignWithdrawalSummary(
    Number.isNaN(campaignId) ? undefined : campaignId,
    true,
  );
  const [grossAmount, setGrossAmount] = useState("");

  const kycApproved = me?.kyc_status === "APPROVED";
  // Clamp: legacy over-withdrawn campaigns can report a negative balance
  const availableBalance = Math.max(0, summary?.available_balance ?? 0);
  const withdrawalHistory = summary?.withdrawal_history ?? [];
  const orgBlocked = Boolean(summary?.withdrawal_blocked_reason);
  const canWithdraw = kycApproved && !orgBlocked && Boolean(summary) && availableBalance > 0;
  const payoutNumber = summary?.payout_wave_number ?? me?.wave_number;
  const needsApproval = summary?.approval_threshold != null && Number(grossAmount) > summary.approval_threshold;

  // Live payout preview — estimates mirroring the server's fee structure; the
  // server recomputes exact figures on submit. HPG bills 2% rounded up with a
  // D2 floor (so D2 on anything up to D100), and Kambeng adds its flat D10.
  const WAVE_FEE_RATE = 0.02;
  const WAVE_FEE_MIN_GMD = 2;
  const PLATFORM_FEE_GMD = 10;
  const parsedAmount = Number(grossAmount);
  const previewValid = Number.isFinite(parsedAmount) && parsedAmount > 0;
  // Mirror the server exactly — showing a net the campaigner will not actually
  // receive is how the sub-dalasi payout failure stayed hidden.
  const previewWaveFee = previewValid
    ? Math.max(Math.ceil(parsedAmount * WAVE_FEE_RATE), WAVE_FEE_MIN_GMD)
    : 0;
  const previewNet = previewValid ? parsedAmount - previewWaveFee - PLATFORM_FEE_GMD : 0;

  const handleWithdraw = async () => {
    if (!summary) {
      message.error("Withdrawal summary not available");
      return;
    }

    if (!kycApproved) {
      message.error("Complete KYC before withdrawing funds");
      return;
    }

    if (summary.withdrawal_blocked_reason) {
      message.error(summary.withdrawal_blocked_reason);
      return;
    }

    const amount = Number(grossAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      message.error("Enter a valid amount");
      return;
    }

    // Whole dalasi only — the API rejects bututs.
    if (!Number.isInteger(amount)) {
      message.error("Withdrawals are in whole dalasi — enter a round number.");
      return;
    }

    if (amount > availableBalance) {
      message.error(`You cannot withdraw more than ${fmt(availableBalance)} GMD from this campaign.`);
      return;
    }

    try {
      const result = await withdrawMutation.mutateAsync({ campaignId: summary.campaign_id, amount });
      if (result.status === "PENDING_APPROVAL") {
        message.success(result.message);
      } else {
        message.success(`Withdrawal successful. Net received: ${fmt(result.net_received)} GMD`);
      }
      setGrossAmount("");
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { detail?: string; message?: string } } };
      const detail = axiosErr?.response?.data?.detail ?? axiosErr?.response?.data?.message ?? null;
      message.error(detail ?? "Failed to withdraw funds");
    }
  };

  return (
    <div style={{ minHeight: "100vh", padding: "28px clamp(16px, 4vw, 48px)" }}>
      <div style={{ maxWidth: 980, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
        <motion.div {...fadeUp(0)} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <Link href="/dashboard/my-campaigns" style={{ fontSize: 12, color: "#6e7872", fontWeight: 500 }}>← My Campaigns</Link>
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#15201a", letterSpacing: "-0.03em", marginBottom: 4 }}>
              Withdraw Funds
            </div>
            <div style={{ fontSize: 13, color: "#626d66" }}>
              {summary?.campaign_title ?? ""}
            </div>
          </div>

          <Link href={summary ? `/dashboard/my-campaigns/${summary.campaign_id}/images` : "/dashboard/my-campaigns"}>
            <button style={{
              padding: "9px 16px", borderRadius: 9, border: "1px solid rgba(21,32,26,0.1)",
              background: "#fff", color: "#56625b", fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}>
              Back to campaign
            </button>
          </Link>
        </motion.div>

        {sessionLoading || summaryLoading ? (
          <div style={{ height: 220, borderRadius: 16, background: "#fff" }} />
        ) : summaryError || !summary ? (
          <div style={{ padding: 28, borderRadius: 16, border: "1px dashed rgba(20,120,74,0.2)", background: "#f8fbfa", color: "#626d66" }}>
            Campaign not found. Return to your campaigns list and try again.
          </div>
        ) : (
          <>
            {!kycApproved && (
              <motion.div {...fadeUp(0.04)} style={{ padding: "14px 18px", borderRadius: 12, background: "#fdf3ec", border: "1px solid rgba(232,101,15,0.25)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ fontSize: 13, color: "#e8650f", fontWeight: 600 }}>Identity verification is required before you can withdraw.</div>
                <Link href="/dashboard/kyc" style={{ fontSize: 12, fontWeight: 700, color: "#e8650f", textDecoration: "underline" }}>Complete KYC →</Link>
              </motion.div>
            )}

            {(summary.spent_unaccounted ?? 0) > 0 && (
              <motion.div {...fadeUp(0.05)} style={{ padding: "14px 18px", borderRadius: 12, background: "#fff", border: "1px solid rgba(20,120,74,0.2)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ fontSize: 13, color: "#56625b", maxWidth: 620, lineHeight: 1.5 }}>
                  <strong style={{ color: "#15201a" }}>{fmt(summary.spent_unaccounted ?? 0)} GMD</strong> withdrawn but not yet shown with receipts.
                  Donors give again when they can see where the money went.
                </div>
                <Link href={`/dashboard/my-campaigns/${summary.campaign_id}/updates`} style={{ fontSize: 12, fontWeight: 700, color: BLUE, textDecoration: "underline" }}>Post receipts →</Link>
              </motion.div>
            )}

            {orgBlocked && (
              <motion.div {...fadeUp(0.05)} style={{ padding: "14px 18px", borderRadius: 12, background: "#fdf3ec", border: "1px solid rgba(232,101,15,0.25)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ fontSize: 13, color: "#b9500b", fontWeight: 600, maxWidth: 620, lineHeight: 1.5 }}>
                  {summary.organization_verification_status === "SUBMITTED" || summary.organization_verification_status === "REVIEWING"
                    ? `${summary.organization_name} is under review. Withdrawals open once it's verified.`
                    : `This campaign raises money for ${summary.organization_name}. Verify the organization to withdraw.`}
                </div>
                <Link href="/dashboard/organizations" style={{ fontSize: 12, fontWeight: 700, color: "#b9500b", textDecoration: "underline" }}>Organizations →</Link>
              </motion.div>
            )}

            <motion.div {...fadeUp(0.06)} style={{ background: "#ffffff", border: "1px solid rgba(20,120,74,0.18)", borderRadius: 16, padding: "22px 24px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 11, color: BLUE, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 6 }}>Available to withdraw</div>
                <div style={{ fontSize: "clamp(30px, 5vw, 40px)", fontWeight: 900, color: "#15201a", letterSpacing: "-0.03em", lineHeight: 1 }}>
                  {availableBalance.toLocaleString()} <span style={{ fontSize: 16, color: "#6e7872", fontWeight: 700 }}>GMD</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 10, color: "#6e7872", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const, marginBottom: 4 }}>Raised</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: GREEN }}>{fmt(summary.amount_raised)} GMD</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "#6e7872", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const, marginBottom: 4 }}>Withdrawn</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: "#56625b" }}>{fmt(summary.total_withdrawn)} GMD</div>
                </div>
              </div>
            </motion.div>

            <motion.div {...fadeUp(0.1)} style={{ background: "#ffffff", border: "1px solid rgba(21,32,26,0.07)", borderRadius: 16, padding: 24, maxWidth: isDesktop ? 560 : undefined }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#15201a", marginBottom: 16 }}>Request Withdrawal</div>

              <div style={{ display: "grid", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#56625b", display: "block", marginBottom: 6 }}>Amount (GMD)</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      max={availableBalance > 0 ? Math.floor(availableBalance) : undefined}
                      value={grossAmount}
                      onChange={(e) => setGrossAmount(e.target.value)}
                      placeholder={availableBalance > 0 ? `Up to ${Math.floor(availableBalance).toLocaleString()}` : "Nothing available yet"}
                      disabled={!canWithdraw}
                      style={{
                        width: "100%", padding: "12px 64px 12px 14px", borderRadius: 10,
                        border: "1px solid rgba(21,32,26,0.1)", background: canWithdraw ? "rgba(21,32,26,0.04)" : "rgba(21,32,26,0.03)",
                        color: canWithdraw ? "#15201a" : "#6e7872", fontSize: 14, outline: "none", boxSizing: "border-box",
                      }}
                    />
                    {canWithdraw && (
                      <button
                        onClick={() => setGrossAmount(String(Math.floor(availableBalance)))}
                        style={{
                          position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                          padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(20,120,74,0.3)",
                          background: "#e8f2ed", color: BLUE, fontSize: 11, fontWeight: 700, cursor: "pointer",
                        }}
                      >
                        Max
                      </button>
                    )}
                  </div>
                </div>

                {previewValid && (
                  <div style={{ padding: "14px 16px", borderRadius: 12, background: "#fff", border: "1px solid rgba(21,32,26,0.08)", display: "grid", gap: 7, fontSize: 13 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#56625b" }}>
                      <span>Withdrawal</span><span>{parsedAmount.toLocaleString()} GMD</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#626d66" }}>
                      <span>Wave processing fee (2%, min {WAVE_FEE_MIN_GMD} GMD)</span><span>−{previewWaveFee.toLocaleString()} GMD</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#626d66" }}>
                      <span>Platform fee</span><span>−{PLATFORM_FEE_GMD} GMD</span>
                    </div>
                    <div style={{ borderTop: "1px solid rgba(21,32,26,0.08)", paddingTop: 8, display: "flex", justifyContent: "space-between", fontWeight: 800, color: previewNet > 0 ? GREEN : "#d42f2f" }}>
                      <span>{summary.organization_name && !orgBlocked ? `${summary.organization_name} receives` : "You receive"}{payoutNumber ? ` on ${payoutNumber}` : ""}</span>
                      <span>{previewNet > 0 ? previewNet.toLocaleString() : "0"} GMD</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#56625b" }}>
                      Wave sends whole dalasi only. The {WAVE_FEE_MIN_GMD} GMD minimum processing fee applies to
                      any withdrawal up to {Math.round(WAVE_FEE_MIN_GMD / WAVE_FEE_RATE).toLocaleString()} GMD.
                    </div>
                    {previewNet <= 0 && (
                      <div style={{ fontSize: 12, color: "#d42f2f" }}>Amount is too small to cover the fees.</div>
                    )}
                  </div>
                )}

                {needsApproval && (
                  <div style={{ fontSize: 12, color: "#b9500b", lineHeight: 1.5 }}>
                    Above {summary.approval_threshold?.toLocaleString()} GMD, so another manager has to approve before it&apos;s sent.
                  </div>
                )}

                <button
                  onClick={() => void handleWithdraw()}
                  disabled={!canWithdraw || withdrawMutation.isPending}
                  style={{
                    padding: "12px 20px", borderRadius: 10, border: "none",
                    background: canWithdraw ? `${BLUE}` : "rgba(21,32,26,0.06)",
                    color: canWithdraw ? "#fff" : "#6e7872", fontSize: 14, fontWeight: 700,
                    cursor: canWithdraw ? "pointer" : "not-allowed",
                    boxShadow: canWithdraw ? "0 4px 16px rgba(20,120,74,0.3)" : "none",
                  }}
                >
                  {withdrawMutation.isPending ? "Submitting…" : needsApproval ? "Ask for approval" : "Withdraw funds"}
                </button>
              </div>
            </motion.div>

            {summary.organization_name && (
              <motion.div {...fadeUp(0.14)}>
                <WithdrawalRequestsPanel campaignId={summary.campaign_id} threshold={summary.approval_threshold} />
              </motion.div>
            )}

            <motion.div {...fadeUp(0.18)} style={{ background: "#ffffff", border: "1px solid rgba(21,32,26,0.07)", borderRadius: 16, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(21,32,26,0.06)" }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#15201a" }}>Withdrawal History</div>
                <div style={{ fontSize: 12, color: "#626d66", marginTop: 4 }}>
                  {withdrawalHistory.length} withdrawal{withdrawalHistory.length === 1 ? "" : "s"} recorded for this campaign.
                </div>
              </div>

              {withdrawalHistory.length === 0 ? (
                <div style={{ padding: 28, color: "#626d66", fontSize: 13 }}>No withdrawals yet.</div>
              ) : isDesktop ? (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "#6e7872", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" as const }}>
                      <th style={{ padding: "14px 20px" }}>Date</th>
                      <th style={{ padding: "14px 20px" }}>Reference</th>
                      <th style={{ padding: "14px 20px" }}>Gross</th>
                      <th style={{ padding: "14px 20px" }}>Fees</th>
                      <th style={{ padding: "14px 20px" }}>Net</th>
                      <th style={{ padding: "14px 20px" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withdrawalHistory.map((item, index) => (
                      <tr
                        key={item.id}
                        style={{
                          borderTop: index === 0 ? "1px solid rgba(21,32,26,0.06)" : "1px solid rgba(21,32,26,0.05)",
                          color: "#36443c",
                          fontSize: 13,
                        }}
                      >
                        <td style={{ padding: "14px 20px", whiteSpace: "nowrap" }}>{new Date(item.created_at).toLocaleString()}</td>
                        <td style={{ padding: "14px 20px", fontFamily: "monospace", fontSize: 12 }}>{item.client_reference}</td>
                        <td style={{ padding: "14px 20px" }}>{fmt(item.gross_amount)} GMD</td>
                        <td style={{ padding: "14px 20px" }}>{fmt(item.hexai_fee + item.platform_commission)} GMD</td>
                        <td style={{ padding: "14px 20px", color: GREEN, fontWeight: 700 }}>{fmt(item.net_amount)} GMD</td>
                        <td style={{ padding: "14px 20px" }}>
                          <StatusChip status={item.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {withdrawalHistory.map((item) => (
                    <div key={item.id} style={{
                      padding: "16px 20px",
                      borderTop: "1px solid rgba(21,32,26,0.05)",
                      display: "flex", flexDirection: "column", gap: 10,
                    }}>
                      {/* Top row: status + date */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <StatusChip status={item.status} />
                        <span style={{ fontSize: 11, color: "#6e7872" }}>
                          {new Date(item.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                      {/* Reference */}
                      <div style={{ fontSize: 11, color: "#626d66", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.client_reference}
                      </div>
                      {/* Amounts row */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 10, color: "#6e7872", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 3 }}>Gross</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#36443c" }}>{fmt(item.gross_amount)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: "#6e7872", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 3 }}>Fees</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#36443c" }}>{fmt(item.hexai_fee + item.platform_commission)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: GREEN, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 3 }}>Net</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: GREEN }}>{fmt(item.net_amount)} GMD</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}
