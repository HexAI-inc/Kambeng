"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

import { useAdminKYCQueue, useApproveKYC, useRejectKYC } from "@/hooks/use-frontend-data";

const BLUE = "#1dc5ff";
const GREEN = "#1bbf88";
const RED = "#ef4444";

function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, delay, ease: "easeOut" as const },
  };
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string; border: string }> = {
    SUBMITTED: { color: BLUE, bg: "rgba(29,197,255,0.1)", border: "rgba(29,197,255,0.2)" },
    REVIEWING: { color: "#f97316", bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.25)" },
    APPROVED:  { color: GREEN, bg: "rgba(27,191,136,0.1)", border: "rgba(27,191,136,0.25)" },
    REJECTED:  { color: RED, bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.25)" },
  };
  const s = map[status] ?? map.SUBMITTED;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase",
      padding: "3px 9px", borderRadius: 20, color: s.color, background: s.bg, border: `1px solid ${s.border}`,
    }}>{status}</span>
  );
}

export default function KYCQueuePage() {
  const router = useRouter();
  const { data: queue, isLoading } = useAdminKYCQueue();
  const approveKYC = useApproveKYC();
  const rejectKYC = useRejectKYC();

  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const handleApprove = async (id: number) => {
    try {
      await approveKYC.mutateAsync(id);
      showToast("KYC submission approved", true);
    } catch {
      showToast("Failed to approve KYC", false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectingId || !rejectionReason.trim()) {
      showToast("Please provide a rejection reason", false);
      return;
    }
    try {
      await rejectKYC.mutateAsync({ submissionId: rejectingId, reason: rejectionReason });
      showToast("KYC submission rejected", true);
      setRejectingId(null);
      setRejectionReason("");
    } catch {
      showToast("Failed to reject KYC", false);
    }
  };

  const rows = queue ?? [];
  const pending = rows.filter((r) => r.status === "SUBMITTED" || r.status === "REVIEWING").length;

  return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", padding: "28px clamp(16px,4vw,48px)" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

        {toast && (
          <div style={{
            position: "fixed", top: 24, right: 24, zIndex: 999,
            padding: "12px 20px", borderRadius: 10,
            background: toast.ok ? "rgba(27,191,136,0.15)" : "rgba(239,68,68,0.15)",
            border: `1px solid ${toast.ok ? "rgba(27,191,136,0.3)" : "rgba(239,68,68,0.3)"}`,
            color: toast.ok ? GREEN : RED, fontSize: 13, fontWeight: 600,
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}>{toast.msg}</div>
        )}

        {/* Header */}
        <motion.div {...fadeUp(0)}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.03em" }}>KYC Queue</div>
          <div style={{ fontSize: 13, color: "#6b7a8d", marginTop: 4 }}>
            {rows.length} total · <span style={{ color: pending > 0 ? "#f97316" : "#4a5568" }}>{pending} pending review</span>
          </div>
        </motion.div>

        {/* Reject modal */}
        {rejectingId && (
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} style={{
            background: "#0d1120", border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 14, padding: "22px 24px",
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#f0f6ff", marginBottom: 4 }}>
              Reject KYC — {rows.find((r) => r.id === rejectingId)?.user_name ?? `Submission ${rejectingId}`}
            </div>
            <div style={{ fontSize: 13, color: "#6b7a8d", marginBottom: 16 }}>Provide a reason — this will be sent to the user.</div>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Explain why this submission is being rejected…"
              rows={4}
              style={{
                width: "100%", padding: "11px 14px", borderRadius: 9,
                border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.04)",
                color: "#f0f6ff", fontSize: 13, resize: "vertical", outline: "none",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button
                onClick={() => void handleRejectSubmit()}
                disabled={rejectKYC.isPending}
                style={{ padding: "9px 20px", borderRadius: 9, border: "none", background: "rgba(239,68,68,0.85)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                {rejectKYC.isPending ? "Rejecting…" : "Confirm Rejection"}
              </button>
              <button
                onClick={() => { setRejectingId(null); setRejectionReason(""); }}
                style={{ padding: "9px 20px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#8899aa", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}

        {/* List */}
        <motion.div {...fadeUp(0.06)}>
          <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflowX: "auto" }}>
            <div className="admin-table-wrap" style={{ minWidth: 700 }}>
            <div className="admin-table-header" style={{
              display: "grid", gridTemplateColumns: "1fr 140px 120px 100px 200px",
              padding: "10px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)",
              fontSize: 10, fontWeight: 700, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.07em",
            }}>
              <div>Applicant</div><div>Status</div><div>Submitted</div><div>Docs</div><div>Actions</div>
            </div>

            {isLoading ? (
              <div style={{ padding: 40, textAlign: "center" }}>
                <div style={{ width: 32, height: 32, border: `2px solid ${BLUE}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
                <div style={{ color: "#4a5568", fontSize: 13 }}>Loading KYC queue…</div>
              </div>
            ) : rows.length === 0 ? (
              <div style={{ padding: "48px 24px", textAlign: "center", color: "#4a5568", fontSize: 14 }}>No KYC submissions</div>
            ) : rows.map((sub, i: number) => {
              const isProcessed = sub.status === "APPROVED" || sub.status === "REJECTED";
              return (
                <motion.div
                  key={sub.id}
                  {...fadeUp(0.03 * i)}
                  style={{
                    display: "grid", gridTemplateColumns: "1fr 140px 120px 100px 200px",
                    padding: "14px 18px", alignItems: "center",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    transition: "background 0.15s",
                    borderLeft: !isProcessed ? `3px solid ${BLUE}` : "3px solid transparent",
                  }}
                  className="admin-table-row"
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.02)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = ""; }}
                >
                  <div data-label="User">
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#f0f6ff" }}>{sub.user_name}</div>
                    <div style={{ fontSize: 11, color: "#4a5568" }}>{sub.user_email}</div>
                  </div>
                  <div data-label="Status"><StatusChip status={sub.status} /></div>
                  <div data-label="Submitted" style={{ fontSize: 12, color: "#8899aa" }}>{new Date(sub.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</div>
                  <div data-label="Docs" style={{ fontSize: 13, color: "#8899aa", fontWeight: 600 }}>{sub.document_file_url ? "1 doc" : "0 docs"}</div>
                  <div data-label="Actions">
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button onClick={() => router.push(`/admin/kyc-queue/${sub.id}/review`)} style={btnStyle("blue")}>Review</button>
                      <button onClick={() => router.push(`/admin/kyc-queue/${sub.id}/view`)} style={btnStyle("default")}>View</button>
                      {!isProcessed && (
                        <>
                          <button onClick={() => void handleApprove(sub.id)} disabled={approveKYC.isPending} style={btnStyle("green")}>Approve</button>
                          <button onClick={() => setRejectingId(sub.id)} style={btnStyle("red")}>Reject</button>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
            </div>
          </div>
        </motion.div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function btnStyle(variant: "default" | "blue" | "green" | "red"): React.CSSProperties {
  const map = {
    default: { color: "#8899aa", border: "rgba(255,255,255,0.1)", bg: "rgba(255,255,255,0.04)" },
    blue:    { color: "#1dc5ff", border: "rgba(29,197,255,0.25)", bg: "rgba(29,197,255,0.08)" },
    green:   { color: "#1bbf88", border: "rgba(27,191,136,0.25)", bg: "rgba(27,191,136,0.08)" },
    red:     { color: "#ef4444", border: "rgba(239,68,68,0.25)", bg: "rgba(239,68,68,0.08)" },
  }[variant];
  return { padding: "5px 11px", borderRadius: 7, fontSize: 11, fontWeight: 700, border: `1px solid ${map.border}`, background: map.bg, color: map.color, cursor: "pointer" };
}
