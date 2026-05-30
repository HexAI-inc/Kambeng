"use client";

import { Proof, ProofVisibility } from "@/types/frontend";
import { AppText, AppTag } from "@/components/ui";
import styles from "./ProofList.module.css";
import { useState } from "react";
import MediaViewer from "@/components/ui/MediaViewer";

interface ProofListProps {
  proofs: Proof[];
}

const documentTypeLabels: Record<string, string> = {
  STUDENT_ID: "Student ID",
  UTG_PORTAL: "UTG Portal",
  TRANSCRIPT: "Transcript",
  TUITION_RECEIPT: "Receipt",
  OTHER: "Other",
};

const visibilityLabels: Record<ProofVisibility, { label: string; color: string }> = {
  PUBLIC: { label: "Public", color: "success" },
  DONOR_ONLY: { label: "Donors Only", color: "warning" },
  ADMIN_ONLY: { label: "Admin Only", color: "error" },
};

export function ProofList({
  proofs,
}: ProofListProps) {
  const [openSrc, setOpenSrc] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);

  if (!proofs || proofs.length === 0) {
    return (
      <div className={styles.emptyState}>
        <AppText type="secondary">No proofs uploaded yet</AppText>
      </div>
    );
  }

  const onView = async (proof: Proof) => {
    setLoadingId(proof.id);
    try {
      const q = new URLSearchParams({ url: proof.file_url });
      const res = await fetch(`/api/backend/media/presign?${q.toString()}`);
      if (!res.ok) throw new Error("presign failed");
      const body = await res.json();
      setOpenSrc(body.url);
    } catch (e) {
      setOpenSrc(proof.file_url);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className={styles.proofGrid}>
      {proofs.map((proof) => (
        <div key={proof.id} className={styles.proofCard}>
          <div className={styles.proofHeader}>
            <h4 className={styles.documentType}>
              {documentTypeLabels[proof.document_type] || proof.document_type}
            </h4>
            <AppTag
              color={visibilityLabels[proof.visibility]?.color || "default"}
            >
              {visibilityLabels[proof.visibility]?.label || proof.visibility}
            </AppTag>
          </div>

          {proof.description && (
            <p className={styles.description}>{proof.description}</p>
          )}

          <div className={styles.proofFooter}>
            <button className={styles.viewLink} onClick={() => onView(proof)} disabled={loadingId === proof.id}>
              {loadingId === proof.id ? "Loading…" : "View File"}
            </button>
            <span className={styles.uploadDate}>
              {new Date(proof.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      ))}

      {openSrc && <MediaViewer src={openSrc} onClose={() => setOpenSrc(null)} />}
    </div>
  );
}
