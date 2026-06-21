"use client";

import { useState } from "react";
import { Proof, ProofVisibility } from "@/types/frontend";
import MediaViewer from "@/components/ui/MediaViewer";

const BLUE = "#1dc5ff";

interface ProofListProps {
  proofs: Proof[];
  onDelete?: (proofId: number) => Promise<void>;
}

const DOC_LABELS: Record<string, string> = {
  STUDENT_ID:     "Student ID",
  UTG_PORTAL:     "UTG Portal",
  TRANSCRIPT:     "Transcript",
  TUITION_RECEIPT: "Receipt",
  OTHER:          "Other",
};

const VIS_META: Record<ProofVisibility, { label: string; color: string; bg: string }> = {
  PUBLIC:     { label: "Public",      color: "#1bbf88", bg: "rgba(27,191,136,0.12)" },
  DONOR_ONLY: { label: "Donors Only", color: "#fbbf24", bg: "rgba(251,191,36,0.10)" },
  ADMIN_ONLY: { label: "Admin Only",  color: "#ef4444", bg: "rgba(239,68,68,0.10)"  },
};

export function ProofList({ proofs, onDelete }: ProofListProps) {
  const [openSrc, setOpenSrc] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  if (!proofs || proofs.length === 0) {
    return (
      <div style={{
        padding: "32px 20px", textAlign: "center",
        background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)",
        borderRadius: 12,
      }}>
        <div style={{ fontSize: 13, color: "#4a5568" }}>No proof documents uploaded yet</div>
      </div>
    );
  }

  const onView = async (proof: Proof) => {
    setLoadingId(proof.id);
    try {
      const q = new URLSearchParams({ url: proof.file_url });
      const res = await fetch(`/api/backend/media/presign?${q.toString()}`);
      if (!res.ok) throw new Error("presign failed");
      const body = (await res.json()) as { url: string };
      setOpenSrc(body.url);
    } catch {
      setOpenSrc(proof.file_url);
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (proof: Proof) => {
    if (!onDelete || !window.confirm("Delete this proof? This cannot be undone.")) return;
    setDeletingId(proof.id);
    try {
      await onDelete(proof.id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
        {proofs.map((proof) => {
          const vis = VIS_META[proof.visibility] ?? { label: proof.visibility, color: "#8899aa", bg: "rgba(255,255,255,0.06)" };
          const docLabel = DOC_LABELS[proof.document_type] ?? proof.document_type;
          const isPdf = proof.file_url.toLowerCase().endsWith(".pdf");
          return (
            <div
              key={proof.id}
              style={{
                background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 12, padding: 16,
                display: "flex", flexDirection: "column", gap: 12,
                transition: "border-color 0.2s",
              }}
            >
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {isPdf ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7a8d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7a8d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                    </svg>
                  )}
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#f0f6ff" }}>{docLabel}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: vis.color, background: vis.bg, padding: "2px 8px", borderRadius: 20, flexShrink: 0 }}>
                  {vis.label}
                </span>
              </div>

              {proof.description && (
                <p style={{ fontSize: 13, color: "#8899aa", lineHeight: 1.45, margin: 0 }}>
                  {proof.description}
                </p>
              )}

              {/* Footer */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <button
                  onClick={() => void onView(proof)}
                  disabled={loadingId === proof.id}
                  style={{
                    padding: "6px 14px", borderRadius: 7, border: `1px solid rgba(29,197,255,0.25)`,
                    background: "rgba(29,197,255,0.07)", color: BLUE,
                    fontSize: 12, fontWeight: 700, cursor: loadingId === proof.id ? "wait" : "pointer",
                    opacity: loadingId === proof.id ? 0.6 : 1, transition: "opacity 0.15s",
                  }}
                >
                  {loadingId === proof.id ? "Loading…" : "View File"}
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, color: "#4a5568" }}>
                    {new Date(proof.created_at).toLocaleDateString()}
                  </span>
                  {onDelete && (
                    <button
                      onClick={() => void handleDelete(proof)}
                      disabled={deletingId === proof.id}
                      title="Delete proof"
                      style={{
                        width: 28, height: 28, borderRadius: 6, border: "1px solid rgba(239,68,68,0.2)",
                        background: "rgba(239,68,68,0.07)", color: "#ef4444",
                        cursor: deletingId === proof.id ? "wait" : "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        opacity: deletingId === proof.id ? 0.5 : 1, transition: "opacity 0.15s, background 0.15s",
                        padding: 0,
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.14)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.07)"; }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {openSrc && <MediaViewer src={openSrc} onClose={() => setOpenSrc(null)} />}
    </>
  );
}
