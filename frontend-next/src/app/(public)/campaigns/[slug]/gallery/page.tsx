"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { usePublicCampaignImages } from "@/hooks/use-frontend-data";
import MediaViewer from "@/components/ui/MediaViewer";
import type { CampaignDiscoveryItem, PublicCampaignImage } from "@/types/frontend";

const BLUE = "#1dc5ff";

function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.38, delay, ease: "easeOut" as const },
  };
}

export default function CampaignGalleryPage() {
  const params = useParams();
  const slug = typeof params.slug === "string" ? params.slug : null;

  const [viewerSrc, setViewerSrc] = useState<string | null>(null);

  const { data: campaign, isLoading: campaignLoading } = useQuery({
    queryKey: ["campaign-detail", slug],
    enabled: Boolean(slug),
    queryFn: async () => {
      const res = await api.get<CampaignDiscoveryItem>(`/campaigns/${slug}`);
      return res.data;
    },
  });

  const { data: images = [], isLoading: imagesLoading } = usePublicCampaignImages(
    slug ?? undefined,
    Boolean(slug)
  );

  const openImage = async (img: PublicCampaignImage) => {
    try {
      const q = new URLSearchParams({ url: img.url });
      const res = await fetch(`/api/backend/media/presign?${q.toString()}`);
      if (!res.ok) throw new Error("presign failed");
      const body = (await res.json()) as { url: string };
      setViewerSrc(body.url);
    } catch {
      setViewerSrc(img.url);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1a", paddingBottom: 60 }}>
      {/* Header bar */}
      <div style={{
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(13,17,32,0.95)", backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 50,
        padding: "0 20px",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", gap: 16, height: 56 }}>
          <Link
            href={slug ? `/campaigns/${slug}` : "/"}
            style={{ display: "flex", alignItems: "center", gap: 6, color: "#8899aa", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to campaign
          </Link>
          <span style={{ color: "rgba(255,255,255,0.15)" }}>|</span>
          <span style={{ fontSize: 13, color: "#f0f6ff", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {campaignLoading ? "Loading…" : campaign?.title ?? "Campaign Gallery"}
          </span>
          {!imagesLoading && images.length > 0 && (
            <span style={{ marginLeft: "auto", fontSize: 12, color: "#4a5568", fontWeight: 600 }}>
              {images.length} photo{images.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px 0" }}>
        {imagesLoading ? (
          <motion.div {...fadeUp(0)}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  style={{ aspectRatio: "4/3", borderRadius: 12, background: "rgba(255,255,255,0.04)",
                    animation: "pulse 1.5s ease-in-out infinite", animationDelay: `${i * 0.07}s` }}
                />
              ))}
            </div>
          </motion.div>
        ) : images.length === 0 ? (
          <motion.div {...fadeUp(0)} style={{ textAlign: "center", padding: "80px 20px" }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 16px" }}>
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
            </svg>
            <p style={{ fontSize: 15, color: "#4a5568", fontWeight: 600 }}>No photos yet</p>
            <p style={{ fontSize: 13, color: "#2d3748", marginTop: 6 }}>The campaign owner hasn&apos;t uploaded any gallery photos yet.</p>
            <Link
              href={slug ? `/campaigns/${slug}` : "/"}
              style={{ display: "inline-block", marginTop: 20, color: BLUE, fontSize: 13, fontWeight: 700 }}
            >
              ← Back to campaign
            </Link>
          </motion.div>
        ) : (
          <motion.div {...fadeUp(0)}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 12,
            }}>
              {images.map((img, i) => (
                <motion.div
                  key={img.file_name}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.4) }}
                >
                  <div
                    onClick={() => void openImage(img)}
                    style={{
                      position: "relative", aspectRatio: "4/3", borderRadius: 12,
                      overflow: "hidden", cursor: "zoom-in",
                      border: "1px solid rgba(255,255,255,0.07)",
                      background: "rgba(255,255,255,0.03)",
                      transition: "transform 0.2s, box-shadow 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.transform = "scale(1.02)";
                      (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 32px rgba(0,0,0,0.5)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.transform = "scale(1)";
                      (e.currentTarget as HTMLElement).style.boxShadow = "none";
                    }}
                  >
                    <Image
                      src={img.url}
                      alt={img.original_name ?? img.file_name}
                      fill
                      unoptimized
                      sizes="(max-width: 640px) 50vw, (max-width: 1100px) 33vw, 220px"
                      style={{ objectFit: "cover" }}
                    />
                    {/* Hover overlay */}
                    <div style={{
                      position: "absolute", inset: 0,
                      background: "rgba(29,197,255,0.0)",
                      transition: "background 0.2s",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(29,197,255,0.08)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(29,197,255,0)"; }}
                    >
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0)"
                        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                        style={{ transition: "stroke 0.2s" }}
                      >
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
                      </svg>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {viewerSrc && <MediaViewer src={viewerSrc} onClose={() => setViewerSrc(null)} />}
    </div>
  );
}
