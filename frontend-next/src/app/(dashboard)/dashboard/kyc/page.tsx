"use client";

import { useState, useRef } from "react";
import MediaViewer from "@/components/ui/MediaViewer";
import { useKYCStatus, useSubmitKYC, useSessionProfile } from "@/hooks/use-frontend-data";
import { useAppFeedback } from "@/components/ui";
import { motion } from "framer-motion";

const BLUE = "#1dc5ff";
const GREEN = "#1bbf88";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const DOC_TYPES = [
  { key: "NATIONAL_ID", label: "National ID", icon: "🪪" },
  { key: "PASSPORT", label: "Passport", icon: "📘" },
  { key: "DRIVERS_LICENSE", label: "Driver's License", icon: "🚗" },
];

type DocumentUpload = { type: string; file: File | null };

function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.38, delay, ease: "easeOut" as const },
  };
}

function StatusBanner({ status, reason }: { status: string; reason?: string }) {
  const map: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode; title: string; sub: string }> = {
    APPROVED: {
      color: GREEN, bg: "rgba(27,191,136,0.08)", border: "rgba(27,191,136,0.2)",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M6.5 13.5L9.5 16.5L17.5 8.5" stroke={GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="12" cy="12" r="10" stroke={GREEN} strokeWidth="1.8"/>
        </svg>
      ),
      title: "KYC Approved",
      sub: "Your identity has been verified. You can now receive withdrawals.",
    },
    SUBMITTED: {
      color: BLUE, bg: "rgba(29,197,255,0.07)", border: "rgba(29,197,255,0.2)",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke={BLUE} strokeWidth="1.8"/>
          <path d="M12 8v4l3 3" stroke={BLUE} strokeWidth="2" strokeLinecap="round"/>
        </svg>
      ),
      title: "Under Review",
      sub: "Your documents are being reviewed by our team. This usually takes 1–2 business days.",
    },
    REVIEWING: {
      color: BLUE, bg: "rgba(29,197,255,0.07)", border: "rgba(29,197,255,0.2)",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke={BLUE} strokeWidth="1.8"/>
          <path d="M12 8v4l3 3" stroke={BLUE} strokeWidth="2" strokeLinecap="round"/>
        </svg>
      ),
      title: "Under Review",
      sub: "Your documents are being reviewed by our team.",
    },
    REJECTED: {
      color: "#ef4444", bg: "rgba(239,68,68,0.07)", border: "rgba(239,68,68,0.2)",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="1.8"/>
          <path d="M15 9l-6 6M9 9l6 6" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      ),
      title: "KYC Rejected",
      sub: reason ? `Reason: ${reason}` : "Please resubmit with correct documents.",
    },
  };
  const s = map[status];
  if (!s) return null;
  return (
    <div style={{
      padding: "16px 20px", borderRadius: 12,
      background: s.bg, border: `1px solid ${s.border}`,
      display: "flex", gap: 14, alignItems: "flex-start",
    }}>
      <div style={{ flexShrink: 0, marginTop: 1 }}>{s.icon}</div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: s.color, marginBottom: 3 }}>{s.title}</div>
        <div style={{ fontSize: 13, color: "#6b7a8d", lineHeight: 1.6 }}>{s.sub}</div>
      </div>
    </div>
  );
}

