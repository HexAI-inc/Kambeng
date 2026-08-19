"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useSearchParams } from "next/navigation";
import { ThunderboltOutlined, CreditCardOutlined, LockOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";

import { api } from "@/lib/api";
import { useCampaignGoals } from "@/hooks/use-frontend-data";
import type { CampaignDiscoveryItem, CampaignGoal } from "@/types/frontend";

const QUICK_AMOUNTS = [50, 100, 200, 500, 1000];
type PaymentMethod = "wave" | "aps" | "card";

// ─────────────────────────────────────────────────────────────
// Tiny utility components
// ─────────────────────────────────────────────────────────────
function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #1dc5ff, #079bd4)", borderRadius: 3, transition: "width 0.6s ease" }} />
    </div>
  );
}

function VisaIcon() {
  return (
    <svg width="34" height="22" viewBox="0 0 34 22" fill="none">
      <rect width="34" height="22" rx="4" fill="#1a1f71" />
      <path d="M14 15.5H11.5l1.5-9H15L14 15.5zm7.5-8.8c-.5-.2-1.3-.4-2.2-.4-2.5 0-4.2 1.3-4.2 3.2 0 1.4 1.2 2.1 2.1 2.6 1 .5 1.3.8 1.3 1.2 0 .6-.8 1-1.5 1-.9 0-1.5-.1-2.3-.5l-.3-.2-.4 2.1c.6.2 1.6.5 2.7.5 2.5 0 4.2-1.2 4.2-3.3 0-1.1-.7-2-2.1-2.7-.9-.4-1.4-.7-1.4-1.2 0-.4.5-.8 1.4-.8.8 0 1.4.2 1.8.4l.2.1.4-2zm5.5-.2H25c-.4 0-.7.1-1 .5L21 15.5h2.5l.5-1.5h3.1l.3 1.5H30l-2.5-9zm-3 5.5l.9-2.7.6 2.7h-1.5zM10.5 6.5l-2.5 6-.3-1.3c-.4-1.4-1.8-3-3.3-3.7l2.3 8.5H9.2l3.8-9.5h-2.5z" fill="#fff" />
      <path d="M5.8 6.5H1.9l-.1.3c3 .8 5 2.7 5.8 4.9L6.8 7.2C6.6 6.7 6.2 6.5 5.8 6.5z" fill="#f9a533" />
    </svg>
  );
}

