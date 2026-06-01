"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";

import { AppProgress } from "@/components/ui";
import MediaViewer from "@/components/ui/MediaViewer";
import { ReviewForm } from "@/components/reviews/review-form";
import { ProofList } from "@/components/ProofList";
import {
  useCampaignGoals,
  usePublicCampaignImages,
  useCampaignProofs,
  usePublicCampaignReviews,
  useSubmitModerationReport,
  useSessionProfile,
  useCampaignQRCode,
  useCampaignUpdates,
} from "@/hooks/use-frontend-data";
import { api } from "@/lib/api";
import type { CampaignDiscoveryItem, CampaignGoal, CampaignReview, CampaignUpdate, PublicCampaignImage } from "@/types/frontend";

const BLUE = "#1dc5ff";
const GREEN = "#1bbf88";
const RED = "#ef4444";

function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.38, delay, ease: "easeOut" as const },
  };
}

function IconPicture() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
  );
}
function IconDoc() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  );
}
function IconShare() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  );
}
function IconStar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>
  );
}
function IconQR() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/>
      <rect x="18" y="14" width="3" height="3"/><rect x="14" y="18" width="3" height="3"/>
      <rect x="18" y="18" width="3" height="3"/>
    </svg>
  );
}
function IconCopy() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
    </svg>
  );
}
function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}
function IconClose() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}
function IconArrowRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
    </svg>
  );
}
function IconArrowLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
    </svg>
  );
}
function IconFlag() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 22V4" />
      <path d="M4 4h13l-2 4 2 4H4" />
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

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
      <div style={{
        width: 34, height: 34, borderRadius: 9,
        background: "rgba(29,197,255,0.1)", border: "1px solid rgba(29,197,255,0.18)",
        display: "flex", alignItems: "center", justifyContent: "center", color: BLUE,
      }}>{icon}</div>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: "#f0f6ff", margin: 0 }}>{title}</h3>
    </div>
  );
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width="13" height="13" viewBox="0 0 24 24" fill={i < rating ? "#fbbf24" : "rgba(255,255,255,0.12)"}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ))}
    </div>
  );
}

