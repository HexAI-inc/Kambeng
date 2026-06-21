"use client";

import { useState, useRef, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  useMyCampaigns,
  useCampaignUpdates,
  usePostCampaignUpdate,
  useDeleteCampaignUpdate,
} from "@/hooks/use-frontend-data";
import { useAppFeedback } from "@/components/ui";
import MediaViewer from "@/components/ui/MediaViewer";
import { StyledSelect } from "@/components/ui/styled-select";
import { UpdateFeedPost } from "@/components/UpdateFeedPost";
import type { CampaignUpdate } from "@/types/frontend";

const BLUE = "#1dc5ff";
const GREEN = "#1bbf88";
const MAX_ATTACHMENTS = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.38, delay, ease: "easeOut" as const },
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
      <path d="M10 11v6M14 11v6"/>
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
    </svg>
  );
}

function IconPaperclip() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66L9.41 17.41a2 2 0 01-2.83-2.83l8.49-8.48"/>
    </svg>
  );
}

function IconBell() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 01-3.46 0"/>
    </svg>
  );
}

export default function CampaignUpdatesPage() {
  const params = useParams();
  const campaignId = typeof params.campaignId === "string" ? params.campaignId : null;
  const { message } = useAppFeedback();

  const { data: myCampaigns, isLoading: campaignsLoading } = useMyCampaigns(Boolean(campaignId));
  const campaign = useMemo(() => {
    if (!campaignId || !myCampaigns) return null;
    return myCampaigns.find((c) => c.id === Number(campaignId)) ?? null;
  }, [campaignId, myCampaigns]);

  const campaignSlug = campaign?.slug ?? null;

  const { data: updates = [], isLoading: updatesLoading } = useCampaignUpdates(
    campaignSlug ?? undefined,
    Boolean(campaignSlug),
  );

  const postUpdate = usePostCampaignUpdate();
  const deleteUpdate = useDeleteCampaignUpdate();

  // Composer state
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [category, setCategory] = useState("");
  const [amountSpent, setAmountSpent] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [attachPreviews, setAttachPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const attachInputRef = useRef<HTMLInputElement | null>(null);

  // Media viewer
  const [viewer, setViewer] = useState<{ src: string; type: string | null } | null>(null);

  const handleAttachFiles = (files: FileList | null) => {
    if (!files) return;
    const remaining = MAX_ATTACHMENTS - attachments.length;
    if (remaining <= 0) {
      message.error(`Max ${MAX_ATTACHMENTS} images allowed.`);
      return;
    }
    const toAdd = Array.from(files).slice(0, remaining);
    const valid: File[] = [];
    for (const file of toAdd) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        message.error(`${file.name}: only PNG, JPEG, WebP allowed.`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        message.error(`${file.name}: max 10MB.`);
        continue;
      }
      valid.push(file);
    }
    if (!valid.length) return;
    setAttachments((prev) => [...prev, ...valid]);
    valid.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setAttachPreviews((prev) => [...prev, e.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
    if (attachInputRef.current) attachInputRef.current.value = "";
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
    setAttachPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!campaignSlug) return;
    if (!text.trim()) {
      message.error("Update text is required.");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      if (title.trim()) fd.append("title", title.trim());
      fd.append("text", text.trim());
      if (category) fd.append("category", category);
      if (amountSpent && !isNaN(Number(amountSpent))) fd.append("amount_spent", amountSpent);
      attachments.forEach((file) => fd.append("files", file));
      await postUpdate.mutateAsync({ slug: campaignSlug, formData: fd });
      message.success("Update posted");
      setTitle("");
      setText("");
      setCategory("");
      setAmountSpent("");
      setAttachments([]);
      setAttachPreviews([]);
    } catch {
      message.error("Failed to post update");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (update: CampaignUpdate) => {
    if (!campaignSlug) return;
    if (!window.confirm("Delete this update?")) return;
    try {
      await deleteUpdate.mutateAsync({ slug: campaignSlug, updateId: update.id });
      message.success("Update deleted");
    } catch {
      message.error("Failed to delete update");
    }
  };

  if (!campaignId) {
    return <div style={{ color: "#f0f6ff", padding: 32 }}>Invalid campaign ID</div>;
  }

  return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", padding: "28px clamp(16px, 4vw, 48px)" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Header */}
        <motion.div {...fadeUp(0)} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <Link href={`/dashboard/my-campaigns/${campaignId}/images`} style={{ fontSize: 12, color: "#4a5568", fontWeight: 500 }}>
                ← Campaign Media
              </Link>
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.03em", marginBottom: 4 }}>
              {campaignsLoading ? "Loading…" : campaign?.title ?? "Campaign"}
            </div>
            <div style={{ fontSize: 13, color: "#6b7a8d" }}>Post updates to keep your donors informed</div>
          </div>
          {campaignSlug && (
            <div style={{ display: "flex", gap: 8 }}>
              <Link href={`/campaigns/${campaignSlug}`}>
                <button style={{
                  padding: "9px 16px", borderRadius: 9,
                  border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)",
                  color: "#8899aa", fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}>Public page ↗</button>
              </Link>
            </div>
          )}
        </motion.div>

        {/* Composer card */}
        <motion.div {...fadeUp(0.06)}>
          <div style={{
            background: "#0d1120", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 9,
                background: "rgba(29,197,255,0.1)", border: "1px solid rgba(29,197,255,0.18)",
                display: "flex", alignItems: "center", justifyContent: "center", color: BLUE, flexShrink: 0,
              }}>
                <IconBell />
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#f0f6ff" }}>Post an update</div>
            </div>

            {/* Title input */}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Update title (optional)"
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 9,
                border: "1px solid rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.04)",
                color: "#f0f6ff", fontSize: 13, outline: "none", boxSizing: "border-box",
              }}
            />

            {/* Text textarea */}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Share how things are going, what the funds are being used for, photos from the field…"
              rows={5}
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 9,
                border: "1px solid rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.04)",
                color: "#f0f6ff", fontSize: 13, resize: "vertical", outline: "none",
                boxSizing: "border-box", lineHeight: 1.65,
              }}
            />

            {/* Category + Amount row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <StyledSelect
                value={category}
                onChange={setCategory}
                placeholder="Category (optional)"
                options={[
                  { value: "GENERAL", label: "General Update" },
                  { value: "FINANCIAL_UPDATE", label: "Financial Update" },
                  { value: "MILESTONE", label: "Milestone Reached" },
                  { value: "THANK_YOU", label: "Thank You" },
                  { value: "URGENT", label: "Urgent" },
                ]}
              />
              <input
                type="number"
                value={amountSpent}
                onChange={(e) => setAmountSpent(e.target.value)}
                placeholder="GMD spent (optional)"
                min="0"
                step="0.01"
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 9,
                  border: "1px solid rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.04)",
                  color: "#f0f6ff", fontSize: 13, outline: "none", boxSizing: "border-box",
                }}
              />
            </div>

            {/* Attachment thumbnails */}
            {attachPreviews.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {attachPreviews.map((src, idx) => (
                  <div key={idx} style={{ position: "relative", width: 72, height: 72, borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <button
                      onClick={() => removeAttachment(idx)}
                      style={{
                        position: "absolute", top: 3, right: 3,
                        width: 18, height: 18, borderRadius: 4,
                        background: "rgba(0,0,0,0.75)", border: "none",
                        color: "#fff", fontSize: 10, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* Footer row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div>
                <input
                  ref={attachInputRef}
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => handleAttachFiles(e.target.files)}
                  style={{ display: "none" }}
                />
                <button
                  onClick={() => attachInputRef.current?.click()}
                  disabled={attachments.length >= MAX_ATTACHMENTS}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "8px 14px", borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.09)",
                    background: "rgba(255,255,255,0.03)",
                    color: attachments.length >= MAX_ATTACHMENTS ? "#4a5568" : "#8899aa",
                    fontSize: 12, fontWeight: 600, cursor: attachments.length >= MAX_ATTACHMENTS ? "not-allowed" : "pointer",
                  }}
                >
                  <IconPaperclip />
                  {attachments.length > 0 ? `${attachments.length}/${MAX_ATTACHMENTS} images` : "Attach images"}
                </button>
              </div>
              <button
                onClick={() => void handleSubmit()}
                disabled={submitting || !text.trim()}
                style={{
                  padding: "10px 24px", borderRadius: 10, border: "none",
                  background: submitting || !text.trim()
                    ? "rgba(29,197,255,0.25)"
                    : `linear-gradient(135deg, ${BLUE}, #079bd4)`,
                  color: submitting || !text.trim() ? "rgba(255,255,255,0.4)" : "#fff",
                  fontSize: 13, fontWeight: 700,
                  cursor: submitting || !text.trim() ? "not-allowed" : "pointer",
                  boxShadow: submitting || !text.trim() ? "none" : "0 4px 16px rgba(29,197,255,0.3)",
                  transition: "all 0.2s",
                }}
              >
                {submitting ? "Posting…" : "Post Update"}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Updates feed */}
        <motion.div {...fadeUp(0.1)} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {updatesLoading ? (
            <div style={{ padding: "40px 24px", textAlign: "center" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", border: `2px solid ${BLUE}`, borderTopColor: "transparent", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
            </div>
          ) : updates.length === 0 ? (
            <div style={{
              padding: "48px 24px", textAlign: "center",
              background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)",
              borderRadius: 14,
            }}>
              <div style={{ color: BLUE, marginBottom: 10, opacity: 0.5 }}><IconBell /></div>
              <div style={{ fontSize: 14, color: "#4a5568" }}>
                No updates yet. Post your first update to keep donors informed.
              </div>
            </div>
          ) : (
            updates.map((update: CampaignUpdate, i: number) => (
              <motion.div key={update.id} {...fadeUp(0.05 * i)}>
                <UpdateFeedPost
                  update={update}
                  onImageOpen={(url) => setViewer({ src: url, type: null })}
                  onDelete={() => void handleDelete(update)}
                />
              </motion.div>
            ))
          )}
        </motion.div>
      </div>

      {viewer && (
        <MediaViewer src={viewer.src} type={viewer.type ?? undefined} onClose={() => setViewer(null)} />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
