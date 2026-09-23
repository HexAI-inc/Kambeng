"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAdminCommissionsSummary, useAdminCommissionSources, useWithdrawCommissions, useCommissionPayoutAccount } from "@/hooks/use-frontend-data";
import type { CommissionSourceItem } from "@/types/frontend";

const BLUE = "#14784a";
const GREEN = "#1f9960";

function fadeUp(delay = 0) {
  return { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35, delay, ease: "easeOut" as const } };
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string; border: string }> = {
    PENDING:   { color: "#e8650f", bg: "rgba(232,101,15,0.1)", border: "rgba(232,101,15,0.25)" },
    SUCCEEDED: { color: GREEN,     bg: "rgba(31,153,96,0.1)", border: "rgba(31,153,96,0.25)" },
    FAILED:    { color: "#d42f2f", bg: "rgba(239,68,68,0.1)",  border: "rgba(239,68,68,0.25)" },
  };
  const s = map[status] ?? map.PENDING;
  return <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 20, color: s.color, background: s.bg, border: `1px solid ${s.border}` }}>{status}</span>;
}

const PAGE_SIZE = 10;

export default function AdminCommissionsPage() {
  const router = useRouter();
  const { data: summary } = useAdminCommissionsSummary(true);
  const { data: sources } = useAdminCommissionSources(0, 100, true);
  const { data: payoutAccount } = useCommissionPayoutAccount(true);
  const withdrawMutation = useWithdrawCommissions();

  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawReason, setWithdrawReason] = useState("");
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) { showToast("Enter a valid amount", false); return; }
    // Whole dalasi only — the API rejects bututs.
    if (!Number.isInteger(amount)) { showToast("Withdrawals are in whole dalasi — enter a round number", false); return; }
    try {
      await withdrawMutation.mutateAsync({ amount, reason: withdrawReason || undefined });
      showToast("Withdrawal request created", true);
      setShowWithdraw(false);
      setWithdrawAmount("");
      setWithdrawReason("");
    } catch { showToast("Failed to create withdrawal", false); }
  };

  const rows = sources ?? [];
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const available = summary?.available_commissions ?? 0;

  return (
    <div style={{ background: "#f6f4ef", minHeight: "100vh", padding: "28px clamp(16px,4vw,48px)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

        {toast && (
          <div style={{ position: "fixed", top: 24, right: 24, zIndex: 999, padding: "12px 20px", borderRadius: 10, background: toast.ok ? "rgba(31,153,96,0.15)" : "rgba(239,68,68,0.15)", border: `1px solid ${toast.ok ? "rgba(31,153,96,0.3)" : "rgba(239,68,68,0.3)"}`, color: toast.ok ? GREEN : "#d42f2f", fontSize: 13, fontWeight: 600, boxShadow: "0 8px 32px rgba(21,32,26,0.12)" }}>{toast.msg}</div>
        )}

        {/* Header */}
        <motion.div {...fadeUp(0)}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#15201a", letterSpacing: "-0.03em" }}>Commissions & Revenue</div>
          <div style={{ fontSize: 13, color: "#626d66", marginTop: 4 }}>Platform fee earnings and withdrawal management</div>
        </motion.div>

        {/* KPI strip */}
        <motion.div {...fadeUp(0.06)}>
          <div className="admin-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2, background: "rgba(21,32,26,0.04)", border: "1px solid rgba(21,32,26,0.07)", borderRadius: 14, overflow: "hidden" }}>
            {[
              { label: "Total earned", value: `${(summary?.total_commissions ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} GMD`, color: "#15201a" },
              { label: "Available", value: `${available.toLocaleString(undefined, { maximumFractionDigits: 0 })} GMD`, color: GREEN },
              { label: "Withdrawn", value: `${(summary?.withdrawn_commissions ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} GMD`, color: BLUE },
              { label: "Pending", value: `${(summary?.pending_commissions ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} GMD`, color: "#e8650f" },
            ].map(({ label, value, color }, i, arr) => (
              <div key={label} style={{ padding: "16px 20px", borderRight: i < arr.length - 1 ? "1px solid rgba(21,32,26,0.05)" : "none" }}>
                <div style={{ fontSize: 10, color: "#6e7872", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color, letterSpacing: "-0.02em" }}>{value}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Payout account info */}
        <motion.div {...fadeUp(0.08)}>
          <div style={{ background: "#ffffff", border: "1px solid rgba(21,32,26,0.07)", borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#6e7872", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>Payouts sent to</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#15201a", fontFamily: "monospace" }}>
                {payoutAccount?.wave_number || <span style={{ color: "#d42f2f" }}>No Wave number configured</span>}
              </div>
              {payoutAccount && (
                <div style={{ fontSize: 11, color: "#6e7872", marginTop: 2 }}>
                  {payoutAccount.source === "config" ? "Platform account (ADMIN_COMMISSION_WAVE_NUMBER)" : `${payoutAccount.admin_name}'s profile Wave number`}
                </div>
              )}
            </div>
            {!payoutAccount?.wave_number && (
              <div style={{ fontSize: 12, color: "#e8650f", padding: "6px 12px", borderRadius: 8, background: "rgba(232,101,15,0.08)", border: "1px solid rgba(232,101,15,0.2)" }}>
                Set ADMIN_COMMISSION_WAVE_NUMBER in .env or update your profile
              </div>
            )}
          </div>
        </motion.div>

        {/* Withdraw button */}
        <motion.div {...fadeUp(0.1)}>
          <button
            onClick={() => setShowWithdraw(true)}
            disabled={available <= 0 || withdrawMutation.isPending || !payoutAccount?.wave_number}
            style={{
              padding: "11px 24px", borderRadius: 10, border: "none",
              background: (available > 0 && payoutAccount?.wave_number) ? `${BLUE}` : "rgba(21,32,26,0.06)",
              color: (available > 0 && payoutAccount?.wave_number) ? "#fff" : "#6e7872",
              fontSize: 13, fontWeight: 700, cursor: (available > 0 && payoutAccount?.wave_number) ? "pointer" : "not-allowed",
              boxShadow: (available > 0 && payoutAccount?.wave_number) ? "0 4px 16px rgba(20,120,74,0.3)" : "none",
            }}
          >
            {withdrawMutation.isPending ? "Processing…" : "Withdraw Available Commissions"}
          </button>
        </motion.div>

        {/* Withdraw modal */}
        {showWithdraw && (
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} style={{ background: "#ffffff", border: "1px solid rgba(20,120,74,0.2)", borderRadius: 14, padding: "22px 24px" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#15201a", marginBottom: 4 }}>Withdraw Commissions</div>
            <div style={{ fontSize: 13, color: "#626d66", marginBottom: 6 }}>
              Available: <span style={{ color: GREEN, fontWeight: 700 }}>{available.toLocaleString(undefined, { maximumFractionDigits: 0 })} GMD</span>
            </div>
            <div style={{ fontSize: 12, color: "#6e7872", marginBottom: 18 }}>
              Funds will be sent to <span style={{ color: "#15201a", fontFamily: "monospace" }}>{payoutAccount?.wave_number}</span> via Wave.
              HexAI deducts a 2% processing fee on the payout, with a 2 GMD minimum (so 2 GMD on anything up
              to 100 GMD). Wave only sends whole dalasi — any remaining bututs stay in the available balance
              for the next withdrawal.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#56625b", display: "block", marginBottom: 6 }}>Amount (GMD)</label>
                <input
                  type="number" min="1" step="1" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder={`Max: ${Math.floor(available).toLocaleString()}`}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 9, border: "1px solid rgba(21,32,26,0.1)", background: "rgba(21,32,26,0.05)", color: "#15201a", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#56625b", display: "block", marginBottom: 6 }}>Reason (optional)</label>
                <input
                  value={withdrawReason} onChange={(e) => setWithdrawReason(e.target.value)}
                  placeholder="Why are you withdrawing?"
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 9, border: "1px solid rgba(21,32,26,0.1)", background: "rgba(21,32,26,0.05)", color: "#15201a", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={() => void handleWithdraw()} disabled={withdrawMutation.isPending} style={{ padding: "9px 22px", borderRadius: 9, border: "none", background: `${BLUE}`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {withdrawMutation.isPending ? "Processing…" : "Confirm Withdrawal"}
              </button>
              <button onClick={() => setShowWithdraw(false)} style={{ padding: "9px 20px", borderRadius: 9, border: "1px solid rgba(21,32,26,0.1)", background: "rgba(21,32,26,0.04)", color: "#56625b", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            </div>
          </motion.div>
        )}

        {/* Sources table */}
        <motion.div {...fadeUp(0.14)}>
          <div style={{ background: "#ffffff", border: "1px solid rgba(21,32,26,0.07)", borderRadius: 16, overflowX: "auto" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(21,32,26,0.06)", fontSize: 13, fontWeight: 700, color: "#15201a" }}>Commission Sources</div>
            <div className="admin-table-wrap" style={{ minWidth: 720 }}>
            <div className="admin-table-header" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 130px 130px 110px 100px 110px", padding: "10px 18px", borderBottom: "1px solid rgba(21,32,26,0.06)", fontSize: 10, fontWeight: 700, color: "#6e7872", textTransform: "uppercase", letterSpacing: "0.07em" }}>
              <div>Campaign</div><div>User</div><div>Gross</div><div>Commission</div><div>Status</div><div>Date</div><div>Actions</div>
            </div>

            {rows.length === 0 ? (
              <div style={{ padding: "48px 24px", textAlign: "center", color: "#6e7872", fontSize: 14 }}>No commission sources yet</div>
            ) : pageRows.map((s: CommissionSourceItem, i: number) => (
              <div key={i} className="admin-table-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 130px 130px 110px 100px 110px", padding: "13px 18px", alignItems: "center", borderBottom: "1px solid rgba(21,32,26,0.04)", transition: "background 0.15s" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(21,32,26,0.02)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = ""; }}
              >
                <div data-label="Campaign">
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#15201a" }}>{s.campaign_title}</div>
                </div>
                <div data-label="User">
                  <div style={{ fontSize: 13, color: "#56625b" }}>{s.user_name}</div>
                </div>
                <div data-label="Gross" style={{ fontSize: 13, color: "#56625b" }}>{s.gross_amount.toLocaleString(undefined, { maximumFractionDigits: 0 })} GMD</div>
                <div data-label="Commission" style={{ fontSize: 13, fontWeight: 700, color: GREEN }}>+{s.platform_commission.toLocaleString(undefined, { maximumFractionDigits: 0 })} GMD</div>
                <div data-label="Status"><StatusChip status={s.status} /></div>
                <div data-label="Date" style={{ fontSize: 12, color: "#6e7872" }}>{new Date(s.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div>
                <div data-label="Actions">
                  <button onClick={() => router.push(`/admin/campaigns/${s.campaign_id}/view`)} style={{ padding: "5px 11px", borderRadius: 7, fontSize: 11, fontWeight: 700, border: "1px solid rgba(21,32,26,0.1)", background: "rgba(21,32,26,0.04)", color: "#56625b", cursor: "pointer" }}>View</button>
                </div>
              </div>
            ))}
            </div>
          </div>
        </motion.div>

        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={pageBtnStyle(false)}>←</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => <button key={p} onClick={() => setPage(p)} style={pageBtnStyle(p === page)}>{p}</button>)}
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={pageBtnStyle(false)}>→</button>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function pageBtnStyle(active: boolean): React.CSSProperties {
  return { width: 32, height: 32, borderRadius: 8, fontSize: 13, fontWeight: 700, border: `1px solid ${active ? "rgba(20,120,74,0.4)" : "rgba(21,32,26,0.1)"}`, background: active ? "rgba(20,120,74,0.12)" : "rgba(21,32,26,0.03)", color: active ? "#14784a" : "#56625b", cursor: "pointer" };
}
