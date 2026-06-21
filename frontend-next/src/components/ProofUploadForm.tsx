"use client";

import { useState, useRef } from "react";
import { isAxiosError } from "axios";
import { useUploadCampaignProof } from "@/hooks/use-frontend-data";
import { StyledSelect } from "@/components/ui/styled-select";

const BLUE = "#1dc5ff";
const RED = "#ef4444";
const GREEN = "#1bbf88";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "application/pdf": ".pdf",
};

const DOCUMENT_TYPES = [
  { value: "STUDENT_ID",      label: "Student ID" },
  { value: "UTG_PORTAL",      label: "UTG Portal Screenshot" },
  { value: "TRANSCRIPT",      label: "Transcript" },
  { value: "TUITION_RECEIPT", label: "Tuition Receipt" },
  { value: "OTHER",           label: "Other" },
];

const VISIBILITY_OPTIONS = [
  { value: "ADMIN_ONLY", label: "Admin Only (Private)" },
  { value: "DONOR_ONLY", label: "Donors Only" },
  { value: "PUBLIC",     label: "Public — everyone sees this" },
];

const VISIBILITY_HINTS: Record<string, string> = {
  ADMIN_ONLY: "Only admins and you can view this document.",
  DONOR_ONLY: "Donors who have contributed to your campaign can view this.",
  PUBLIC:     "Anyone visiting your campaign page can view this.",
};

interface ProofUploadFormProps {
  slug: string;
  onSuccess?: () => void;
}

export function ProofUploadForm({ slug, onSuccess }: ProofUploadFormProps) {
  const { mutateAsync: uploadProof } = useUploadCampaignProof();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState("OTHER");
  const [visibility, setVisibility] = useState("ADMIN_ONLY");
  const [description, setDescription] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const fieldStyle: React.CSSProperties = {
    width: "100%", padding: "11px 14px", borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)",
    color: "#f0f6ff", fontSize: 14, outline: "none", boxSizing: "border-box",
    fontFamily: "inherit", transition: "border-color 0.2s",
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!(file.type in ALLOWED_TYPES)) {
      setError(`Unsupported file type: ${file.type}. Use PNG, JPEG, or PDF.`);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("File is too large. Maximum size is 50 MB.");
      return;
    }
    setSelectedFile(file);
    setSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) { setError("Please select a file first."); return; }
    setError(null);
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("document_type", documentType);
      formData.append("visibility", visibility);
      if (description.trim()) formData.append("description", description.trim());

      await uploadProof({ slug, formData });

      setSelectedFile(null);
      setDocumentType("OTHER");
      setVisibility("ADMIN_ONLY");
      setDescription("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSuccess(true);
      onSuccess?.();
    } catch (err) {
      setError(
        isAxiosError(err) ? (err.response?.data?.detail ?? "Upload failed") : "Upload failed"
      );
    } finally {
      setIsUploading(false);
    }
  };

  if (success) {
    return (
      <div style={{ padding: "16px 18px", borderRadius: 12, background: "rgba(27,191,136,0.08)", border: "1px solid rgba(27,191,136,0.2)", color: GREEN, fontSize: 14, fontWeight: 600, textAlign: "center" }}>
        Proof uploaded successfully!{" "}
        <button onClick={() => setSuccess(false)} style={{ background: "none", border: "none", color: BLUE, cursor: "pointer", fontWeight: 700, fontSize: 14, padding: 0, marginLeft: 4 }}>
          Upload another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", fontSize: 13, color: "#fca5a5" }}>
          {error}
        </div>
      )}

      {/* File picker */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#8899aa", display: "block", marginBottom: 6 }}>
          File <span style={{ color: "#4a5568", fontWeight: 400 }}>(PNG, JPEG, or PDF — max 50 MB)</span>
        </label>
        <div
          onClick={() => fileInputRef.current?.click()}
          style={{
            display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
            border: `2px dashed ${selectedFile ? "rgba(29,197,255,0.4)" : "rgba(255,255,255,0.12)"}`,
            borderRadius: 10, background: "rgba(255,255,255,0.03)",
            cursor: "pointer", transition: "border-color 0.2s",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={selectedFile ? BLUE : "#4a5568"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <span style={{ fontSize: 13, color: selectedFile ? "#f0f6ff" : "#4a5568", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {selectedFile ? selectedFile.name : "Click to choose a file…"}
          </span>
          {selectedFile && (
            <span style={{ fontSize: 11, color: "#6b7a8d", flexShrink: 0 }}>
              {(selectedFile.size / 1024).toFixed(0)} KB
            </span>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept={Object.keys(ALLOWED_TYPES).join(",")} onChange={handleFileSelect} style={{ display: "none" }} disabled={isUploading} />
      </div>

      {/* Document type */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#8899aa", display: "block", marginBottom: 6 }}>Document type</label>
        <StyledSelect
          value={documentType}
          onChange={setDocumentType}
          options={DOCUMENT_TYPES}
          disabled={isUploading}
        />
      </div>

      {/* Visibility */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#8899aa", display: "block", marginBottom: 6 }}>Who can see this?</label>
        <StyledSelect
          value={visibility}
          onChange={setVisibility}
          options={VISIBILITY_OPTIONS}
          disabled={isUploading}
        />
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "#4a5568", fontStyle: "italic" }}>
          {VISIBILITY_HINTS[visibility]}
        </p>
      </div>

      {/* Description */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#8899aa", display: "block", marginBottom: 6 }}>
          Description <span style={{ color: "#4a5568", fontWeight: 400 }}>(optional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of this document…"
          maxLength={500}
          rows={3}
          disabled={isUploading}
          style={{ ...fieldStyle, resize: "vertical", minHeight: 80 }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(29,197,255,0.4)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
        />
        <span style={{ fontSize: 11, color: "#4a5568", display: "block", textAlign: "right", marginTop: 3 }}>{description.length}/500</span>
      </div>

      <button
        type="submit"
        disabled={!selectedFile || isUploading}
        style={{
          width: "100%", padding: "12px", borderRadius: 10, border: "none",
          background: `linear-gradient(135deg, ${BLUE}, #079bd4)`,
          color: "#fff", fontSize: 14, fontWeight: 700,
          cursor: !selectedFile || isUploading ? "not-allowed" : "pointer",
          opacity: !selectedFile || isUploading ? 0.6 : 1,
          boxShadow: "0 4px 16px rgba(29,197,255,0.25)", transition: "opacity 0.2s",
        }}
      >
        {isUploading ? "Uploading…" : "Upload Proof"}
      </button>
    </form>
  );
}
