"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useUserRecurringDonations, useCancelRecurringDonation, useUpdateRecurringDonation } from "@/hooks/use-frontend-data";

const BLUE = "#14784a";
const GREEN = "#1f9960";

function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.38, delay, ease: "easeOut" as const },
  };
}

function FreqChip({ freq }: { freq: string }) {
  const map: Record<string, string> = { WEEKLY: "#d9870b", MONTHLY: BLUE, QUARTERLY: "#b9500b", ANNUAL: GREEN };
  const color = map[freq] ?? "#56625b";
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
    <div style={{ minHeight: "100vh", padding: "28px clamp(16px, 4vw, 48px)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Header */}
        <motion.div {...fadeUp(0)} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#15201a", letterSpacing: "-0.03em", marginBottom: 4 }}>Recurring Donations</div>
            <div style={{ fontSize: 13, color: "#626d66" }}>Manage your automated donation commitments.</div>
          </div>
          <Link href="/campaigns">
            <button style={{
              padding: "9px 18px", borderRadius: 9, border: "none",
              background: `${BLUE}`,
              color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
              boxShadow: "0 4px 14px rgba(20,120,74,0.3)",
            }}>Browse campaigns</button>
          </Link>
        </motion.div>

        {/* Stats strip */}
        {!isLoading && donations.length > 0 && (
          <motion.div {...fadeUp(0.06)} style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2,
            background: "#fff", border: "1px solid rgba(21,32,26,0.07)",
            borderRadius: 14, overflow: "hidden",
          }}>
            {[
              { label: "Active", value: String(stats.active), color: GREEN },
              { label: "Monthly commitment", value: `${stats.commitment.toLocaleString()} GMD`, color: "#15201a" },
              { label: "Total subscriptions", value: String(stats.total), color: BLUE },
            ].map(({ label, value, color }, i, arr) => (
              <div key={label} style={{
                padding: "14px 20px",
                borderRight: i < arr.length - 1 ? "1px solid rgba(21,32,26,0.05)" : "none",
              }}>
                <div style={{ fontSize: 10, color: "#6e7872", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const, marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color, letterSpacing: "-0.03em" }}>{value}</div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Donations list */}
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[1, 2, 3].map((i) => <div key={i} style={{ height: 100, borderRadius: 12, background: "#fff" }} />)}
          </div>
        ) : donations.length === 0 ? (
          <motion.div {...fadeUp(0.08)} style={{
            padding: "52px 28px", textAlign: "center",
            background: "#f1f8f4",
            border: "1px dashed rgba(20,120,74,0.18)", borderRadius: 16,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14, margin: "0 auto 16px",
              background: "#ecf4f1", border: "1px solid rgba(20,120,74,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke={BLUE} strokeWidth="1.8" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#15201a", marginBottom: 6 }}>No recurring donations</div>
            <div style={{ fontSize: 13, color: "#626d66", marginBottom: 20, maxWidth: 340, margin: "0 auto 20px" }}>
              Set up a recurring donation on any campaign to provide consistent, ongoing support.
            </div>
            <Link href="/campaigns">
              <button style={{
                padding: "11px 24px", borderRadius: 10, border: "none",
                background: `${BLUE}`,
                color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
                boxShadow: "0 4px 16px rgba(20,120,74,0.3)",
              }}>Browse campaigns</button>
            </Link>
          </motion.div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {donations.map((d, idx) => (
              <motion.div key={d.id} {...fadeUp(0.04 * idx)} style={{
                background: "#ffffff",
                border: `1px solid ${d.is_active ? "rgba(31,153,96,0.12)" : "rgba(21,32,26,0.07)"}`,
                borderRadius: 12, padding: "16px 18px",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                  {/* Status indicator */}
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    background: d.is_active ? "rgba(31,153,96,0.1)" : "rgba(21,32,26,0.05)",
                    border: `1px solid ${d.is_active ? "rgba(31,153,96,0.25)" : "rgba(21,32,26,0.1)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
                        stroke={d.is_active ? GREEN : "#6e7872"} strokeWidth="1.8" strokeLinejoin="round"/>
                    </svg>
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#15201a" }}>
                        Campaign #{d.campaign_id}
                      </span>
                      <FreqChip freq={d.frequency} />
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 20, letterSpacing: "0.08em", textTransform: "uppercase" as const,
                        color: d.is_active ? GREEN : "#56625b",
                        background: d.is_active ? "rgba(31,153,96,0.12)" : "rgba(21,32,26,0.06)",
                      }}>{d.is_active ? "Active" : "Paused"}</span>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: GREEN, letterSpacing: "-0.02em", marginBottom: 4 }}>
                      {d.amount.toLocaleString()} GMD <span style={{ fontSize: 12, fontWeight: 500, color: "#6e7872" }}>{d.frequency.toLowerCase()}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#6e7872" }}>
                      Next charge: <span style={{ color: "#56625b" }}>{new Date(d.next_charge_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
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
                        border: "1px solid rgba(21,32,26,0.1)", background: "#fff",
                        color: "#56625b",
                      }}
                    >{d.is_active ? "Pause" : "Resume"}</button>
                    <button
                      onClick={() => handleCancel(d.id)}
                      disabled={isCancelling}
                      style={{
                        padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                        border: "1px solid rgba(239,68,68,0.2)", background: "#fef2f2",
                        color: "#d42f2f",
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
          background: "#f6faf8", border: "1px solid rgba(20,120,74,0.12)",
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
                <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#dcebe4", border: "1px solid rgba(20,120,74,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: BLUE }}>{i + 1}</span>
                </div>
                <span style={{ fontSize: 13, color: "#626d66", lineHeight: 1.6 }}>{tip}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
