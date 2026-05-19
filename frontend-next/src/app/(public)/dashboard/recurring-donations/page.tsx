"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useUserRecurringDonations, useCancelRecurringDonation, useUpdateRecurringDonation } from "@/hooks/use-frontend-data";

const BLUE = "#1dc5ff";
const GREEN = "#1bbf88";

function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.38, delay, ease: "easeOut" as const },
  };
}

function FreqChip({ freq }: { freq: string }) {
  const map: Record<string, string> = { WEEKLY: "#fbbf24", MONTHLY: BLUE, QUARTERLY: "#a855f7", ANNUAL: GREEN };
  const color = map[freq] ?? "#8899aa";
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const,
      padding: "2px 8px", borderRadius: 20, color, background: `${color}18`,
    }}>{freq}</span>
  );
}

export default function RecurringDonationsPage() {
  const { data, isLoading } = useUserRecurringDonations();
  const { mutate: cancelRecurring, isPending: isCancelling } = useCancelRecurringDonation();
  const { mutate: updateRecurring, isPending: isUpdating } = useUpdateRecurringDonation();

  const donations = data?.recurring_donations ?? [];

  const stats = useMemo(() => ({
    active: donations.filter((d) => d.is_active).length,
    total: donations.length,
    commitment: donations.filter((d) => d.is_active).reduce((s, d) => s + d.amount, 0),
  }), [donations]);

  const handleCancel = (id: number) => {
    if (!confirm("Cancel this recurring donation?")) return;
    cancelRecurring(id);
  };

  const handleToggle = (id: number, isActive: boolean) => {
    updateRecurring({ recurring_donation_id: id, is_active: !isActive });
  };

  return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", padding: "28px clamp(16px, 4vw, 48px)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Header */}
        <motion.div {...fadeUp(0)} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.03em", marginBottom: 4 }}>Recurring Donations</div>
            <div style={{ fontSize: 13, color: "#6b7a8d" }}>Manage your automated donation commitments.</div>
          </div>
          <Link href="/campaigns">
            <button style={{
              padding: "9px 18px", borderRadius: 9, border: "none",
              background: `linear-gradient(135deg, ${BLUE}, #079bd4)`,
              color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
              boxShadow: "0 4px 14px rgba(29,197,255,0.3)",
            }}>Browse campaigns</button>
          </Link>
        </motion.div>

        {/* Stats strip */}
        {!isLoading && donations.length > 0 && (
          <motion.div {...fadeUp(0.06)} style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 14, overflow: "hidden",
          }}>
            {[
              { label: "Active", value: String(stats.active), color: GREEN },
              { label: "Monthly commitment", value: `${stats.commitment.toLocaleString()} GMD`, color: "#f0f6ff" },
              { label: "Total subscriptions", value: String(stats.total), color: BLUE },
            ].map(({ label, value, color }, i, arr) => (
              <div key={label} style={{
                padding: "14px 20px",
                borderRight: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
              }}>
                <div style={{ fontSize: 10, color: "#4a5568", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const, marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color, letterSpacing: "-0.03em" }}>{value}</div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Donations list */}
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[1, 2, 3].map((i) => <div key={i} style={{ height: 100, borderRadius: 12, background: "rgba(255,255,255,0.04)" }} />)}
          </div>
        ) : donations.length === 0 ? (
          <motion.div {...fadeUp(0.08)} style={{
            padding: "52px 28px", textAlign: "center",
            background: "linear-gradient(135deg, rgba(29,197,255,0.03), rgba(7,155,212,0.01))",
            border: "1px dashed rgba(29,197,255,0.18)", borderRadius: 16,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14, margin: "0 auto 16px",
              background: "rgba(29,197,255,0.08)", border: "1px solid rgba(29,197,255,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke={BLUE} strokeWidth="1.8" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#f0f6ff", marginBottom: 6 }}>No recurring donations</div>
            <div style={{ fontSize: 13, color: "#6b7a8d", marginBottom: 20, maxWidth: 340, margin: "0 auto 20px" }}>
              Set up a recurring donation on any campaign to provide consistent, ongoing support.
            </div>
            <Link href="/campaigns">
              <button style={{
                padding: "11px 24px", borderRadius: 10, border: "none",
                background: `linear-gradient(135deg, ${BLUE}, #079bd4)`,
                color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
                boxShadow: "0 4px 16px rgba(29,197,255,0.3)",
              }}>Browse campaigns</button>
            </Link>
          </motion.div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {donations.map((d, idx) => (
              <motion.div key={d.id} {...fadeUp(0.04 * idx)} style={{
                background: "#0d1120",
                border: `1px solid ${d.is_active ? "rgba(27,191,136,0.12)" : "rgba(255,255,255,0.07)"}`,
                borderRadius: 12, padding: "16px 18px",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                  {/* Status indicator */}
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    background: d.is_active ? "rgba(27,191,136,0.1)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${d.is_active ? "rgba(27,191,136,0.25)" : "rgba(255,255,255,0.1)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
                        stroke={d.is_active ? GREEN : "#4a5568"} strokeWidth="1.8" strokeLinejoin="round"/>
                    </svg>
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#f0f6ff" }}>
                        Campaign #{d.campaign_id}
                      </span>
                      <FreqChip freq={d.frequency} />
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 20, letterSpacing: "0.08em", textTransform: "uppercase" as const,
                        color: d.is_active ? GREEN : "#8899aa",
                        background: d.is_active ? "rgba(27,191,136,0.12)" : "rgba(255,255,255,0.06)",
                      }}>{d.is_active ? "Active" : "Paused"}</span>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: GREEN, letterSpacing: "-0.02em", marginBottom: 4 }}>
                      {d.amount.toLocaleString()} GMD <span style={{ fontSize: 12, fontWeight: 500, color: "#4a5568" }}>{d.frequency.toLowerCase()}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#4a5568" }}>
                      Next charge: <span style={{ color: "#8899aa" }}>{new Date(d.next_charge_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                      {d.last_charge_date && (
                        <span> · Last: {new Date(d.last_charge_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <button
                      onClick={() => handleToggle(d.id, d.is_active)}
                      disabled={isUpdating}
                      style={{
                        padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                        border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)",
                        color: "#8899aa",
                      }}
                    >{d.is_active ? "Pause" : "Resume"}</button>
                    <button
                      onClick={() => handleCancel(d.id)}
                      disabled={isCancelling}
                      style={{
                        padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                        border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.07)",
                        color: "#ef4444",
                      }}
                    >Cancel</button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* How it works */}
        <motion.div {...fadeUp(0.18)} style={{
          padding: "20px 22px", borderRadius: 12,
          background: "rgba(29,197,255,0.04)", border: "1px solid rgba(29,197,255,0.12)",
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: BLUE, marginBottom: 12 }}>How recurring donations work</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              "You'll receive a reminder email on your donation date",
              "Each email includes a Pay Now button with your amount pre-filled",
              "Complete payment via Wave — no auto-charge, you stay in control",
              "Pause, resume, or cancel anytime with no penalties",
            ].map((tip, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(29,197,255,0.15)", border: "1px solid rgba(29,197,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: BLUE }}>{i + 1}</span>
                </div>
                <span style={{ fontSize: 13, color: "#6b7a8d", lineHeight: 1.6 }}>{tip}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
