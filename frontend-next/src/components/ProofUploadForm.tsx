"use client";

import { useState, useRef } from "react";
import { isAxiosError } from "axios";
import { useUploadCampaignProof } from "@/hooks/use-frontend-data";
import { AppButton, AppCard, AppSpace, useAppFeedback } from "@/components/ui";
import styles from "./ProofUploadForm.module.css";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "application/pdf": ".pdf",
};

const DOCUMENT_TYPES = [
  { value: "STUDENT_ID", label: "Student ID" },
  { value: "UTG_PORTAL", label: "UTG Portal Screenshot" },
  { value: "TRANSCRIPT", label: "Transcript" },
  { value: "TUITION_RECEIPT", label: "Tuition Receipt" },
  { value: "OTHER", label: "Other" },
];

const VISIBILITY_OPTIONS = [
  { value: "ADMIN_ONLY", label: "Admin Only (Private)" },
  { value: "DONOR_ONLY", label: "Donors Only" },
  { value: "PUBLIC", label: "Public" },
];

interface ProofUploadFormProps {
  slug: string;
  onSuccess?: () => void;
}

export function ProofUploadForm({ slug, onSuccess }: ProofUploadFormProps) {
  const uploadProof = useUploadCampaignProof();
  const { message } = useAppFeedback();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<string>("OTHER");
  const [visibility, setVisibility] = useState<string>("ADMIN_ONLY");
  const [description, setDescription] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!(file.type in ALLOWED_TYPES)) {
      message.error(
        `Invalid file type: ${file.type}. Only PNG, JPEG, and PDF are allowed.`,
      );
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      message.error("File is too large. Maximum size is 50MB.");
      return;
    }

    setSelectedFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile) {
      message.error("Please select a file");
      return;
    }

    try {
      setIsUploading(true);

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("document_type", documentType);
      formData.append("visibility", visibility);
      if (description.trim()) {
        formData.append("description", description.trim());
      }

      await uploadProof.mutateAsync({
        slug,
        formData,
      });

      message.success("Proof uploaded successfully");

      // Reset form
      setSelectedFile(null);
      setDocumentType("OTHER");
      setVisibility("ADMIN_ONLY");
      setDescription("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      onSuccess?.();
    } catch (error) {
      const errorMsg = isAxiosError(error)
        ? error.response?.data?.detail || "Failed to upload proof"
        : "Failed to upload proof";
      message.error(errorMsg);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <AppCard className={styles.formContainer}>
      <AppSpace direction="vertical" size="large">
        <div>
          <h3>Upload Proof / Evidence</h3>
          <p className={styles.description}>
            Share documents to prove your campaign purpose (student ID, portal screenshot, receipt, etc.)
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <AppSpace direction="vertical" size="middle">
            {/* File Input */}
            <div className={styles.formGroup}>
              <label htmlFor="file-input" className={styles.label}>
                File (PNG, JPEG, or PDF)
              </label>
              <div className={styles.fileInputWrapper}>
                <input
                  ref={fileInputRef}
                  id="file-input"
                  type="file"
                  accept={Object.keys(ALLOWED_TYPES).join(",")}
                  onChange={handleFileSelect}
                  disabled={isUploading}
                  className={styles.fileInput}
                />
                <span className={styles.fileName}>
                  {selectedFile ? selectedFile.name : "Choose a file..."}
                </span>
              </div>
            </div>

            {/* Document Type */}
            <div className={styles.formGroup}>
              <label htmlFor="doc-type" className={styles.label}>
                Document Type
              </label>
              <select
                id="doc-type"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                disabled={isUploading}
                className={styles.select}
              >
                {DOCUMENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Visibility */}
            <div className={styles.formGroup}>
              <label htmlFor="visibility" className={styles.label}>
                Who can see this? (You decide)
              </label>
              <select
                id="visibility"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
                disabled={isUploading}
                className={styles.select}
              >
                {VISIBILITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className={styles.hint}>
                {visibility === "ADMIN_ONLY" && "Only admin and you can view this."}
                {visibility === "DONOR_ONLY" && "Your donors can view this proof."}
                {visibility === "PUBLIC" && "Everyone can view this proof."}
              </p>
            </div>

            {/* Description */}
            <div className={styles.formGroup}>
              <label htmlFor="description" className={styles.label}>
                Description (Optional)
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isUploading}
                placeholder="Add a brief description of this proof..."
                maxLength={500}
                className={styles.textarea}
              />
              <span className={styles.charCount}>
                {description.length}/500
              </span>
            </div>

            {/* Submit Button */}
            <AppButton
              htmlType="submit"
              disabled={!selectedFile || isUploading}
              loading={isUploading}
              block
            >
              {isUploading ? "Uploading..." : "Upload Proof"}
            </AppButton>
          </AppSpace>
        </form>
      </AppSpace>
    </AppCard>
  );
}
