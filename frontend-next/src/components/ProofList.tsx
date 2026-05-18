"use client";

import { Proof, ProofVisibility } from "@/types/frontend";
import { AppText, AppTag } from "@/components/ui";
import styles from "./ProofList.module.css";

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
  if (!proofs || proofs.length === 0) {
    return (
      <div className={styles.emptyState}>
        <AppText type="secondary">No proofs uploaded yet</AppText>
      </div>
    );
  }

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
            <a
              href={proof.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.viewLink}
            >
              View File
            </a>
            <span className={styles.uploadDate}>
              {new Date(proof.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
