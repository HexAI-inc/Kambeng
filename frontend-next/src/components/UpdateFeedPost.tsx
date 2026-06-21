"use client";

import { useState } from "react";
import type { CampaignUpdate } from "@/types/frontend";

const BLUE = "#1dc5ff";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const coverImg: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover", display: "block" };

function Cell({ att, onOpen, overlay }: {
  att: CampaignUpdate["attachments"][0];
  onOpen: (url: string) => void;
  overlay?: string;
}) {
  return (
    <div
      onClick={() => onOpen(att.file_url)}
      style={{ width: "100%", aspectRatio: "1", overflow: "hidden", cursor: "zoom-in", background: "#080c16", position: "relative", flexShrink: 0 }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={att.file_url} alt={att.file_name ?? ""} style={coverImg} />
      {overlay && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 22, fontWeight: 800 }}>
          {overlay}
        </div>
      )}
    </div>
  );
}

function PhotoGrid({ attachments, onOpen }: {
  attachments: CampaignUpdate["attachments"];
  onOpen: (url: string) => void;
}) {
  const n = attachments.length;
  if (n === 0) return null;

  if (n === 1) {
    return (
      <div style={{ width: "100%", aspectRatio: "1", overflow: "hidden", cursor: "zoom-in", background: "#080c16" }}
        onClick={() => onOpen(attachments[0].file_url)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={attachments[0].file_url} alt={attachments[0].file_name ?? ""} style={coverImg} />
      </div>
    );
  }

  if (n === 2) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
        {attachments.map((att) => <Cell key={att.id} att={att} onOpen={onOpen} />)}
      </div>
    );
  }

  if (n === 3) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 2 }}>
        <Cell att={attachments[0]} onOpen={onOpen} />
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Cell att={attachments[1]} onOpen={onOpen} />
          <Cell att={attachments[2]} onOpen={onOpen} />
        </div>
      </div>
    );
  }

  const visible = attachments.slice(0, 4);
  const extra = n - 4;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
      {visible.map((att, i) => (
        <Cell key={att.id} att={att} onOpen={onOpen} overlay={i === 3 && extra > 0 ? `+${extra + 1}` : undefined} />
      ))}
    </div>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  GENERAL: "General Update",
  FINANCIAL_UPDATE: "Financial Update",
  MILESTONE: "Milestone",
  THANK_YOU: "Thank You",
  URGENT: "Urgent",
};

type UpdateFeedPostProps = {
  update: CampaignUpdate;
  onImageOpen: (url: string) => void;
  onDelete?: () => void;
  onReport?: () => void;
};

export function UpdateFeedPost({ update, onImageOpen, onDelete, onReport }: UpdateFeedPostProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const atts = update.attachments ?? [];
  const hasImages = atts.length > 0;
  const initial = (update.author_name ?? "C")[0].toUpperCase();
  const categoryLabel = update.category ? (CATEGORY_LABELS[update.category] ?? update.category) : null;

  return (
    <div style={{
      background: "#0d1120",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 16,
      overflow: "hidden",
    }}>
      {/* Author row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", paddingBottom: hasImages ? 12 : 14 }}>
        <div style={{
          width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
          background: `linear-gradient(135deg, ${BLUE}, #079bd4)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 15, fontWeight: 800, color: "#fff",
        }}>
          {initial}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#f0f6ff", lineHeight: 1.2 }}>
            {update.author_name ?? "Campaign owner"}
          </div>
          <div style={{ fontSize: 12, color: "#4a5568", marginTop: 1 }}>
            {timeAgo(update.created_at)}
            {categoryLabel && <span style={{ marginLeft: 6, color: BLUE, fontWeight: 600 }}>· {categoryLabel}</span>}
          </div>
        </div>

        {/* Report button (donors) */}
        {onReport && !onDelete && (
          <button
            onClick={onReport}
            title="Report this update"
            style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "transparent",
              color: "#4a5568", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#f87171"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#4a5568"; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
              <line x1="4" y1="22" x2="4" y2="15"/>
            </svg>
          </button>
        )}

        {/* Delete button (owner) — two-step confirm */}
        {onDelete && !confirmDelete && (
          <button
            onClick={() => setConfirmDelete(true)}
            title="Delete update"
            style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              border: "1px solid rgba(239,68,68,0.2)",
              background: "rgba(239,68,68,0.05)",
              color: "#f87171", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
            </svg>
          </button>
        )}
        {onDelete && confirmDelete && (
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            <button
              onClick={() => { onDelete(); setConfirmDelete(false); }}
              style={{
                padding: "4px 10px", borderRadius: 7, border: "none",
                background: "#ef4444", color: "#fff",
                fontSize: 11, fontWeight: 700, cursor: "pointer",
              }}
            >Delete</button>
            <button
              onClick={() => setConfirmDelete(false)}
              style={{
                padding: "4px 8px", borderRadius: 7,
                border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)",
                color: "#6b7a8d", fontSize: 11, fontWeight: 600, cursor: "pointer",
              }}
            >Cancel</button>
          </div>
        )}
      </div>

      {/* Images — edge-to-edge */}
      {hasImages && (
        <div style={{ width: "100%" }}>
          <PhotoGrid attachments={atts} onOpen={onImageOpen} />
        </div>
      )}

      {/* Caption */}
      <div style={{ padding: "14px 16px" }}>
        {update.title && (
          <div style={{ fontSize: 15, fontWeight: 700, color: "#f0f6ff", marginBottom: 6, lineHeight: 1.3, letterSpacing: "-0.01em" }}>
            {update.title}
          </div>
        )}
        <p style={{ fontSize: 14, color: "#a0aec0", lineHeight: 1.75, margin: 0, whiteSpace: "pre-wrap" }}>
          {update.text}
        </p>
        {update.amount_spent != null && update.amount_spent > 0 && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            marginTop: 10, padding: "4px 10px", borderRadius: 20,
            background: "rgba(27,191,136,0.08)", border: "1px solid rgba(27,191,136,0.2)",
            fontSize: 12, fontWeight: 700, color: "#1bbf88",
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
            </svg>
            GMD {update.amount_spent.toLocaleString()} spent
          </div>
        )}
      </div>
    </div>
  );
}