function MastercardIcon() {
  return (
    <svg width="34" height="22" viewBox="0 0 34 22" fill="none">
      <rect width="34" height="22" rx="4" fill="#252525" />
      <circle cx="13" cy="11" r="6.5" fill="#eb001b" />
      <circle cx="21" cy="11" r="6.5" fill="#f79e1b" />
      <path d="M17 5.8A6.5 6.5 0 0121 11a6.5 6.5 0 01-4 5.2A6.5 6.5 0 0113 11a6.5 6.5 0 014-5.2z" fill="#ff5f00" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Payment method tab selector
// ─────────────────────────────────────────────────────────────
const METHODS: { id: PaymentMethod; label: string; shortLabel: string }[] = [
  { id: "wave", label: "Wave Money", shortLabel: "Wave" },
  { id: "aps", label: "APS Money", shortLabel: "APS" },
  { id: "card", label: "Card", shortLabel: "Card" },
];

const METHOD_ACCENT: Record<PaymentMethod, string> = {
  wave: "#1dc5ff",
  aps: "#f59e0b",
  card: "#6366f1",
};

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────
export default function QuickPayPage() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const slug = params?.slug ?? "";

  const [amount, setAmount] = useState("");
  const [donorName, setDonorName] = useState("");
  const [donorEmail, setDonorEmail] = useState("");
  const [message, setMessage] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("wave");
  const [apsPhone, setApsPhone] = useState("");
  const [apsStep, setApsStep] = useState<"phone" | "otp">("phone");
  const [apsOtp, setApsOtp] = useState("");
  const [apsClientReference, setApsClientReference] = useState<string | null>(null);
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

  const accent = METHOD_ACCENT[paymentMethod];

  const validateCommon = (): number | null => {
    if (!campaign) { setError("Campaign details not ready."); return null; }
    if (selectedGoalId && !selectedGoal) { setError("That goal is no longer accepting funding."); return null; }
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) { setError("Enter a valid donation amount greater than 0."); return null; }
    setError(null);
    return parsed;
  };

  // Card and APS both require an email on the gateway's side (an identity
  // step) — Wave doesn't, so this is only checked for those two methods.
  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const handleWaveDonate = async () => {
    const parsed = validateCommon();
    if (parsed === null || !campaign) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/backend/payments/donate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_id: campaign.id,
          goal_id: selectedGoalId ?? undefined,
          amount: parsed,
          donor_name: donorName.trim() || "Anonymous",
          message: message.trim() || undefined,
        }),
      });
      const payload = await res.json().catch(() => ({})) as { redirect_url?: string; detail?: string };
      if (!res.ok) throw new Error(payload.detail ?? "Unable to initiate donation.");
      if (!payload.redirect_url) throw new Error("No redirect URL returned.");
      window.location.assign(payload.redirect_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to initiate donation.");
      setIsSubmitting(false);
    }
  };

  // Card donations route through the gateway's Waychit Card rail — same
  // hosted-page redirect pattern as Wave, just a different `provider`.
  const handleCardDonate = async () => {
    const parsed = validateCommon();
    if (parsed === null || !campaign) return;
    if (!isValidEmail(donorEmail)) { setError("Enter a valid email address."); return; }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/backend/payments/donate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_id: campaign.id,
          goal_id: selectedGoalId ?? undefined,
          amount: parsed,
          donor_name: donorName.trim() || "Anonymous",
          message: message.trim() || undefined,
          provider: "waychit_card",
          customer_email: donorEmail.trim(),
        }),
      });
      const payload = await res.json().catch(() => ({})) as { redirect_url?: string; detail?: string };
      if (!res.ok) throw new Error(payload.detail ?? "Unable to initiate donation.");
      if (!payload.redirect_url) throw new Error("No redirect URL returned.");
      window.location.assign(payload.redirect_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to initiate donation.");
      setIsSubmitting(false);
    }
  };

  // APS is a two-step wallet + OTP charge, no redirect. Step 1 sends the
  // phone number and gets back a request_token; step 2 submits the code
  // APS texted the donor to actually charge the wallet.
  const handleApsSendCode = async () => {
    const parsed = validateCommon();
    if (parsed === null || !campaign) return;
    if (apsPhone.trim().length < 6) { setError("Enter a valid mobile number."); return; }
    if (!isValidEmail(donorEmail)) { setError("Enter a valid email address."); return; }
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/backend/payments/donate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_id: campaign.id,
          goal_id: selectedGoalId ?? undefined,
          amount: parsed,
          donor_name: donorName.trim() || "Anonymous",
          message: message.trim() || undefined,
          provider: "aps",
          customer_mobile: `+220${apsPhone}`,
          customer_email: donorEmail.trim(),
        }),
      });
      const payload = await res.json().catch(() => ({})) as { client_reference?: string; otp_required?: boolean; detail?: string };
      if (!res.ok) throw new Error(payload.detail ?? "Unable to send verification code.");
      if (!payload.otp_required || !payload.client_reference) throw new Error("Unexpected response from server.");
      setApsClientReference(payload.client_reference);
      setApsStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send verification code.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApsConfirmCode = async () => {
    if (!apsClientReference) return;
    if (apsOtp.trim().length < 4) { setError("Enter the code you were texted."); return; }
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/backend/payments/aps/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_reference: apsClientReference, otp: apsOtp.trim() }),
      });
      const payload = await res.json().catch(() => ({})) as { status?: string; detail?: string };
      if (!res.ok) throw new Error(payload.detail ?? "Could not confirm the code. Please try again.");
      if (payload.status === "SUCCEEDED") {
        window.location.assign(`/payment/success?ref=${apsClientReference}&slug=${slug}`);
      } else {
        window.location.assign(`/payment/failed?ref=${apsClientReference}&slug=${slug}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm the code. Please try again.");
      setIsSubmitting(false);
    }
  };

  const inputStyle = {
    width: "100%", padding: "12px 16px", borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)",
    color: "#f0f6ff", fontSize: 15, outline: "none",
  };

  const labelStyle = {
    display: "block" as const,
    fontSize: 11, color: "#8899aa", fontWeight: 600 as const,
    marginBottom: 7, letterSpacing: "0.05em",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1a", padding: "32px clamp(16px, 4vw, 48px) 80px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <Link href={`/campaigns/${slug}`} style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#8899aa", fontSize: 14, marginBottom: 32 }}>
          ← Back to campaign
        </Link>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 460px", gap: 32, alignItems: "start" }} className="quick-pay-grid">

          {/* ── Left: Campaign info ── */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
            {isLoading ? (
              <div style={{ background: "#111827", borderRadius: 20, border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
                <div style={{ height: 280, background: "rgba(255,255,255,0.04)" }} />
                <div style={{ padding: 28 }}>
                  {[["30%", 14], ["70%", 24], ["90%", 14]].map(([w, h], i) => (
                    <div key={i} style={{ height: h as number, width: w as string, background: "rgba(255,255,255,0.05)", borderRadius: 6, marginBottom: 16 }} />
                  ))}
                </div>
              </div>
            ) : campaign ? (
              <div style={{ background: "#111827", borderRadius: 20, border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
                {campaign.cover_image_url && (
                  <div style={{ position: "relative", height: 280 }}>
                    <Image src={campaign.cover_image_url} alt={campaign.title} fill unoptimized sizes="(max-width: 768px) 100vw, 60vw" style={{ objectFit: "cover" }} />
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, rgba(17,24,39,0.95))" }} />
                  </div>
                )}
                <div style={{ padding: 28 }}>
                  <div style={{ display: "inline-block", padding: "3px 10px", borderRadius: 4, background: "rgba(29,197,255,0.1)", color: "#1dc5ff", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
                    {campaign.mode}
                  </div>
                  <h2 style={{ margin: "0 0 12px", fontSize: 24, fontWeight: 800, color: "#f0f6ff", lineHeight: 1.2 }}>{campaign.title}</h2>
                  <p style={{ margin: "0 0 24px", color: "#8899aa", lineHeight: 1.7, fontSize: 15 }}>{campaign.description}</p>
                  <ProgressBar value={campaign.amount_raised} max={campaign.target_amount ?? 0} />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#1dc5ff" }}>{campaign.amount_raised.toLocaleString()} GMD raised</span>
                    <span style={{ fontSize: 13, color: "#4a5568" }}>{percent.toFixed(0)}% of {(campaign.target_amount ?? 0).toLocaleString()} GMD</span>
                  </div>
                  {activeGoals.length > 0 && (
                    <div style={{ marginTop: 24 }}>
                      <p style={{ color: "#8899aa", fontSize: 12, fontWeight: 600, marginBottom: 12, letterSpacing: "0.05em" }}>ACTIVE GOALS</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {activeGoals.map((goal: CampaignGoal) => {
                          const gPct = Math.min(100, (goal.amount_raised / goal.target_amount) * 100);
                          const active = selectedGoalId === goal.id;
                          return (
                            <div key={goal.id} onClick={() => setSelectedGoalId(active ? null : goal.id)} style={{ padding: "14px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 12, border: active ? "1px solid rgba(29,197,255,0.4)" : "1px solid rgba(255,255,255,0.06)", cursor: "pointer", transition: "all 0.2s" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                                <span style={{ fontSize: 14, fontWeight: 600, color: active ? "#1dc5ff" : "#f0f6ff" }}>{goal.title}</span>
                                <span style={{ fontSize: 12, color: "#4a5568" }}>{gPct.toFixed(0)}%</span>
                              </div>
                              <ProgressBar value={goal.amount_raised} max={goal.target_amount} />
                              <div style={{ fontSize: 12, color: "#4a5568", marginTop: 6 }}>{goal.amount_raised.toLocaleString()} / {goal.target_amount.toLocaleString()} GMD</div>
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

          {/* ── Right: Donation form ── */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.1 }} style={{ position: "sticky", top: 88 }}>
            <div style={{ background: "#111827", borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)", padding: 28, boxShadow: "0 24px 60px rgba(0,0,0,0.4)" }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700, color: "#f0f6ff" }}>Make a donation</h3>
              <p style={{ margin: "0 0 22px", fontSize: 13, color: selectedGoal ? "#1dc5ff" : "#8899aa" }}>
                {selectedGoal ? `Funding: ${selectedGoal.title}` : "General campaign support"}
              </p>

              {/* ── Payment method tabs ── */}
              <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 4, gap: 2, marginBottom: 24 }}>
                {METHODS.map((m) => {
                  const active = paymentMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => { setPaymentMethod(m.id); setError(null); }}
                      style={{
                        flex: 1, padding: "9px 6px", borderRadius: 9, border: "none",
                        background: active ? METHOD_ACCENT[m.id] : "transparent",
                        color: active ? "#fff" : "#6b7a8d",
                        fontSize: 13, fontWeight: active ? 700 : 500,
                        cursor: "pointer", transition: "all 0.2s",
                        boxShadow: active ? `0 4px 14px ${METHOD_ACCENT[m.id]}55` : "none",
                      }}
                    >
                      <span className="tab-long">{m.label}</span>
                      <span className="tab-short" style={{ display: "none" }}>{m.shortLabel}</span>
                    </button>
                  );
                })}
              </div>

              {/* ── Amount ── */}
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>QUICK SELECT (GMD)</label>
                <div className="qp-amounts" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginBottom: 12 }}>
                  {QUICK_AMOUNTS.map((qa) => (
                    <button key={qa} onClick={() => setAmount(String(qa))} style={{
                      padding: "8px 4px", borderRadius: 8,
                      border: amount === String(qa) ? `1px solid ${accent}99` : "1px solid rgba(255,255,255,0.08)",
                      background: amount === String(qa) ? `${accent}18` : "rgba(255,255,255,0.04)",
                      color: amount === String(qa) ? "#f0f6ff" : "#8899aa",
                      fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
                    }}>
                      {qa}
                    </button>
                  ))}
                </div>
                <label style={labelStyle}>AMOUNT (GMD)</label>
                <input
                  type="number" placeholder="Enter custom amount" inputMode="decimal"
                  value={amount} onChange={(e) => setAmount(e.target.value)}
                  style={{ ...inputStyle, fontSize: 16, fontWeight: 600 }}
                  onFocus={(e) => { e.target.style.borderColor = `${accent}66`; }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; }}
                />
              </div>

              {/* ── Donor name ── */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>YOUR NAME</label>
                <input
                  type="text" placeholder="Anonymous"
                  value={donorName} onChange={(e) => setDonorName(e.target.value)}
                  style={inputStyle}
                  onFocus={(e) => { e.target.style.borderColor = `${accent}66`; }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; }}
                />
              </div>

              {/* ── Message ── */}
              <div style={{ marginBottom: 22 }}>
                <label style={labelStyle}>MESSAGE (OPTIONAL)</label>
                <textarea
                  placeholder="Leave a message of support…" rows={3}
                  value={message} onChange={(e) => setMessage(e.target.value)}
                  style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", fontSize: 14 }}
                  onFocus={(e) => { e.target.style.borderColor = `${accent}66`; }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; }}
                />
              </div>

              {/* ── Error ── */}
              {error && (
                <div style={{ padding: "11px 14px", marginBottom: 16, borderRadius: 10, background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.2)", color: "#ff6b6b", fontSize: 13 }}>
                  {error}
                </div>
              )}

              {/* ── Payment-method-specific bottom section ── */}
              <AnimatePresence mode="wait">

                {paymentMethod === "wave" && (
                  <motion.div key="wave" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
                    <button
                      onClick={() => void handleWaveDonate()}
                      disabled={isSubmitting}
                      style={{
                        width: "100%", padding: "14px", borderRadius: 12, border: "none",
                        background: isSubmitting ? "rgba(29,197,255,0.4)" : "linear-gradient(135deg, #1dc5ff, #079bd4)",
                        color: "#fff", fontSize: 16, fontWeight: 700,
                        cursor: isSubmitting ? "not-allowed" : "pointer",
                        boxShadow: isSubmitting ? "none" : "0 8px 24px rgba(29,197,255,0.3)",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        transition: "all 0.2s",
                      }}
                    >
                      <ThunderboltOutlined />
                      {isSubmitting ? "Redirecting to Wave…" : "Donate with Wave"}
                    </button>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center", marginTop: 12 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 2L3 6v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V6l-9-4z" fill="rgba(27,191,136,0.2)" stroke="#1bbf88" strokeWidth="1.5" /><path d="M9 12l2 2 4-4" stroke="#1bbf88" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      <span style={{ fontSize: 11, color: "#4a5568" }}>Secured by Wave Mobile Money</span>
                    </div>
                  </motion.div>
                )}

                {paymentMethod === "aps" && apsStep === "phone" && (
                  <motion.div key="aps-phone" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
                    <div style={{ marginBottom: 14 }}>
                      <label style={labelStyle}>MOBILE NUMBER</label>
                      <div style={{ position: "relative" }}>
                        <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#8899aa", fontSize: 14, fontWeight: 600, userSelect: "none" }}>
                          +220
                        </span>
                        <input
                          type="tel" placeholder="7XX XXXX"
                          value={apsPhone}
                          onChange={(e) => setApsPhone(e.target.value.replace(/\D/g, "").slice(0, 7))}
                          style={{ ...inputStyle, paddingLeft: 62 }}
                          onFocus={(e) => { e.target.style.borderColor = "rgba(245,158,11,0.5)"; }}
                          onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; }}
                        />
                      </div>
                      <p style={{ fontSize: 11, color: "#4a5568", marginTop: 6 }}>
                        APS will text a one-time code to this number to confirm the payment.
                      </p>
                    </div>
                    <div style={{ marginBottom: 14 }}>
                      <label style={labelStyle}>EMAIL</label>
                      <input
                        type="email" placeholder="you@example.com"
                        value={donorEmail} onChange={(e) => setDonorEmail(e.target.value)}
                        style={inputStyle}
                        onFocus={(e) => { e.target.style.borderColor = "rgba(245,158,11,0.5)"; }}
                        onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; }}
                      />
                    </div>
                    <button
                      onClick={() => void handleApsSendCode()}
                      disabled={isSubmitting}
                      style={{
                        width: "100%", padding: "14px", borderRadius: 12, border: "none",
                        background: isSubmitting ? "rgba(245,158,11,0.4)" : "linear-gradient(135deg, #f59e0b, #d97706)",
                        color: "#fff", fontSize: 16, fontWeight: 700,
                        cursor: isSubmitting ? "not-allowed" : "pointer",
                        boxShadow: isSubmitting ? "none" : "0 8px 24px rgba(245,158,11,0.3)",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        transition: "all 0.2s",
                      }}
                    >
                      {isSubmitting ? "Sending code…" : "Send verification code"}
                    </button>
                    <p style={{ fontSize: 11, color: "#4a5568", textAlign: "center", marginTop: 12 }}>
                      Secured by APS Mobile Money
                    </p>
                  </motion.div>
                )}

                {paymentMethod === "aps" && apsStep === "otp" && (
                  <motion.div key="aps-otp" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
                    <div style={{ marginBottom: 14 }}>
                      <label style={labelStyle}>VERIFICATION CODE</label>
                      <input
                        type="text" inputMode="numeric" placeholder="6-digit code" maxLength={10}
                        value={apsOtp}
                        onChange={(e) => setApsOtp(e.target.value.replace(/\D/g, "").slice(0, 10))}
                        style={{ ...inputStyle, textAlign: "center", letterSpacing: "0.3em", fontSize: 20, fontWeight: 700 }}
                        onFocus={(e) => { e.target.style.borderColor = "rgba(245,158,11,0.5)"; }}
                        onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; }}
                      />
                      <p style={{ fontSize: 11, color: "#4a5568", marginTop: 6 }}>
                        Enter the code sent to +220{apsPhone}.{" "}
                        <button
                          type="button"
                          onClick={() => { setApsStep("phone"); setApsOtp(""); setError(null); }}
                          style={{ background: "none", border: "none", padding: 0, color: "#f59e0b", fontSize: 11, fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}
                        >
                          Change number
                        </button>
                      </p>
                    </div>
                    <button
                      onClick={() => void handleApsConfirmCode()}
                      disabled={isSubmitting}
                      style={{
                        width: "100%", padding: "14px", borderRadius: 12, border: "none",
                        background: isSubmitting ? "rgba(245,158,11,0.4)" : "linear-gradient(135deg, #f59e0b, #d97706)",
                        color: "#fff", fontSize: 16, fontWeight: 700,
                        cursor: isSubmitting ? "not-allowed" : "pointer",
                        boxShadow: isSubmitting ? "none" : "0 8px 24px rgba(245,158,11,0.3)",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        transition: "all 0.2s",
                      }}
                    >
                      {isSubmitting ? "Confirming…" : "Confirm payment"}
                    </button>
                  </motion.div>
                )}

                {paymentMethod === "card" && (
                  <motion.div key="card" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 10,
                      background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.18)",
                      borderRadius: 10, padding: "10px 14px", marginBottom: 14,
                    }}>
                      <LockOutlined style={{ color: "#6366f1", fontSize: 13 }} />
                      <span style={{ fontSize: 12, color: "#8899aa", flex: 1 }}>
                        Secured by <strong style={{ color: "#f0f6ff" }}>Waychit</strong>
                      </span>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <VisaIcon />
                        <MastercardIcon />
                      </div>
                    </div>
                    <div style={{ marginBottom: 14 }}>
                      <label style={labelStyle}>EMAIL</label>
                      <input
                        type="email" placeholder="you@example.com"
                        value={donorEmail} onChange={(e) => setDonorEmail(e.target.value)}
                        style={inputStyle}
                        onFocus={(e) => { e.target.style.borderColor = "rgba(99,102,241,0.5)"; }}
                        onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; }}
                      />
                      <p style={{ fontSize: 11, color: "#4a5568", marginTop: 6 }}>
                        We&apos;ll send your receipt here.
                      </p>
                    </div>
                    <button
                      onClick={() => void handleCardDonate()}
                      disabled={isSubmitting}
                      style={{
                        width: "100%", padding: "14px", borderRadius: 12, border: "none",
                        background: isSubmitting ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg, #6366f1, #4f46e5)",
                        color: "#fff", fontSize: 16, fontWeight: 700,
                        cursor: isSubmitting ? "not-allowed" : "pointer",
                        boxShadow: isSubmitting ? "none" : "0 8px 24px rgba(99,102,241,0.3)",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        transition: "all 0.2s",
                      }}
                    >
                      <CreditCardOutlined />
                      {isSubmitting ? "Redirecting to Card checkout…" : "Donate with Card"}
                    </button>
                    <p style={{ fontSize: 11, color: "#4a5568", textAlign: "center", marginTop: 12 }}>
                      You&apos;ll be redirected to a secure page to enter your card details.
                    </p>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </motion.div>

        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .quick-pay-grid { grid-template-columns: 1fr !important; }
          .qp-amounts { grid-template-columns: repeat(3, 1fr) !important; }
          .tab-long { display: none !important; }
          .tab-short { display: inline !important; }
        }
        @media (min-width: 769px) {
          .tab-short { display: none !important; }
          .tab-long { display: inline !important; }
        }
      `}</style>
    </div>
  );
}