// ─── Social card formats ────────────────────────────────────────────────────
const CARD_FORMATS = [
  { key: "square",  label: "Square",  sub: "Instagram / Facebook",  w: 1080, h: 1080 },
  { key: "story",   label: "Story",   sub: "WhatsApp / IG Status",  w: 1080, h: 1920 },
  { key: "wide",    label: "Wide",    sub: "Twitter / LinkedIn",    w: 1200, h:  630 },
] as const;
type CardFormat = typeof CARD_FORMATS[number]["key"];

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function generateSocialCard(opts: {
  format: CardFormat;
  title: string;
  amountRaised: number;
  targetAmount?: number | null;
  coverUrl?: string | null;
  qrSrc: string;
  campaignUrl: string;
}): Promise<string> {
  const fmt = CARD_FORMATS.find((f) => f.key === opts.format)!;
  const W = fmt.w;
  const H = fmt.h;
  const isStory = opts.format === "story";
  const isWide = opts.format === "wide";

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // ── Background ────────────────────────────────────────────────────────────
  if (opts.coverUrl) {
    try {
      const cover = await loadImage(opts.coverUrl);
      // fill canvas with cover, centered crop
      const scale = Math.max(W / cover.width, H / cover.height);
      const sw = cover.width * scale;
      const sh = cover.height * scale;
      ctx.drawImage(cover, (W - sw) / 2, (H - sh) / 2, sw, sh);
    } catch {
      // fallback gradient if image fails CORS
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, "#0d2a45");
      grad.addColorStop(1, "#061420");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }
  } else {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#0d2a45");
    grad.addColorStop(1, "#061420");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // ── Dark scrim overlay ────────────────────────────────────────────────────
  const scrim = ctx.createLinearGradient(0, isStory ? H * 0.3 : H * 0.1, 0, H);
  scrim.addColorStop(0, "rgba(6,10,20,0)");
  scrim.addColorStop(isStory ? 0.5 : 0.4, "rgba(6,10,20,0.82)");
  scrim.addColorStop(1, "rgba(6,10,20,0.97)");
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, W, H);

  // ── Blue accent bar at top ────────────────────────────────────────────────
  ctx.fillStyle = "#1dc5ff";
  ctx.fillRect(0, 0, W, 8);

  // ── "K" logo mark (top-left) ──────────────────────────────────────────────
  const logoSize = isWide ? 60 : 80;
  const logoPad = isWide ? 40 : 60;
  const logoR = 14;
  ctx.save();
  const lx = logoPad, ly = logoPad + 8;
  ctx.beginPath();
  ctx.moveTo(lx + logoR, ly);
  ctx.arcTo(lx + logoSize, ly, lx + logoSize, ly + logoSize, logoR);
  ctx.arcTo(lx + logoSize, ly + logoSize, lx, ly + logoSize, logoR);
  ctx.arcTo(lx, ly + logoSize, lx, ly, logoR);
  ctx.arcTo(lx, ly, lx + logoSize, ly, logoR);
  ctx.closePath();
  const logoGrad = ctx.createLinearGradient(lx, ly, lx + logoSize, ly + logoSize);
  logoGrad.addColorStop(0, "#1dc5ff");
  logoGrad.addColorStop(1, "#079bd4");
  ctx.fillStyle = logoGrad;
  ctx.fill();
  ctx.font = `900 ${Math.round(logoSize * 0.5)}px sans-serif`;
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("K", lx + logoSize / 2, ly + logoSize / 2);
  ctx.restore();

  // ── "Kambeng" wordmark ────────────────────────────────────────────────────
  ctx.save();
  ctx.font = `700 ${isWide ? 28 : 36}px sans-serif`;
  ctx.fillStyle = "#f0f6ff";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Kambeng", logoPad + logoSize + 18, ly + logoSize / 2);
  ctx.restore();

  // ── Content area (bottom portion) ────────────────────────────────────────
  const contentY = isStory ? H * 0.52 : H * 0.38;
  const pad = isWide ? 56 : 80;
  const maxTextW = isWide ? W * 0.55 : W - pad * 2;

  // Campaign title
  const titleSize = isWide ? 52 : isStory ? 72 : 64;
  ctx.save();
  ctx.font = `800 ${titleSize}px sans-serif`;
  ctx.fillStyle = "#f0f6ff";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const titleLines = wrapText(ctx, opts.title, maxTextW);
  const lineH = titleSize * 1.25;
  titleLines.slice(0, 3).forEach((line, i) => {
    ctx.fillText(line, pad, contentY + i * lineH);
  });
  ctx.restore();

  const afterTitle = contentY + Math.min(titleLines.length, 3) * lineH + (isStory ? 40 : 30);

  // Amount raised pill
  const raisedText = `${opts.amountRaised.toLocaleString()} GMD raised`;
  const pillH = isWide ? 52 : 64;
  const pillPad = 32;
  ctx.save();
  ctx.font = `700 ${isWide ? 26 : 32}px sans-serif`;
  const pillW = ctx.measureText(raisedText).width + pillPad * 2;
  const pillR = pillH / 2;
  ctx.beginPath();
  ctx.moveTo(pad + pillR, afterTitle);
  ctx.arcTo(pad + pillW, afterTitle, pad + pillW, afterTitle + pillH, pillR);
  ctx.arcTo(pad + pillW, afterTitle + pillH, pad, afterTitle + pillH, pillR);
  ctx.arcTo(pad, afterTitle + pillH, pad, afterTitle, pillR);
  ctx.arcTo(pad, afterTitle, pad + pillW, afterTitle, pillR);
  ctx.closePath();
  ctx.fillStyle = "rgba(29,197,255,0.18)";
  ctx.fill();
  ctx.strokeStyle = "rgba(29,197,255,0.5)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#1dc5ff";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(raisedText, pad + pillPad, afterTitle + pillH / 2);
  ctx.restore();

  // Progress bar (if target known)
  if (opts.targetAmount) {
    const pct = Math.min(opts.amountRaised / opts.targetAmount, 1);
    const barY = afterTitle + pillH + (isStory ? 36 : 28);
    const barH = isWide ? 10 : 14;
    const barW = isWide ? W * 0.52 : W - pad * 2;
    const barR = barH / 2;
    // track
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(pad, barY, barW, barH, barR);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fill();
    // fill
    if (pct > 0) {
      ctx.beginPath();
      ctx.roundRect(pad, barY, barW * pct, barH, barR);
      const barGrad = ctx.createLinearGradient(pad, 0, pad + barW, 0);
      barGrad.addColorStop(0, "#1dc5ff");
      barGrad.addColorStop(1, "#1bbf88");
      ctx.fillStyle = barGrad;
      ctx.fill();
    }
    ctx.restore();
  }

  // ── QR code (bottom-right for wide, bottom-center for story, bottom-right for square) ─
  const qrImg = await loadImage(opts.qrSrc);
  const qrSize = isStory ? 320 : isWide ? 220 : 260;
  const qrPad = isWide ? 56 : 80;
  const qrX = isWide ? W - qrPad - qrSize : isStory ? (W - qrSize) / 2 : W - qrPad - qrSize;
  const qrY = H - qrPad - qrSize;
  const qrR = 20;

  // white card behind QR
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 30;
  ctx.beginPath();
  ctx.roundRect(qrX - 16, qrY - 16, qrSize + 32, qrSize + 32, qrR + 4);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();
  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

  // "Scan to donate" label under QR
  ctx.save();
  ctx.font = `600 ${isWide ? 22 : 26}px sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.textAlign = isStory ? "center" : "right";
  ctx.textBaseline = "top";
  const labelX = isStory ? W / 2 : qrX + qrSize + 16;
  ctx.fillText("Scan to donate", labelX, qrY + qrSize + 32 + 16);
  ctx.restore();

  // ── Domain watermark bottom-left ──────────────────────────────────────────
  ctx.save();
  ctx.font = `500 ${isWide ? 22 : 26}px sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  const domain = opts.campaignUrl.replace(/^https?:\/\//, "");
  ctx.fillText(domain, pad, H - (isWide ? 40 : 56));
  ctx.restore();

  return canvas.toDataURL("image/png");
}

