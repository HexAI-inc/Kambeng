"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import MediaViewer from "@/components/ui/MediaViewer";
import { motion } from "framer-motion";
import { useAdminKYCDetail, useApproveKYC, useRejectKYC } from "@/hooks/use-frontend-data";

const BLUE = "#1dc5ff";
const GREEN = "#1bbf88";
const RED = "#ef4444";

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string; border: string }> = {
    SUBMITTED: { color: BLUE,     bg: "rgba(29,197,255,0.1)", border: "rgba(29,197,255,0.2)" },
    REVIEWING: { color: "#f97316", bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.25)" },
    APPROVED:  { color: GREEN,    bg: "rgba(27,191,136,0.1)", border: "rgba(27,191,136,0.25)" },
    REJECTED:  { color: RED,      bg: "rgba(239,68,68,0.1)",  border: "rgba(239,68,68,0.25)" },
  };
  const s = map[status] ?? map.SUBMITTED;
  return <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", padding: "4px 12px", borderRadius: 20, color: s.color, background: s.bg, border: `1px solid ${s.border}` }}>{status}</span>;
}

export default function KYCReviewPage() {
  const params = useParams();
  const router = useRouter();
  const submissionId = Array.isArray(params?.id) ? parseInt(params.id[0]) : parseInt(params?.id as string);
  const { data: submission, isLoading, error } = useAdminKYCDetail(submissionId);
  const approve = useApproveKYC();
  const reject = useRejectKYC();

  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  const handleApprove = async () => {
    try {
      await approve.mutateAsync(submissionId);
      showToast("KYC submission approved", true);
      setTimeout(() => router.back(), 900);
    } catch { showToast("Failed to approve", false); }
    setShowApproveConfirm(false);
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) { showToast("Please provide a reason", false); return; }
    try {
      await reject.mutateAsync({ submissionId, reason: rejectionReason });
      showToast("KYC submission rejected", true);
      setTimeout(() => router.back(), 900);
    } catch { showToast("Failed to reject", false); }
  };

  const canDecide = submission?.status === "SUBMITTED" || submission?.status === "REVIEWING";

  if (isLoading) {
    return (
      <div style={{ background: "#0a0f1a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, border: `2px solid ${BLUE}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div style={{ background: "#0a0f1a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>😕</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#f0f6ff", marginBottom: 8 }}>Submission not found</div>
          <button onClick={() => router.back()} style={{ padding: "9px 20px", borderRadius: 9, border: "none", background: `linear-gradient(135deg, ${BLUE}, #079bd4)`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Go back</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", padding: "28px clamp(16px,4vw,48px)" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

        {toast && (
          <div style={{ position: "fixed", top: 24, right: 24, zIndex: 999, padding: "12px 20px", borderRadius: 10, background: toast.ok ? "rgba(27,191,136,0.15)" : "rgba(239,68,68,0.15)", border: `1px solid ${toast.ok ? "rgba(27,191,136,0.3)" : "rgba(239,68,68,0.3)"}`, color: toast.ok ? GREEN : RED, fontSize: 13, fontWeight: 600, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>{toast.msg}</div>
        )}

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button onClick={() => router.back()} style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#8899aa", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>←</button>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.03em" }}>Review KYC #{submissionId}</div>
            <StatusChip status={submission.status} />
          </div>
        </motion.div>

        {/* Submission details */}
        <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[
              { label: "User ID", value: `#${submission.user_id}` },
              { label: "Document Type", value: submission.document_type },
              { label: "Status", value: <StatusChip status={submission.status} /> },
              { label: "Submitted", value: new Date(submission.created_at).toLocaleString() },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 14, color: "#f0f6ff" }}>{value}</div>
              </div>
            ))}
            {submission.document_file_url && (
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Document</div>
                <DocumentLink url={submission.document_file_url} />
              </div>
            )}
            {submission.rejection_reason && (
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Rejection Reason</div>
                <div style={{ padding: "12px 16px", borderRadius: 9, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", color: "#fca5a5", fontSize: 13, lineHeight: 1.6 }}>{submission.rejection_reason}</div>
              </div>
            )}
          </div>
        </div>

        {/* Decision panel */}
        {canDecide && (
          <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "24px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f0f6ff", marginBottom: 4 }}>Make a Decision</div>
            <div style={{ fontSize: 13, color: "#6b7a8d", marginBottom: 20 }}>This will update the user&apos;s KYC status immediately.</div>

            {!showApproveConfirm && !showRejectForm && (
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => setShowApproveConfirm(true)} style={{ flex: 1, padding: "13px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${GREEN}, #15a374)`, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px rgba(27,191,136,0.3)" }}>
                  ✓ Approve Submission
                </button>
                <button onClick={() => setShowRejectForm(true)} style={{ flex: 1, padding: "13px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: RED, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                  ✕ Reject Submission
                </button>
              </div>
            )}

            {showApproveConfirm && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <div style={{ padding: "16px 20px", borderRadius: 10, background: "rgba(27,191,136,0.06)", border: "1px solid rgba(27,191,136,0.2)", marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: GREEN, marginBottom: 4 }}>Confirm Approval</div>
                  <div style={{ fontSize: 13, color: "#6b7a8d" }}>This will mark the user&apos;s KYC as APPROVED and allow them to create campaigns.</div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => void handleApprove()} disabled={approve.isPending} style={{ padding: "10px 24px", borderRadius: 9, border: "none", background: `linear-gradient(135deg, ${GREEN}, #15a374)`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    {approve.isPending ? "Approving…" : "Confirm Approval"}
                  </button>
                  <button onClick={() => setShowApproveConfirm(false)} style={{ padding: "10px 20px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#8899aa", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                </div>
              </motion.div>
            )}

            {showRejectForm && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#8899aa", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 8 }}>Rejection Reason</label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Explain why this KYC submission is being rejected (min 10 characters)…"
                    rows={4}
                    style={{ width: "100%", padding: "11px 14px", borderRadius: 9, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.04)", color: "#f0f6ff", fontSize: 13, resize: "vertical", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => void handleReject()} disabled={reject.isPending || rejectionReason.trim().length < 10} style={{ padding: "10px 24px", borderRadius: 9, border: "none", background: "rgba(239,68,68,0.85)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: rejectionReason.trim().length < 10 ? 0.5 : 1 }}>
                    {reject.isPending ? "Rejecting…" : "Confirm Rejection"}
                  </button>
                  <button onClick={() => { setShowRejectForm(false); setRejectionReason(""); }} style={{ padding: "10px 20px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#8899aa", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {!canDecide && (
          <div style={{ padding: "16px 20px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", fontSize: 13, color: "#4a5568" }}>
            This submission has already been processed ({submission.status}).
          </div>
        )}

        <button onClick={() => router.back()} style={{ alignSelf: "flex-start", padding: "9px 20px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#8899aa", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Back to Queue</button>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function DocumentLink({ url }: { url: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [src, setSrc] = useState<string | null>(null);

  const onOpen = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ url });
      const res = await fetch(`/api/backend/media/presign?${q.toString()}`);
      if (!res.ok) throw new Error("presign failed");
      const body = await res.json();
      setSrc(body.url);
      setOpen(true);
    } catch (e) {
      setSrc(url);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const onClose = () => { setOpen(false); setSrc(null); };

  return (
    <>
      <button onClick={onOpen} disabled={loading} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 9, border: `1px solid rgba(29,197,255,0.25)`, background: "rgba(29,197,255,0.08)", color: BLUE, fontSize: 13, fontWeight: 600, textDecoration: "none", cursor: "pointer" }}>
        {loading ? "Loading…" : "View Document"}
      </button>
      {open && src && <MediaViewer src={src} type={guessMime(src)} onClose={onClose} />}
    </>
  );
}

function guessMime(url: string) {
  const lower = url.split("?")[0].toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.match(/\.(jpg|jpeg|png|gif|webp)$/)) return "image/" + lower.split('.').pop();
  return "";
}
