"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { motion } from "framer-motion";
import { useAdminPendingDonations, useApproveDonation, useRejectDonation } from "@/hooks/use-frontend-data";
import type { AdminDonation } from "@/types/frontend";

const BLUE = "#1dc5ff";
const GREEN = "#1bbf88";
const RED = "#ef4444";

function fadeUp(delay = 0) {
  return { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35, delay, ease: "easeOut" as const } };
}

function StatusChip({ status }: { status: string }) {
  const s = status.toLowerCase();
  const map: Record<string, { color: string; bg: string; border: string }> = {
    pending:   { color: "#f97316", bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.25)" },
    approved:  { color: GREEN,     bg: "rgba(27,191,136,0.1)", border: "rgba(27,191,136,0.25)" },
    completed: { color: BLUE,      bg: "rgba(29,197,255,0.1)", border: "rgba(29,197,255,0.2)" },
    rejected:  { color: RED,       bg: "rgba(239,68,68,0.1)",  border: "rgba(239,68,68,0.25)" },
  };
  const cfg = map[s] ?? map.pending;
  return <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 20, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>{status}</span>;
}

const PAGE_SIZE = 10;

function getDonationMutationErrorMessage(error: unknown, action: "approve" | "reject") {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const detail = typeof error.response?.data?.detail === "string" ? error.response.data.detail : null;

    if (status === 404) {
      return "That donation reference was not found. Use the DON-* client reference, not the numeric database id.";
    }

    if (status === 422 && action === "approve") {
      return "The approval request is missing its payload. Refresh the page and try again.";
    }

    if (detail) {
      return detail;
    }
  }

  return action === "approve" ? "Failed to approve donation" : "Failed to reject donation";
}

