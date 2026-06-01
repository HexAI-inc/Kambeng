"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { useAdminKYCDetail, useApproveKYC, useRejectKYC } from "@/hooks/use-frontend-data";

const BLUE = "#1dc5ff";
const GREEN = "#1bbf88";
const RED = "#ef4444";

function fade(delay = 0) {
  return { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.32, delay, ease: "easeOut" as const } };
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string; border: string }> = {
    SUBMITTED: { color: BLUE,      bg: "rgba(29,197,255,0.1)",  border: "rgba(29,197,255,0.2)" },
    REVIEWING: { color: "#f97316", bg: "rgba(249,115,22,0.1)",  border: "rgba(249,115,22,0.25)" },
    APPROVED:  { color: GREEN,     bg: "rgba(27,191,136,0.1)",  border: "rgba(27,191,136,0.25)" },
    REJECTED:  { color: RED,       bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.25)" },
  };
  const s = map[status] ?? map.SUBMITTED;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", padding: "4px 12px", borderRadius: 20, color: s.color, background: s.bg, border: `1px solid ${s.border}` }}>
      {status}
    </span>
  );
}

function isPdf(url: string) {
  return url.split("?")[0].toLowerCase().endsWith(".pdf");
}
function isImage(url: string) {
  return /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url);
}
function docLabel(documentType: string) {
  return documentType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const handleApprove = async () => {
    try {
      await approve.mutateAsync(submissionId);
      showToast("KYC submission approved — confirmation email sent to user", true);
      setTimeout(() => router.back(), 1200);
    } catch { showToast("Failed to approve", false); }
    setShowApproveConfirm(false);
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) { showToast("Please provide a reason", false); return; }
    try {
      await reject.mutateAsync({ submissionId, reason: rejectionReason });
      showToast("KYC submission rejected — notification sent to user", true);
      setTimeout(() => router.back(), 1200);
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
          <div style={{ fontSize: 15, fontWeight: 700, color: "#f0f6ff", marginBottom: 12 }}>Submission not found</div>
          <button onClick={() => router.back()} style={{ padding: "9px 20px", borderRadius: 9, border: "none", background: `linear-gradient(135deg, ${BLUE}, #079bd4)`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Go back</button>
        </div>
      </div>
    );
  }

  const docUrl = submission.document_file_url;

  return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", padding: "28px clamp(16px,4vw,48px)" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

        {toast && (
          <div style={{ position: "fixed", top: 24, right: 24, zIndex: 999, padding: "12px 20px", borderRadius: 10, background: toast.ok ? "rgba(27,191,136,0.15)" : "rgba(239,68,68,0.15)", border: `1px solid ${toast.ok ? "rgba(27,191,136,0.3)" : "rgba(239,68,68,0.3)"}`, color: toast.ok ? GREEN : RED, fontSize: 13, fontWeight: 600, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>{toast.msg}</div>
        )}

        {/* Header */}
        <motion.div {...fade(0)} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button onClick={() => router.back()} style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#8899aa", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>←</button>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.03em" }}>KYC Review #{submissionId}</div>
          <StatusChip status={submission.status} />
        </motion.div>

        {/* Two-column layout: document left, info + actions right */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr min(360px, 38%)", gap: 20, alignItems: "start" }}>

          {/* ── Left: inline document viewer ── */}
          <motion.div {...fade(0.05)}>
            <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#f0f6ff" }}>{docLabel(submission.document_type)}</div>
                <span style={{ fontSize: 11, color: "#4a5568", background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: 5, fontWeight: 600 }}>
                  {isPdf(docUrl) ? "PDF" : "IMAGE"}
                </span>
              </div>

              {isPdf(docUrl) ? (
                <iframe
                  src={docUrl}
                  title="KYC Document"
                  style={{ width: "100%", height: "70vh", border: "none", display: "block", background: "#1a2333" }}
                />
              ) : isImage(docUrl) ? (
                <div style={{ position: "relative", width: "100%", minHeight: 400, background: "#1a2333" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={docUrl}
                    alt="KYC document"
                    style={{ width: "100%", maxHeight: "70vh", objectFit: "contain", display: "block" }}
                  />
                </div>
              ) : (
                <div style={{ padding: 32, textAlign: "center", color: "#4a5568" }}>
                  <div style={{ fontSize: 13, marginBottom: 12 }}>Cannot preview this file type</div>
                  <a href={docUrl} target="_blank" rel="noopener noreferrer" style={{ color: BLUE, fontSize: 13, fontWeight: 600 }}>Open in new tab</a>
                </div>
              )}
            </div>
          </motion.div>

          {/* ── Right: metadata + decision ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Submitter info */}
            <motion.div {...fade(0.08)}>
              <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>Submitter</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[
                    { label: "Name",     value: submission.user_name  ?? `User #${submission.user_id}` },
                    { label: "Email",    value: submission.user_email ?? "—" },
                    { label: "Doc type", value: docLabel(submission.document_type) },
                    { label: "Status",   value: <StatusChip status={submission.status} /> },
                    { label: "Submitted", value: new Date(submission.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>{label}</div>
                      <div style={{ fontSize: 13, color: "#f0f6ff", wordBreak: "break-all" }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Rejection reason (if already rejected) */}
            {submission.rejection_reason && (
              <motion.div {...fade(0.1)}>
                <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: RED, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Rejection reason</div>
                  <div style={{ fontSize: 13, color: "#fca5a5", lineHeight: 1.6 }}>{submission.rejection_reason}</div>
                </div>
              </motion.div>
            )}

            {/* Decision panel */}
            {canDecide && (
              <motion.div {...fade(0.12)}>
                <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#f0f6ff", marginBottom: 4 }}>Make a decision</div>
                  <div style={{ fontSize: 12, color: "#6b7a8d", marginBottom: 18, lineHeight: 1.5 }}>
                    The user will receive an email notification with the outcome.
                  </div>

                  {!showApproveConfirm && !showRejectForm && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <button
                        onClick={() => setShowApproveConfirm(true)}
                        style={{ padding: "12px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${GREEN}, #15a374)`, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px rgba(27,191,136,0.3)" }}
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => setShowRejectForm(true)}
                        style={{ padding: "12px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: RED, fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                      >
                        ✕ Reject
                      </button>
                    </div>
                  )}

                  {showApproveConfirm && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                      <div style={{ padding: "12px 14px", borderRadius: 9, background: "rgba(27,191,136,0.06)", border: "1px solid rgba(27,191,136,0.2)", marginBottom: 14, fontSize: 13, color: "#6b7a8d", lineHeight: 1.5 }}>
                        This marks the user&apos;s KYC as <strong style={{ color: GREEN }}>APPROVED</strong> and sends them a confirmation email.
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => void handleApprove()} disabled={approve.isPending} style={{ flex: 1, padding: "10px", borderRadius: 9, border: "none", background: `linear-gradient(135deg, ${GREEN}, #15a374)`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                          {approve.isPending ? "Approving…" : "Confirm"}
                        </button>
                        <button onClick={() => setShowApproveConfirm(false)} style={{ padding: "10px 16px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#8899aa", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                      </div>
                    </motion.div>
                  )}

                  {showRejectForm && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                      <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Explain why (sent to user in email)…"
                        rows={4}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.04)", color: "#f0f6ff", fontSize: 13, resize: "vertical", outline: "none", boxSizing: "border-box", marginBottom: 10 }}
                      />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => void handleReject()} disabled={reject.isPending || rejectionReason.trim().length < 10} style={{ flex: 1, padding: "10px", borderRadius: 9, border: "none", background: "rgba(239,68,68,0.85)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: rejectionReason.trim().length < 10 ? 0.5 : 1 }}>
                          {reject.isPending ? "Rejecting…" : "Confirm"}
                        </button>
                        <button onClick={() => { setShowRejectForm(false); setRejectionReason(""); }} style={{ padding: "10px 16px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#8899aa", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}

            {!canDecide && (
              <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", fontSize: 13, color: "#4a5568" }}>
                This submission has already been processed ({submission.status}).
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 720px) {
          .kyc-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