function UploadBox({ docType, label, icon, file, onChange }: {
  docType: string; label: string; icon: string;
  file: File | null; onChange: (f: File | null) => void;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  const [drag, setDrag] = useState(false);

  return (
    <div
      onClick={() => ref.current?.click()}
      onDragEnter={() => setDrag(true)}
      onDragLeave={() => setDrag(false)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); setDrag(false); onChange(e.dataTransfer.files[0] ?? null); }}
      style={{
        padding: "24px 16px", borderRadius: 12, cursor: "pointer", textAlign: "center",
        border: `2px dashed ${file ? GREEN : drag ? BLUE : "rgba(255,255,255,0.1)"}`,
        background: file ? "rgba(27,191,136,0.05)" : drag ? "rgba(29,197,255,0.04)" : "rgba(255,255,255,0.02)",
        transition: "all 0.2s", position: "relative",
      }}
    >
      <input ref={ref} type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => onChange(e.target.files?.[0] ?? null)} style={{ display: "none" }} />
      {file ? (
        <>
          <div style={{
            width: 40, height: 40, borderRadius: 10, margin: "0 auto 10px",
            background: "rgba(27,191,136,0.15)", border: "1px solid rgba(27,191,136,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke={GREEN} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: GREEN, marginBottom: 3 }}>{label}</div>
          <div style={{ fontSize: 11, color: "#6b7a8d", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</div>
          <div style={{ fontSize: 10, color: "#4a5568", marginTop: 2 }}>{(file.size / 1024 / 1024).toFixed(2)} MB</div>
          <button
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
            style={{
              marginTop: 10, padding: "4px 12px", borderRadius: 6, border: "none",
              background: "rgba(239,68,68,0.15)", color: "#fca5a5",
              fontSize: 11, fontWeight: 600, cursor: "pointer",
            }}
          >Remove</button>
        </>
      ) : (
        <>
          <div style={{ fontSize: 24, marginBottom: 10 }}>{icon}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#f0f6ff", marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 11, color: "#6b7a8d" }}>Click or drag & drop</div>
          <div style={{ fontSize: 10, color: "#4a5568", marginTop: 2 }}>PDF, PNG, JPG · max 10MB</div>
        </>
      )}
    </div>
  );
}

export default function KYCPage() {
  const { data: session } = useSessionProfile(true);
  const { data: kycStatus, isLoading } = useKYCStatus(session?.id);
  const submitKYC = useSubmitKYC();
  const { message } = useAppFeedback();
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);

  const [uploads, setUploads] = useState<DocumentUpload[]>(
    DOC_TYPES.map(({ key }) => ({ type: key, file: null }))
  );

  const isApproved = kycStatus?.status === "APPROVED";
  const isPending  = kycStatus?.status === "SUBMITTED" || kycStatus?.status === "REVIEWING";
  const isRejected = kycStatus?.status === "REJECTED";
  const hasFiles   = uploads.some((u) => u.file !== null);
  const statusVisible = Boolean((kycStatus?.status && kycStatus.status !== "NOT_SUBMITTED") || (session?.kyc_status && session.kyc_status !== "NOT_SUBMITTED"));
  const currentStatus = kycStatus?.status ?? session?.kyc_status ?? "NOT_SUBMITTED";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const filled = uploads.filter((u) => u.file);
    if (filled.length === 0) { message.error("Upload at least one document"); return; }

    // Backend accepts one document per request: document_type + file
    let anySuccess = false;
    for (const upload of filled) {
      const fd = new FormData();
      fd.append("document_type", upload.type);
      fd.append("file", upload.file!);
      try {
        await submitKYC.mutateAsync(fd);
        anySuccess = true;
      } catch (err: any) {
        const detail = err?.response?.data?.detail ?? null;
        const status = err?.response?.status ?? 0;
        if (status === 401) {
          message.error("Your session expired. Please sign in again and resubmit.");
        } else if (status === 403) {
          message.error("Your account is not allowed to submit KYC yet. Please sign in and try again.");
        } else if (status >= 500) {
          message.error("Server error — the admin has been notified. Try again later.");
        } else {
          message.error(detail ?? `Failed to submit ${upload.type.replace(/_/g, " ").toLowerCase()}`);
        }
      }
    }

    if (anySuccess) {
      message.success("Documents submitted. Awaiting review.");
      setUploads(DOC_TYPES.map(({ key }) => ({ type: key, file: null })));
    }
  };

  return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", padding: "28px clamp(16px, 4vw, 48px)" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Header */}
        <motion.div {...fadeUp(0)}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.03em", marginBottom: 4 }}>KYC Verification</div>
          <div style={{ fontSize: 13, color: "#6b7a8d" }}>Submit identity documents to unlock withdrawals and verified status.</div>
        </motion.div>

        {/* Status */}
        {isLoading ? (
          <div style={{ height: 68, borderRadius: 12, background: "rgba(255,255,255,0.05)" }} />
        ) : statusVisible ? (
          <motion.div {...fadeUp(0.06)}>
            <StatusBanner status={currentStatus} reason={kycStatus?.rejection_reason ?? session?.kyc_rejection_reason ?? undefined} />
          </motion.div>
        ) : null}

        {/* Upload form */}
        {!isLoading && !isApproved && !isPending && (
          <motion.div {...fadeUp(0.1)}>
            <form onSubmit={(e) => void handleSubmit(e)}>
              <div style={{
                background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 14, padding: "24px",
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#f0f6ff", marginBottom: 4 }}>
                  {isRejected ? "Resubmit Documents" : "Upload Documents"}
                </div>
                <div style={{ fontSize: 13, color: "#6b7a8d", marginBottom: 20 }}>
                  Upload at least one clear copy. Supported: PDF, PNG, JPG.
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
                  {DOC_TYPES.map(({ key, label, icon }) => {
                    const upload = uploads.find((u) => u.type === key)!;
                    return (
                      <UploadBox
                        key={key}
                        docType={key}
                        label={label}
                        icon={icon}
                        file={upload.file}
                        onChange={(f) => setUploads((prev) => prev.map((u) => u.type === key ? { ...u, file: f } : u))}
                      />
                    );
                  })}
                </div>

                <button
                  type="submit"
                  disabled={!hasFiles || submitKYC.isPending}
                  style={{
                    width: "100%", padding: "13px", borderRadius: 10, border: "none",
                    background: hasFiles
                      ? `linear-gradient(135deg, ${BLUE}, #079bd4)`
                      : "rgba(255,255,255,0.06)",
                    color: hasFiles ? "#fff" : "#4a5568",
                    fontSize: 14, fontWeight: 700, cursor: hasFiles ? "pointer" : "not-allowed",
                    boxShadow: hasFiles ? "0 4px 20px rgba(29,197,255,0.3)" : "none",
                    transition: "all 0.2s",
                  }}
                >
                  {submitKYC.isPending ? "Submitting…" : "Submit KYC Documents"}
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* Submitted docs list */}
        {kycStatus?.documents && kycStatus.documents.length > 0 && (
          <motion.div {...fadeUp(0.14)}>
            <div style={{
              background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 14, overflow: "hidden",
            }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#4a5568", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>
                  Submitted Documents
                </span>
              </div>
              {kycStatus.documents.map((doc, i, arr) => (
                <div key={doc.id} style={{
                  padding: "12px 20px",
                  borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#f0f6ff", textTransform: "capitalize" as const }}>
                      {doc.document_type.replace(/_/g, " ")}
                    </div>
                    <div style={{ fontSize: 11, color: "#4a5568" }}>
                      {new Date(doc.upload_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </div>
                  </div>
                  <button onClick={async () => {
                    try {
                      const q = new URLSearchParams({ url: doc.file_url });
                      const res = await fetch(`/api/backend/media/presign?${q.toString()}`);
                      if (res.ok) {
                        const b = await res.json();
                        setViewerSrc(b.url);
                      } else {
                        setViewerSrc(doc.file_url);
                      }
                    } catch {
                      setViewerSrc(doc.file_url);
                    }
                  }}
                  style={{
                    fontSize: 12, fontWeight: 600, color: BLUE,
                    padding: "5px 12px", borderRadius: 7,
                    background: "rgba(29,197,255,0.08)", border: "1px solid rgba(29,197,255,0.15)",
                    textDecoration: "none", cursor: "pointer",
                  }}
                  >
                    View ↗
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
        {viewerSrc && <MediaViewer src={viewerSrc} onClose={() => setViewerSrc(null)} />}
      </div>
    </div>
  );
}