export default function ReconciliationsPage() {
  const router = useRouter();
  const { data: donations, isLoading } = useAdminPendingDonations();
  const approveDonation = useApproveDonation();
  const rejectDonation = useRejectDonation();

  const [rejectingRef, setRejectingRef] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  const rows = donations ?? [];
  const pendingCount = rows.filter((d) => !d.reconciliation_source && d.status.toLowerCase() === "pending").length;
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  const handleApprove = async (ref: string) => {
    try { await approveDonation.mutateAsync(ref); showToast("Donation approved", true); }
    catch (error) { showToast(getDonationMutationErrorMessage(error, "approve"), false); }
  };

  const handleRejectSubmit = async () => {
    if (!rejectingRef || !rejectionReason.trim()) { showToast("Please provide a reason", false); return; }
    try {
      await rejectDonation.mutateAsync({ clientReference: rejectingRef, reason: rejectionReason });
      showToast("Donation rejected", true);
      setRejectingRef(null);
      setRejectionReason("");
    } catch (error) { showToast(getDonationMutationErrorMessage(error, "reject"), false); }
  };

  return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", padding: "28px clamp(16px,4vw,48px)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

        {toast && (
          <div style={{ position: "fixed", top: 24, right: 24, zIndex: 999, padding: "12px 20px", borderRadius: 10, background: toast.ok ? "rgba(27,191,136,0.15)" : "rgba(239,68,68,0.15)", border: `1px solid ${toast.ok ? "rgba(27,191,136,0.3)" : "rgba(239,68,68,0.3)"}`, color: toast.ok ? GREEN : RED, fontSize: 13, fontWeight: 600, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>{toast.msg}</div>
        )}

        <motion.div {...fadeUp(0)}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.03em" }}>Donation Reconciliation</div>
              <div style={{ fontSize: 13, color: "#6b7a8d", marginTop: 4 }}>Review incoming payments and clear legitimate donations</div>
            </div>
          </div>
          <div className="admin-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, overflow: "hidden" }}>
            {[
              { label: "Pending review", value: String(pendingCount), color: pendingCount > 0 ? "#f97316" : "#8899aa" },
              { label: "Reviewed", value: String(rows.length - pendingCount), color: GREEN },
              { label: "Total loaded", value: String(rows.length), color: "#f0f6ff" },
            ].map(({ label, value, color }, i, arr) => (
              <div key={label} style={{ padding: "12px 18px", borderRight: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                <div style={{ fontSize: 10, color: "#4a5568", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {rejectingRef && (
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} style={{ background: "#0d1120", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 14, padding: "22px 24px" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#f0f6ff", marginBottom: 4 }}>Reject Donation</div>
            <div style={{ fontSize: 13, color: "#6b7a8d", marginBottom: 14 }}>Ref: <span style={{ color: "#8899aa", fontFamily: "monospace" }}>{rejectingRef}</span></div>
            <textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Explain why this donation is being rejected…" rows={3}
              style={{ width: "100%", padding: "11px 14px", borderRadius: 9, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.04)", color: "#f0f6ff", fontSize: 13, resize: "vertical", outline: "none", boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button onClick={() => void handleRejectSubmit()} disabled={rejectDonation.isPending} style={{ padding: "9px 20px", borderRadius: 9, border: "none", background: "rgba(239,68,68,0.85)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {rejectDonation.isPending ? "Rejecting…" : "Confirm Rejection"}
              </button>
              <button onClick={() => { setRejectingRef(null); setRejectionReason(""); }} style={{ padding: "9px 20px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#8899aa", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            </div>
          </motion.div>
        )}

        <motion.div {...fadeUp(0.08)}>
          <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflowX: "auto" }}>
            <div className="admin-table-wrap" style={{ minWidth: 900 }}>
            <div className="admin-table-header" style={{ display: "grid", gridTemplateColumns: "130px 1fr 110px 90px 100px 80px 210px", padding: "10px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 10, fontWeight: 700, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.07em" }}>
              <div>Reference</div><div>Campaign</div><div>Donor</div><div>Amount</div><div>Status</div><div>Source</div><div>Actions</div>
            </div>

            {isLoading ? (
              <div style={{ padding: 40, textAlign: "center" }}>
                <div style={{ width: 32, height: 32, border: `2px solid ${BLUE}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
                <div style={{ color: "#4a5568", fontSize: 13 }}>Loading donations…</div>
              </div>
            ) : rows.length === 0 ? (
              <div style={{ padding: "48px 24px", textAlign: "center", color: "#4a5568", fontSize: 14 }}>No donations waiting for review</div>
            ) : pageRows.map((d: AdminDonation) => {
              const isPending = !d.reconciliation_source && d.status.toLowerCase() === "pending";
              return (
                <div key={d.client_reference} className="admin-table-row" style={{ display: "grid", gridTemplateColumns: "130px 1fr 110px 90px 100px 80px 210px", padding: "13px 18px", alignItems: "start", borderBottom: "1px solid rgba(255,255,255,0.04)", borderLeft: isPending ? `3px solid #f97316` : "3px solid transparent", transition: "background 0.15s" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.02)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = ""; }}
                >
                  <div data-label="Reference" style={{ fontSize: 11, fontFamily: "monospace", color: "#8899aa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.client_reference}</div>
                  <div data-label="Campaign" style={{ fontSize: 13, color: "#f0f6ff", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.campaign_title}</div>
                  <div data-label="Donor" style={{ fontSize: 12, color: "#8899aa" }}>{d.donor_name || "Anonymous"}</div>
                  <div data-label="Amount" style={{ fontSize: 13, fontWeight: 700, color: GREEN }}>{d.amount.toFixed(2)} <span style={{ fontSize: 10, color: "#4a5568" }}>GMD</span></div>
                  <div data-label="Status"><StatusChip status={d.status} /></div>
                  <div data-label="Source" style={{ fontSize: 12, color: "#4a5568" }}>{d.reconciliation_source || "—"}</div>
                  <div data-label="Actions">
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-start" }}>
                      <button onClick={() => router.push(`/admin/campaigns/${d.campaign_id}/view`)} style={btnStyle("default")}>View Campaign</button>
                      {isPending && (
                        <>
                          <button onClick={() => void handleApprove(d.client_reference)} disabled={approveDonation.isPending} style={btnStyle("green")}>Approve</button>
                          <button onClick={() => setRejectingRef(d.client_reference)} style={btnStyle("red")}>Reject</button>
                        </>
                      )}
                      {!isPending && <span style={{ fontSize: 11, color: "#4a5568", padding: "2px 0" }}>Reconciled</span>}
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        </motion.div>

        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 4 }}>
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

function btnStyle(v: "default" | "green" | "red"): React.CSSProperties {
  const m = { default: { c: "#8899aa", b: "rgba(255,255,255,0.1)", bg: "rgba(255,255,255,0.04)" }, green: { c: "#1bbf88", b: "rgba(27,191,136,0.25)", bg: "rgba(27,191,136,0.08)" }, red: { c: "#ef4444", b: "rgba(239,68,68,0.25)", bg: "rgba(239,68,68,0.08)" } }[v];
  return { padding: "5px 11px", borderRadius: 7, fontSize: 11, fontWeight: 700, border: `1px solid ${m.b}`, background: m.bg, color: m.c, cursor: "pointer" };
}
function pageBtnStyle(active: boolean): React.CSSProperties {
  return { width: 32, height: 32, borderRadius: 8, fontSize: 13, fontWeight: 700, border: `1px solid ${active ? "rgba(29,197,255,0.4)" : "rgba(255,255,255,0.1)"}`, background: active ? "rgba(29,197,255,0.12)" : "rgba(255,255,255,0.03)", color: active ? "#1dc5ff" : "#8899aa", cursor: "pointer" };
}
