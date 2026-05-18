"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useKYCStatus, useSubmitKYC } from "@/hooks/use-frontend-data";
import { AppButton, AppCard, AppSpace, AppTag, useAppFeedback } from "@/components/ui";
import styles from "./kyc.module.css";

const ALLOWED_DOCUMENT_TYPES = ["national_id", "passport", "driver_license"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

type DocumentUpload = {
  type: string;
  file: File | null;
  preview?: string;
};

export default function KYCPage() {
  const router = useRouter();
  const { data: kycStatus, isLoading: isLoadingStatus } = useKYCStatus();
  const submitKYC = useSubmitKYC();
  const { message } = useAppFeedback();

  const [uploads, setUploads] = useState<DocumentUpload[]>(
    ALLOWED_DOCUMENT_TYPES.map((type) => ({ type, file: null })),
  );
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const isCompleted = kycStatus?.status === "APPROVED";
  const isRejected = kycStatus?.status === "REJECTED";
  const isPending = kycStatus?.status === "SUBMITTED" || kycStatus?.status === "REVIEWING";

  const handleFileSelect = (documentType: string, file: File | null) => {
    if (file && file.size > MAX_FILE_SIZE) {
      message.error(`File size must be under 10MB. Got ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      return;
    }

    setUploads((prev) =>
      prev.map((upload) => {
        if (upload.type === documentType) {
          const preview = file ? URL.createObjectURL(file) : undefined;
          return { ...upload, file, preview };
        }
        return upload;
      }),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const filledUploads = uploads.filter((u) => u.file);
    if (filledUploads.length === 0) {
      message.error("Please upload at least one document");
      return;
    }

    const formData = new FormData();
    filledUploads.forEach((upload) => {
      if (upload.file) {
        formData.append(upload.type, upload.file);
      }
    });

    try {
      await submitKYC.mutateAsync(formData);
      message.success("KYC documents submitted successfully. Awaiting admin review.");
      // Optionally redirect or reset form
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      message.error("Failed to submit KYC documents");
    }
  };

  if (isLoadingStatus) {
    return (
      <AppSpace direction="vertical" size="large" className={styles.container}>
        <div>Loading KYC status...</div>
      </AppSpace>
    );
  }

  return (
    <AppSpace direction="vertical" size="large" className={styles.container}>
      <div>
        <h1>KYC Verification</h1>
        <p className={styles.subtitle}>
          Submit your identity documents to complete verifi cation
        </p>
      </div>

      {/* Status Banner */}
      {isCompleted && (
        <AppCard className={styles.statusCard + " " + styles.approved}>
          <div className={styles.statusBanner}>
            <div className={styles.statusIcon}>✓</div>
            <div>
              <h3>KYC Approved</h3>
              <p>Your identity has been verified successfully</p>
            </div>
          </div>
        </AppCard>
      )}

      {isRejected && (
        <AppCard className={styles.statusCard + " " + styles.rejected}>
          <div className={styles.statusBanner}>
            <div className={styles.statusIcon}>✕</div>
            <div>
              <h3>KYC Rejected</h3>
              {kycStatus?.rejection_reason && (
                <p>Reason: {kycStatus.rejection_reason}</p>
              )}
              <p className={styles.retryText}>Please resubmit with corrected documents</p>
            </div>
          </div>
        </AppCard>
      )}

      {isPending && (
        <AppCard className={styles.statusCard + " " + styles.pending}>
          <div className={styles.statusBanner}>
            <div className={styles.statusIcon}>⏳</div>
            <div>
              <h3>KYC Under Review</h3>
              <p>Your documents are being reviewed by our team</p>
            </div>
          </div>
        </AppCard>
      )}

      {/* Submit Form - Only show if not approved */}
      {!isCompleted && (
        <form onSubmit={handleSubmit}>
          <AppCard>
            <AppSpace direction="vertical" size="large">
              <div>
                <h3>Upload Documents</h3>
                <p className={styles.formHint}>
                  Upload clear, legible copies of your identity documents. Supported formats: PDF, PNG, JPG
                </p>
              </div>

              <div className={styles.documentGrid}>
                {uploads.map((upload) => (
                  <DocumentUploadBox
                    key={upload.type}
                    documentType={upload.type}
                    file={upload.file}
                    preview={upload.preview}
                    onFileChange={(file) => handleFileSelect(upload.type, file)}
                    inputRef={(ref) => {
                      if (ref) fileInputRefs.current[upload.type] = ref;
                    }}
                  />
                ))}
              </div>

              <div className={styles.formActions}>
              <AppButton
                  onClick={handleSubmit}
                  loading={submitKYC.isPending}
                  disabled={uploads.every((u) => !u.file)}
                  block
                >
                  Submit KYC Documents
                </AppButton>
              </div>
            </AppSpace>
          </AppCard>
        </form>
      )}

      {/* Documents List - If uploaded */}
      {kycStatus?.documents && kycStatus.documents.length > 0 && (
        <AppCard>
          <AppSpace direction="vertical" size="medium">
            <h3>Submitted Documents</h3>
            <div className={styles.documentsList}>
              {kycStatus.documents.map((doc) => (
                <div key={doc.id} className={styles.documentItem}>
                  <div className={styles.documentInfo}>
                    <span className={styles.documentType}>{doc.document_type}</span>
                    <span className={styles.uploadDate}>
                      {new Date(doc.upload_date).toLocaleDateString()}
                    </span>
                  </div>
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                    View Document
                  </a>
                </div>
              ))}
            </div>
          </AppSpace>
        </AppCard>
      )}
    </AppSpace>
  );
}

interface DocumentUploadBoxProps {
  documentType: string;
  file: File | null;
  preview?: string;
  onFileChange: (file: File | null) => void;
  inputRef?: (ref: HTMLInputElement | null) => void;
}

function DocumentUploadBox({
  documentType,
  file,
  onFileChange,
  inputRef,
}: DocumentUploadBoxProps) {
  const inputElement = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (inputRef) {
      inputRef(inputElement.current);
    }
  }, [inputRef]);

  const typeLabel = {
    national_id: "National ID",
    passport: "Passport",
    driver_license: "Driver's License",
  }[documentType] || documentType;

  return (
    <div
      className={styles.uploadBox}
      onClick={() => inputElement.current?.click()}
      onDrop={(e) => {
        e.preventDefault();
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) onFileChange(droppedFile);
      }}
      onDragOver={(e) => e.preventDefault()}
    >
      <input
        ref={inputElement}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        onChange={(e) => onFileChange(e.target.files?.[0] || null)}
        style={{ display: "none" }}
      />

      {file ? (
        <div className={styles.uploadedContent}>
          <div className={styles.checkmark}>✓</div>
          <p className={styles.fileName}>{file.name}</p>
          <p className={styles.fileSize}>
            {(file.size / 1024 / 1024).toFixed(2)} MB
          </p>
          <AppTag color="green">Uploaded</AppTag>
        </div>
      ) : (
        <div className={styles.emptyContent}>
          <div className={styles.uploadIcon}>📄</div>
          <p className={styles.uploadLabel}>{typeLabel}</p>
          <p className={styles.uploadHint}>Click to upload or drag & drop</p>
        </div>
      )}
    </div>
  );
}