// ─── Share Modal ─────────────────────────────────────────────────────────────
function ShareModal({ campaign, onClose }: { campaign: CampaignDiscoveryItem; onClose: () => void }) {
  const [tab, setTab] = useState<"links" | "social">("links");
  const [copied, setCopied] = useState<string | null>(null);
  const [cardFormat, setCardFormat] = useState<CardFormat>("square");
  const [cardSrc, setCardSrc] = useState<string | null>(null);
  const [cardLoading, setCardLoading] = useState(false);
  const [cardCopied, setCardCopied] = useState(false);

  const { data: qrData, isLoading: qrLoading } = useCampaignQRCode(campaign.slug, true);

  const campaignUrl = typeof window !== "undefined"
    ? `${window.location.origin}/campaigns/${campaign.slug}`
    : `/campaigns/${campaign.slug}`;

  const donateUrl = typeof window !== "undefined"
    ? `${window.location.origin}/quick-pay/${campaign.slug}`
    : `/quick-pay/${campaign.slug}`;

  const qrSrc = qrData?.qr_code_base64
    ? qrData.qr_code_base64.startsWith("data:")
      ? qrData.qr_code_base64
      : `data:image/png;base64,${qrData.qr_code_base64}`
    : null;

  const copy = useCallback(async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch { /* silent */ }
  }, []);

  const buildCard = useCallback(async (fmt: CardFormat) => {
    if (!qrSrc) return;
    setCardLoading(true);
    setCardSrc(null);
    try {
      const src = await generateSocialCard({
        format: fmt,
        title: campaign.title,
        amountRaised: campaign.amount_raised,
        targetAmount: campaign.target_amount,
        coverUrl: campaign.cover_image_url ?? (typeof window !== "undefined" ? `${window.location.origin}/sample.png` : "/sample.png"),
        qrSrc,
        campaignUrl,
      });
      setCardSrc(src);
    } finally {
      setCardLoading(false);
    }
  }, [qrSrc, campaign, campaignUrl]);

  // build card whenever tab or format changes (and QR is ready)
  const handleTabSocial = useCallback(() => {
    setTab("social");
    if (qrSrc) void buildCard(cardFormat);
  }, [qrSrc, buildCard, cardFormat]);

  const handleFormat = useCallback((fmt: CardFormat) => {
    setCardFormat(fmt);
    if (qrSrc) void buildCard(fmt);
  }, [qrSrc, buildCard]);

  const downloadCard = useCallback(() => {
    if (!cardSrc) return;
    const a = document.createElement("a");
    a.href = cardSrc;
    a.download = `${campaign.slug}-${cardFormat}.png`;
    a.click();
  }, [cardSrc, campaign.slug, cardFormat]);

  const copyCard = useCallback(async () => {
    if (!cardSrc) return;
    try {
      const res = await fetch(cardSrc);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCardCopied(true);
      setTimeout(() => setCardCopied(false), 2000);
    } catch {
      // clipboard image API not available in all browsers — fall back to download
      downloadCard();
    }
  }, [cardSrc, downloadCard]);

  const downloadQR = useCallback(() => {
    if (!qrSrc) return;
    const a = document.createElement("a");
    a.href = qrSrc;
    a.download = `${campaign.slug}-qr.png`;
    a.click();
  }, [qrSrc, campaign.slug]);

  const TAB_STYLE = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: "8px 0", borderRadius: 8, border: "none",
    background: active ? "rgba(29,197,255,0.12)" : "transparent",
    color: active ? BLUE : "#8899aa",
    fontSize: 13, fontWeight: 700, cursor: "pointer",
    borderBottom: active ? `2px solid ${BLUE}` : "2px solid transparent",
    transition: "all 0.15s",
  });

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "16px", overflowY: "auto",
    }} onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#0d1120", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 22, padding: "26px 22px", width: "100%", maxWidth: 460,
          boxShadow: "0 40px 120px rgba(0,0,0,0.7)",
          margin: "auto",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: "rgba(29,197,255,0.1)", border: "1px solid rgba(29,197,255,0.18)",
              display: "flex", alignItems: "center", justifyContent: "center", color: BLUE,
            }}><IconShare /></div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#f0f6ff" }}>Share Campaign</div>
              <div style={{ fontSize: 12, color: "#4a5568", marginTop: 1, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{campaign.title}</div>
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.04)", color: "#8899aa", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}><IconClose /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 4, marginBottom: 20 }}>
          <button style={TAB_STYLE(tab === "links")} onClick={() => setTab("links")}>Links & QR</button>
          <button style={TAB_STYLE(tab === "social")} onClick={handleTabSocial}>Social Card</button>
        </div>

        {/* ── Tab: Links & QR ── */}
        {tab === "links" && (
          <>
            {/* QR Code */}
            <div style={{
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 14, padding: 18, textAlign: "center", marginBottom: 16,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#4a5568", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 12 }}>
                Campaign QR Code
              </div>
              {qrLoading ? (
                <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 28, height: 28, border: `2px solid ${BLUE}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                </div>
              ) : qrSrc ? (
                <>
                  <div style={{ display: "inline-block", padding: 10, background: "#fff", borderRadius: 10 }}>
                    <Image src={qrSrc} alt="Campaign QR" width={148} height={148} unoptimized style={{ display: "block" }} />
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <button onClick={downloadQR} style={{
                      padding: "7px 18px", borderRadius: 8, border: "none",
                      background: `linear-gradient(135deg, ${BLUE}, #079bd4)`,
                      color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
                    }}>Download QR</button>
                  </div>
                </>
              ) : (
                <div style={{ height: 148, display: "flex", alignItems: "center", justifyContent: "center", color: "#4a5568", fontSize: 13 }}>
                  QR unavailable
                </div>
              )}
            </div>

            {/* Copy links */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { label: "Campaign page", url: campaignUrl, key: "page" },
                { label: "Direct donate link", url: donateUrl, key: "donate" },
              ].map(({ label, url, key }) => (
                <div key={key} style={{
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 10, padding: "10px 14px",
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: "#4a5568", fontWeight: 600, marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 12, color: "#8899aa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{url}</div>
                  </div>
                  <button
                    onClick={() => void copy(url, key)}
                    style={{
                      flexShrink: 0, padding: "6px 12px", borderRadius: 7,
                      border: `1px solid ${copied === key ? "rgba(27,191,136,0.3)" : "rgba(255,255,255,0.1)"}`,
                      background: copied === key ? "rgba(27,191,136,0.1)" : "rgba(255,255,255,0.04)",
                      color: copied === key ? GREEN : "#8899aa",
                      fontSize: 12, fontWeight: 600, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 5,
                    }}
                  >
                    {copied === key ? <><IconCheck /> Copied</> : <><IconCopy /> Copy</>}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Tab: Social Card ── */}
        {tab === "social" && (
          <>
            {/* Format picker */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {CARD_FORMATS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => handleFormat(f.key)}
                  style={{
                    flex: 1, padding: "10px 6px", borderRadius: 10, cursor: "pointer",
                    border: `1px solid ${cardFormat === f.key ? "rgba(29,197,255,0.4)" : "rgba(255,255,255,0.08)"}`,
                    background: cardFormat === f.key ? "rgba(29,197,255,0.1)" : "rgba(255,255,255,0.03)",
                    color: cardFormat === f.key ? BLUE : "#8899aa",
                    textAlign: "center" as const,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{f.label}</div>
                  <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{f.sub}</div>
                </button>
              ))}
            </div>

            {/* Card preview */}
            <div style={{
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 14, padding: 16, marginBottom: 16,
              display: "flex", alignItems: "center", justifyContent: "center",
              minHeight: 200,
            }}>
              {!qrSrc ? (
                <div style={{ color: "#4a5568", fontSize: 13, textAlign: "center" }}>
                  <div style={{ marginBottom: 8 }}>QR code loading…</div>
                  <div style={{ width: 24, height: 24, border: `2px solid ${BLUE}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
                </div>
              ) : cardLoading ? (
                <div style={{ textAlign: "center" }}>
                  <div style={{ width: 28, height: 28, border: `2px solid ${BLUE}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 10px" }} />
                  <div style={{ color: "#4a5568", fontSize: 13 }}>Generating card…</div>
                </div>
              ) : cardSrc ? (
                <div style={{ width: "100%", position: "relative" }}>
                  {/* aspect-ratio wrapper so tall story cards don't overflow */}
                  <div style={{
                    width: "100%",
                    aspectRatio: cardFormat === "story" ? "9/16" : cardFormat === "wide" ? "1200/630" : "1/1",
                    maxHeight: 300,
                    position: "relative", overflow: "hidden", borderRadius: 8,
                  }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={cardSrc} alt="Social card preview" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: "center" }}>
                  <button
                    onClick={() => void buildCard(cardFormat)}
                    style={{
                      padding: "10px 22px", borderRadius: 9, border: "none",
                      background: `linear-gradient(135deg, ${BLUE}, #079bd4)`,
                      color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
                    }}
                  >Generate Card</button>
                </div>
              )}
            </div>

            {/* Action buttons */}
            {cardSrc && (
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={downloadCard}
                  style={{
                    flex: 1, padding: "11px 0", borderRadius: 10, border: "none",
                    background: `linear-gradient(135deg, ${BLUE}, #079bd4)`,
                    color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
                    boxShadow: "0 4px 16px rgba(29,197,255,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Download
                </button>
                <button
                  onClick={() => void copyCard()}
                  style={{
                    flex: 1, padding: "11px 0", borderRadius: 10,
                    border: `1px solid ${cardCopied ? "rgba(27,191,136,0.35)" : "rgba(255,255,255,0.12)"}`,
                    background: cardCopied ? "rgba(27,191,136,0.1)" : "rgba(255,255,255,0.04)",
                    color: cardCopied ? GREEN : "#8899aa",
                    fontSize: 13, fontWeight: 700, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  }}
                >
                  {cardCopied ? <><IconCheck /> Copied!</> : <><IconCopy /> Copy image</>}
                </button>
              </div>
            )}

            {cardSrc && (
              <div style={{ marginTop: 12, fontSize: 11, color: "#4a5568", textAlign: "center", lineHeight: 1.6 }}>
                Download and share on WhatsApp Status, Instagram Stories, or any social platform.
                {" "}Copy image pastes directly into WhatsApp or Telegram on supported browsers.
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}

function ReportModal({
  campaign,
  onClose,
}: {
  campaign: CampaignDiscoveryItem;
  onClose: () => void;
}) {
  const submitReport = useSubmitModerationReport();
  const [reason, setReason] = useState<"SCAM" | "INAPPROPRIATE_CONTENT" | "HATE_SPEECH" | "FALSE_INFORMATION" | "HARASSMENT" | "SPAM" | "OTHER">("SCAM");
  const [description, setDescription] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!description.trim()) {
      setToast("Please add a short explanation.");
      return;
    }

    try {
      await submitReport.mutateAsync({
        reportedEntityType: "CAMPAIGN",
        reportedEntityId: campaign.id,
        campaignId: campaign.id,
        reason,
        description,
      });
      setToast("Report submitted");
      setTimeout(onClose, 700);
    } catch {
      setToast("Unable to submit report");
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 22, padding: 24, width: "100%", maxWidth: 500, boxShadow: "0 40px 120px rgba(0,0,0,0.7)" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#f0f6ff" }}>Report Campaign</div>
            <div style={{ fontSize: 12, color: "#4a5568", marginTop: 2, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{campaign.title}</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#8899aa", cursor: "pointer" }}>×</button>
        </div>

        {toast && <div style={{ marginBottom: 12, color: "#f0f6ff", background: "rgba(29,197,255,0.08)", border: "1px solid rgba(29,197,255,0.18)", borderRadius: 10, padding: "10px 12px", fontSize: 13 }}>{toast}</div>}

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#8899aa", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Reason</label>
          <select value={reason} onChange={(e) => setReason(e.target.value as typeof reason)} style={{ width: "100%", padding: "11px 14px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#f0f6ff", fontSize: 13, outline: "none" }}>
            <option value="SCAM">Scam</option>
            <option value="INAPPROPRIATE_CONTENT">Inappropriate content</option>
            <option value="HATE_SPEECH">Hate speech</option>
            <option value="FALSE_INFORMATION">False information</option>
            <option value="HARASSMENT">Harassment</option>
            <option value="SPAM">Spam</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#8899aa", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Tell us what looks wrong…" style={{ width: "100%", padding: "11px 14px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#f0f6ff", fontSize: 13, resize: "vertical", outline: "none", boxSizing: "border-box" }} />
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => void handleSubmit()} disabled={submitReport.isPending} style={{ padding: "10px 18px", borderRadius: 9, border: "none", background: `linear-gradient(135deg, ${BLUE}, #079bd4)`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{submitReport.isPending ? "Submitting…" : "Submit report"}</button>
          <button onClick={onClose} style={{ padding: "10px 18px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#8899aa", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
        </div>
      </motion.div>
    </div>
  );
}

export default function CampaignDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const { data: session } = useSessionProfile(true);
  const isLoggedIn = Boolean(session?.id);
  const [showShare, setShowShare] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);

  const openImage = async (img: PublicCampaignImage) => {
    try {
      const q = new URLSearchParams({ url: img.url });
      const res = await fetch(`/api/backend/media/presign?${q.toString()}`);
      if (!res.ok) throw new Error("presign failed");
      const body = await res.json();
      setViewerSrc(body.url);
    } catch {
      setViewerSrc(img.url);
    }
  };

  const { data: campaign, isLoading, error } = useQuery({
    queryKey: ["campaign-detail", slug],
    enabled: Boolean(slug),
    queryFn: async () => {
      const response = await api.get<CampaignDiscoveryItem>(`/campaigns/${slug}`);
      return response.data;
    },
  });

  const { data: reviews = [], isLoading: reviewsLoading } = usePublicCampaignReviews(slug, Boolean(slug));
  const { data: images = [], isLoading: imagesLoading } = usePublicCampaignImages(slug, Boolean(slug));
  const { data: goals = [] } = useCampaignGoals(slug, Boolean(slug));
  const { data: proofs = [], isLoading: proofsLoading } = useCampaignProofs(slug, Boolean(slug));
  const { data: updates = [], isLoading: updatesLoading } = useCampaignUpdates(slug, Boolean(slug));

  const progress = campaign?.target_amount
    ? Math.min((campaign.amount_raised / campaign.target_amount) * 100, 100)
    : 0;

  const reviewSummary = useMemo(() => {
    if (reviews.length === 0) return { average: 0, count: 0 };
    const total = reviews.reduce((sum, r) => sum + r.rating, 0);
    return { average: total / reviews.length, count: reviews.length };
  }, [reviews]);

  if (isLoading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 44, height: 44, border: `3px solid ${BLUE}`, borderTopColor: "transparent",
            borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 14px" }} />
          <p style={{ color: "#8899aa", fontSize: 14 }}>Loading campaign...</p>
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>😕</div>
          <h2 style={{ color: "#f0f6ff", marginBottom: 8 }}>Campaign not found</h2>
          <p style={{ color: "#8899aa", marginBottom: 24 }}>This campaign may have been removed or the link is incorrect.</p>
          <Link href="/campaigns">
            <button style={{
              padding: "10px 20px", borderRadius: 10, border: "none",
              background: `linear-gradient(135deg, ${BLUE}, #079bd4)`,
              color: "#fff", fontWeight: 600, cursor: "pointer",
            }}>Browse All Campaigns</button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px clamp(16px,4vw,48px) 80px" }}>
      {/* Back */}
      <Link href="/campaigns">
        <button style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "7px 14px", borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(255,255,255,0.04)",
          color: "#8899aa", fontSize: 13, cursor: "pointer", marginBottom: 28,
        }}>
          <IconArrowLeft /> Back to Campaigns
        </button>
      </Link>

      {/* Hero */}
      <motion.div {...fadeUp(0)} style={{ marginBottom: 28 }}>
        <div style={{
          borderRadius: 20, overflow: "hidden",
          background: "#0d1120",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
        }}>
          <div className="campaign-hero">
            {/* Cover */}
            <div className="campaign-cover">
              {/* Always show an image — real cover or sample fallback */}
              <Image
                src={campaign.cover_image_url ?? "/sample.png"}
                alt={campaign.title}
                fill
                unoptimized
                sizes="45vw"
                style={{ objectFit: "cover" }}
              />
              {/* Dark scrim so info panel text stays readable when bleeds */}
              <div style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(to right, transparent 70%, rgba(13,17,32,0.6) 100%)",
                pointerEvents: "none",
              }} />
              {!campaign.cover_image_url && (
                <div style={{
                  position: "absolute", bottom: 10, left: 10,
                  background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
                  borderRadius: 6, padding: "3px 8px",
                  fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)",
                  letterSpacing: "0.07em", textTransform: "uppercase" as const,
                  pointerEvents: "none",
                }}>Sample image</div>
              )}
            </div>

            {/* Info */}
            <div style={{ padding: "32px 28px", position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 0 }}>
              {/* Status chips + share button */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span style={{
                    padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: campaign.status === "ACTIVE" ? "rgba(27,191,136,0.15)" : "rgba(100,100,100,0.15)",
                    color: campaign.status === "ACTIVE" ? GREEN : "#8899aa",
                    border: `1px solid ${campaign.status === "ACTIVE" ? "rgba(27,191,136,0.25)" : "rgba(100,100,100,0.25)"}`,
                  }}>{campaign.status}</span>
                  <span style={{
                    padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: "rgba(29,197,255,0.1)", color: BLUE,
                    border: "1px solid rgba(29,197,255,0.2)",
                  }}>{campaign.mode}</span>
                </div>
                <button
                  onClick={() => setShowShare(true)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "7px 14px", borderRadius: 8,
                    border: "1px solid rgba(29,197,255,0.25)",
                    background: "rgba(29,197,255,0.08)",
                    color: BLUE, fontSize: 13, fontWeight: 600, cursor: "pointer",
                    transition: "background 0.2s",
                  }}
                >
                  <IconShare /> Share <span style={{ color: "rgba(29,197,255,0.5)" }}>/ QR</span>
                </button>
                <button
                  onClick={() => setShowReport(true)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "7px 14px", borderRadius: 8,
                    border: "1px solid rgba(239,68,68,0.24)",
                    background: "rgba(239,68,68,0.08)",
                    color: RED, fontSize: 13, fontWeight: 600, cursor: "pointer",
                    transition: "background 0.2s",
                  }}
                >
                  <IconFlag /> Report
                </button>
              </div>

              <h1 style={{ fontSize: "clamp(20px,2.8vw,30px)", fontWeight: 800, color: "#f0f6ff",
                lineHeight: 1.2, letterSpacing: "-0.03em", marginBottom: 10 }}>
                {campaign.title}
              </h1>

              <p style={{ color: "#8899aa", fontSize: 14, lineHeight: 1.75, marginBottom: 24 }}>
                {campaign.description}
              </p>

              {/* Progress block */}
              <div style={{
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12, padding: "18px 20px", marginBottom: 18,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, alignItems: "baseline" }}>
                  <div>
                    <span style={{ fontSize: "clamp(20px,2.5vw,26px)", fontWeight: 800, color: "#f0f6ff" }}>
                      {campaign.amount_raised.toLocaleString()}
                    </span>
                    <span style={{ color: "#8899aa", fontSize: 13, marginLeft: 5 }}>GMD raised</span>
                  </div>
                  {campaign.target_amount && (
                    <span style={{ fontSize: 18, fontWeight: 700, color: BLUE }}>
                      {Math.round(progress)}%
                    </span>
                  )}
                </div>
                <AppProgress percent={progress} showInfo={false} strokeColor={BLUE}
                  trailColor="rgba(255,255,255,0.08)" />
                {campaign.target_amount && (
                  <div style={{ fontSize: 12, color: "#4a5568", marginTop: 6 }}>
                    Goal: {campaign.target_amount.toLocaleString()} GMD
                  </div>
                )}
              </div>

              <Link href={`/quick-pay/${campaign.slug}`} style={{ display: "block" }}>
                <button style={{
                  width: "100%", padding: "13px 20px", borderRadius: 11, border: "none",
                  background: `linear-gradient(135deg, ${BLUE}, #079bd4)`,
                  color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
                  boxShadow: "0 6px 24px rgba(29,197,255,0.35)",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                  Donate with Wave <IconArrowRight />
                </button>
              </Link>

              {reviewSummary.count > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center", marginTop: 10 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="#fbbf24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  <span style={{ color: "#8899aa", fontSize: 13 }}>
                    {reviewSummary.average.toFixed(1)} · {reviewSummary.count} review{reviewSummary.count !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Body grid */}
      <div className="campaign-body">
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>

          {/* Gallery */}
          <motion.div {...fadeUp(0.1)}>
            <div style={{
              background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 16, padding: "22px 22px 26px",
            }}>
              <SectionHeader icon={<IconPicture />} title="Campaign Gallery" />
              {imagesLoading ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px,1fr))", gap: 8 }}>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} style={{ aspectRatio: "4/3", borderRadius: 8, background: "rgba(255,255,255,0.04)" }} />
                  ))}
                </div>
              ) : images.length > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px,1fr))", gap: 8 }}>
                  {images.map((img: PublicCampaignImage, i) => (
                    <div key={i} style={{ display: "block", cursor: "zoom-in" }} onClick={() => openImage(img)}>
                      <div style={{ position: "relative", aspectRatio: "4/3", borderRadius: 8, overflow: "hidden",
                        border: "1px solid rgba(255,255,255,0.07)" }}>
                        <Image src={img.url} alt={img.original_name ?? img.file_name} fill unoptimized
                          sizes="200px" style={{ objectFit: "cover" }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "28px 16px", color: "#4a5568" }}>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 8, opacity: 0.5 }}><IconPicture /></div>
                  <p style={{ fontSize: 13 }}>No photos uploaded yet</p>
                </div>
              )}
            </div>
          </motion.div>

          {viewerSrc && <MediaViewer src={viewerSrc} onClose={() => setViewerSrc(null)} />}

          {/* Proof */}
          <motion.div {...fadeUp(0.15)}>
            <div style={{
              background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 16, padding: "22px 22px 26px",
            }}>
              <SectionHeader icon={<IconDoc />} title="Proof of Expenditure" />
              {proofsLoading ? (
                <p style={{ color: "#8899aa", fontSize: 14 }}>Loading...</p>
              ) : proofs.length > 0 ? (
                <ProofList proofs={proofs} />
              ) : (
                <div style={{ textAlign: "center", padding: "28px 16px", color: "#4a5568" }}>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 8, opacity: 0.5 }}><IconDoc /></div>
                  <p style={{ fontSize: 13 }}>No proof documents uploaded yet</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Campaign Updates */}
          <motion.div {...fadeUp(0.18)}>
            <div style={{
              background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 16, padding: "22px 22px 26px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 9,
                  background: "rgba(29,197,255,0.1)", border: "1px solid rgba(29,197,255,0.18)",
                  display: "flex", alignItems: "center", justifyContent: "center", color: BLUE,
                }}>
                  <IconBell />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#f0f6ff", margin: 0 }}>Campaign Updates</h3>
                {!updatesLoading && (
                  <span style={{
                    padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: "rgba(29,197,255,0.1)", color: BLUE,
                    border: "1px solid rgba(29,197,255,0.2)",
                  }}>{updates.length}</span>
                )}
              </div>

              {updatesLoading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[1, 2].map((i) => (
                    <div key={i} style={{ borderRadius: 11, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", padding: 16, height: 88 }} />
                  ))}
                </div>
              ) : updates.length === 0 ? (
                <div style={{ textAlign: "center", padding: "28px 16px", color: "#4a5568" }}>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 8, opacity: 0.4 }}><IconBell /></div>
                  <p style={{ fontSize: 13 }}>The campaigner hasn&apos;t posted any updates yet</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {updates.map((update: CampaignUpdate) => (
                    <div key={update.id} style={{
                      padding: 16, borderRadius: 11,
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.07)",
                    }}>
                      {/* Author + date */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                          background: `linear-gradient(135deg, ${BLUE}, #079bd4)`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, fontWeight: 700, color: "#fff",
                        }}>
                          {(update.author_name ?? "U")[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#f0f6ff" }}>
                            {update.author_name ?? "Campaign owner"}
                          </div>
                          <div style={{ fontSize: 11, color: "#4a5568" }}>
                            {new Date(update.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </div>
                        </div>
                      </div>

                      {/* Title */}
                      {update.title && (
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#f0f6ff", marginBottom: 6 }}>
                          {update.title}
                        </div>
                      )}

                      {/* Body */}
                      <p style={{ color: "#8899aa", fontSize: 13, lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap",
                        marginBottom: update.attachments.length > 0 ? 12 : 0 }}>
                        {update.text}
                      </p>

                      {/* Attachments row */}
                      {update.attachments.length > 0 && (
                        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                          {update.attachments.map((att) => (
                            <div
                              key={att.id}
                              onClick={() => setViewerSrc(att.file_url)}
                              style={{
                                flexShrink: 0, width: 100, height: 80, borderRadius: 8,
                                overflow: "hidden", cursor: "zoom-in",
                                border: "1px solid rgba(255,255,255,0.07)",
                                background: "rgba(255,255,255,0.04)",
                                position: "relative",
                              }}
                            >
                              <Image
                                src={att.file_url}
                                alt={att.file_name ?? "attachment"}
                                fill
                                unoptimized
                                sizes="100px"
                                style={{ objectFit: "cover" }}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          {/* Goals */}
          {goals.length > 0 && (
            <motion.div {...fadeUp(0.2)}>
              <div style={{
                background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 16, padding: "22px 22px 26px",
              }}>
                <SectionHeader icon={<span style={{ fontSize: 16 }}>🎯</span>} title="Campaign Goals" />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px,1fr))", gap: 12 }}>
                  {goals.map((goal: CampaignGoal) => {
                    const pct = Math.min((goal.amount_raised / goal.target_amount) * 100, 100);
                    return (
                      <div key={goal.id} style={{
                        padding: 16, borderRadius: 11,
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.07)",
                      }}>
                        <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#fbbf24",
                            background: "rgba(251,191,36,0.1)", padding: "2px 8px", borderRadius: 6 }}>
                            {goal.status}
                          </span>
                          {goal.due_date && (
                            <span style={{ fontSize: 11, color: "#4a5568" }}>
                              Due {new Date(goal.due_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "#f0f6ff", marginBottom: 4 }}>{goal.title}</div>
                        {goal.description && <p style={{ fontSize: 12, color: "#8899aa", marginBottom: 10 }}>{goal.description}</p>}
                        <AppProgress percent={Math.round(pct)} showInfo={false} strokeColor={BLUE} trailColor="rgba(255,255,255,0.08)" size="small" />
                        <div style={{ fontSize: 11, color: "#8899aa", marginTop: 5 }}>
                          {goal.amount_raised.toLocaleString()} / {goal.target_amount.toLocaleString()} GMD
                        </div>
                        {goal.status === "ACTIVE" && (
                          <Link href={`/quick-pay/${campaign.slug}?goalId=${goal.id}`}>
                            <button style={{
                              width: "100%", marginTop: 10, padding: "7px 12px", borderRadius: 8,
                              border: "none", background: `linear-gradient(135deg, ${BLUE}, #079bd4)`,
                              color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer",
                            }}>Fund this goal</button>
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* Reviews */}
          <motion.div {...fadeUp(0.25)}>
            <div style={{
              background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 16, padding: "22px 22px 26px",
            }}>
              <SectionHeader icon={<IconStar />} title="Donor Reviews" />
              {reviewsLoading ? (
                <p style={{ color: "#8899aa", fontSize: 14 }}>Loading reviews...</p>
              ) : reviews.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {reviews.map((r: CampaignReview) => (
                    <div key={r.id} style={{
                      padding: 16, borderRadius: 11,
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.07)",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 30, height: 30, borderRadius: "50%",
                            background: `linear-gradient(135deg, ${BLUE}, #079bd4)`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 12, fontWeight: 700, color: "#fff" }}>
                            {(r.donor_name ?? "A")[0].toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 600, color: "#f0f6ff", fontSize: 13 }}>
                            {r.donor_name ?? "Anonymous"}
                          </span>
                        </div>
                        <StarRow rating={r.rating} />
                      </div>
                      <p style={{ color: "#8899aa", fontSize: 13, lineHeight: 1.6 }}>{r.comment}</p>
                      <p style={{ color: "#4a5568", fontSize: 11, marginTop: 6 }}>
                        {new Date(r.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "24px 16px", color: "#4a5568" }}>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 8, opacity: 0.4 }}><IconStar /></div>
                  <p style={{ fontSize: 13 }}>No reviews yet — be the first!</p>
                </div>
              )}

              {isLoggedIn && slug ? (
                <div style={{ marginTop: 20, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontWeight: 600, color: "#f0f6ff", marginBottom: 12, fontSize: 14 }}>Leave a Review</div>
                  <ReviewForm slug={slug} />
                </div>
              ) : (
                <div style={{
                  marginTop: 18, padding: 16, borderRadius: 10,
                  background: "rgba(29,197,255,0.04)", border: "1px solid rgba(29,197,255,0.14)",
                  display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10,
                }}>
                  <p style={{ color: "#8899aa", fontSize: 13 }}>Login to leave a review</p>
                  <Link href="/auth/login">
                    <button style={{
                      padding: "7px 14px", borderRadius: 8, border: "none",
                      background: `linear-gradient(135deg, ${BLUE}, #079bd4)`,
                      color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer",
                    }}>Login</button>
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Right sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 88 }}>
          {/* Donate CTA */}
          <div style={{
            background: "#0d1120", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16, padding: 22,
          }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#f0f6ff", marginBottom: 14 }}>
              Support this campaign
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: "clamp(20px,2.5vw,26px)", fontWeight: 800, color: "#f0f6ff" }}>
                {campaign.amount_raised.toLocaleString()} GMD
              </div>
              <div style={{ fontSize: 12, color: "#8899aa" }}>raised so far</div>
            </div>
            <AppProgress percent={Math.round(progress)} showInfo={false}
              strokeColor={BLUE} trailColor="rgba(255,255,255,0.08)" />
            {campaign.target_amount && (
              <div style={{ fontSize: 12, color: "#4a5568", marginTop: 6, marginBottom: 18 }}>
                {Math.round(progress)}% of {campaign.target_amount.toLocaleString()} GMD goal
              </div>
            )}
            <Link href={`/quick-pay/${campaign.slug}`} style={{ display: "block" }}>
              <button style={{
                width: "100%", padding: "13px 20px", borderRadius: 11, border: "none",
                background: `linear-gradient(135deg, ${BLUE}, #079bd4)`,
                color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
                boxShadow: "0 6px 24px rgba(29,197,255,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
                Donate with Wave <IconArrowRight />
              </button>
            </Link>

            {/* Share / QR button in sidebar too */}
            <button
              onClick={() => setShowShare(true)}
              style={{
                width: "100%", marginTop: 10, padding: "9px 14px", borderRadius: 9,
                border: "1px solid rgba(29,197,255,0.2)",
                background: "rgba(29,197,255,0.06)",
                color: BLUE, fontSize: 13, fontWeight: 600, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              }}
            >
              <IconQR /> Share & QR Code
            </button>

            <button
              onClick={() => setShowReport(true)}
              style={{
                width: "100%", marginTop: 10, padding: "9px 14px", borderRadius: 9,
                border: "1px solid rgba(239,68,68,0.24)",
                background: "rgba(239,68,68,0.08)",
                color: RED, fontSize: 13, fontWeight: 600, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              }}
            >
              <IconFlag /> Report Campaign
            </button>
          </div>

          {/* Trust */}
          <div style={{
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 16, padding: 18,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#4a5568", marginBottom: 12, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>
              Trust & Safety
            </div>
            {[
              { icon: "✅", label: "Payments via Wave (secure)" },
              { icon: "🔐", label: "KYC-verified campaigner" },
              { icon: "📄", label: `${proofs.length} proof document${proofs.length !== 1 ? "s" : ""} uploaded` },
              { icon: "⭐", label: `${reviewSummary.count} donor review${reviewSummary.count !== 1 ? "s" : ""}` },
            ].map(({ icon, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
                <span style={{ fontSize: 14 }}>{icon}</span>
                <span style={{ fontSize: 12, color: "#8899aa" }}>{label}</span>
              </div>
            ))}
          </div>

          {!isLoggedIn && (
            <div style={{
              background: "rgba(29,197,255,0.04)",
              border: "1px solid rgba(29,197,255,0.14)",
              borderRadius: 16, padding: 18, textAlign: "center",
            }}>
              <p style={{ color: "#8899aa", fontSize: 13, marginBottom: 12, lineHeight: 1.6 }}>
                Create an account to track donations and receive updates
              </p>
              <Link href="/auth/signup">
                <button style={{
                  width: "100%", padding: "9px 14px", borderRadius: 9, border: "none",
                  background: `linear-gradient(135deg, ${BLUE}, #079bd4)`,
                  color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}>Create Free Account</button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Share modal */}
      {showShare && campaign && (
        <ShareModal campaign={campaign} onClose={() => setShowShare(false)} />
      )}

      {/* Report modal */}
      {showReport && campaign && (
        <ReportModal campaign={campaign} onClose={() => setShowReport(false)} />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }

        .campaign-hero {
          display: flex;
          flex-wrap: wrap;
        }
        .campaign-cover {
          flex: 0 0 clamp(260px, 42%, 500px);
          min-height: 320px;
          position: relative;
        }
        .campaign-body {
          display: grid;
          grid-template-columns: 1fr min(320px, 32%);
          gap: 22px;
          align-items: start;
        }

        @media (max-width: 768px) {
          .campaign-hero { flex-direction: column; }
          .campaign-cover {
            flex: none;
            width: 100%;
            min-height: 220px;
          }
          .campaign-body {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
