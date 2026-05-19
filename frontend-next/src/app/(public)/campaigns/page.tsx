"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SearchOutlined, FireOutlined, HeartOutlined, AlertOutlined, AppstoreOutlined } from "@ant-design/icons";
import { usePublicCampaignDiscovery } from "@/hooks/use-frontend-data";

type BrowseFilter = "all" | "schools" | "health" | "emergency";

const FILTERS: Array<{ value: BrowseFilter; label: string; icon: React.ReactNode; keywords?: string[] }> = [
  { value: "all", label: "All", icon: <AppstoreOutlined /> },
  { value: "schools", label: "Education", icon: <FireOutlined />, keywords: ["school", "education", "classroom", "student"] },
  { value: "health", label: "Health", icon: <HeartOutlined />, keywords: ["health", "clinic", "medical", "hospital"] },
  { value: "emergency", label: "Emergency", icon: <AlertOutlined />, keywords: ["flood", "relief", "emergency", "disaster"] },
];

function matchesFilter(
  item: { title: string; slug: string; description: string; mode: string },
  filter: BrowseFilter,
) {
  if (filter === "all") return true;
  const keywords = FILTERS.find((e) => e.value === filter)?.keywords ?? [];
  const haystack = [item.title, item.slug, item.description, item.mode].join(" ").toLowerCase();
  return keywords.some((kw) => haystack.includes(kw));
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
      <div style={{
        height: "100%",
        width: `${pct}%`,
        background: pct >= 100
          ? "linear-gradient(90deg, #1bbf88, #0fa870)"
          : "linear-gradient(90deg, #1dc5ff, #079bd4)",
        borderRadius: 2,
        transition: "width 0.6s ease",
      }} />
    </div>
  );
}

function CampaignSkeleton() {
  return (
    <div style={{
      background: "#111827",
      borderRadius: 16,
      overflow: "hidden",
      border: "1px solid rgba(255,255,255,0.06)",
    }}>
      <div style={{ height: 200, background: "rgba(255,255,255,0.04)" }} />
      <div style={{ padding: 20 }}>
        <div style={{ height: 12, width: "40%", background: "rgba(255,255,255,0.06)", borderRadius: 6, marginBottom: 12 }} />
        <div style={{ height: 18, width: "80%", background: "rgba(255,255,255,0.06)", borderRadius: 6, marginBottom: 8 }} />
        <div style={{ height: 14, width: "60%", background: "rgba(255,255,255,0.04)", borderRadius: 6, marginBottom: 16 }} />
        <div style={{ height: 4, background: "rgba(255,255,255,0.04)", borderRadius: 2, marginBottom: 12 }} />
        <div style={{ height: 36, background: "rgba(255,255,255,0.04)", borderRadius: 10 }} />
      </div>
    </div>
  );
}

function CampaignCard({ campaign, index }: { campaign: ReturnType<typeof usePublicCampaignDiscovery>["data"] extends Array<infer T> | undefined ? T : never; index: number }) {
  const pct = campaign.target_amount && campaign.target_amount > 0
    ? Math.min(100, (campaign.amount_raised / campaign.target_amount) * 100)
    : 0;
  const funded = pct >= 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
      whileHover={{ y: -4 }}
      style={{
        background: "#111827",
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.06)",
        transition: "box-shadow 0.3s ease, border-color 0.3s ease",
        cursor: "pointer",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(29,197,255,0.3)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 12px 40px rgba(29,197,255,0.12)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.06)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
      }}
    >
      {/* Cover */}
      <div style={{ position: "relative", height: 200, flexShrink: 0, overflow: "hidden", background: "#1a2333" }}>
        {campaign.cover_image_url ? (
          <Image
            src={campaign.cover_image_url}
            alt={campaign.title}
            fill
            unoptimized
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            style={{ objectFit: "cover" }}
          />
        ) : (
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(135deg, #0d2340 0%, #1a2333 50%, #0d2340 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{ fontSize: 48, opacity: 0.15 }}>🇬🇲</div>
          </div>
        )}
        {/* Status badge */}
        <div style={{
          position: "absolute", top: 12, left: 12,
          padding: "4px 10px",
          borderRadius: 20,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          background: campaign.status === "ACTIVE"
            ? "rgba(27,191,136,0.9)"
            : "rgba(255,255,255,0.12)",
          color: campaign.status === "ACTIVE" ? "#fff" : "#8899aa",
          backdropFilter: "blur(8px)",
        }}>
          {campaign.status}
        </div>
        {funded && (
          <div style={{
            position: "absolute", top: 12, right: 12,
            padding: "4px 10px",
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 700,
            background: "rgba(251,191,36,0.9)",
            color: "#000",
            backdropFilter: "blur(8px)",
          }}>
            GOAL MET
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", flex: 1, gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            fontSize: 11, fontWeight: 600, color: "#1dc5ff",
            background: "rgba(29,197,255,0.1)",
            padding: "2px 8px", borderRadius: 4,
            textTransform: "uppercase", letterSpacing: "0.05em",
          }}>
            {campaign.mode}
          </span>
        </div>

        <h3 style={{
          margin: 0, fontSize: 16, fontWeight: 700,
          color: "#f0f6ff", lineHeight: 1.3,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>
          {campaign.title}
        </h3>

        <p style={{
          margin: 0, fontSize: 13, color: "#8899aa", lineHeight: 1.6,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          flex: 1,
        }}>
          {campaign.description}
        </p>

        {/* Progress */}
        <div style={{ marginTop: 4 }}>
          <ProgressBar value={campaign.amount_raised} max={campaign.target_amount ?? 0} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: funded ? "#1bbf88" : "#1dc5ff" }}>
              {campaign.amount_raised.toLocaleString()} GMD
            </span>
            <span style={{ fontSize: 12, color: "#4a5568" }}>
              of {(campaign.target_amount ?? 0).toLocaleString()} GMD
            </span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <Link href={`/campaigns/${campaign.slug}`} style={{ flex: 1 }}>
            <button style={{
              width: "100%",
              padding: "9px 0",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "transparent",
              color: "#f0f6ff",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(29,197,255,0.4)"; e.currentTarget.style.color = "#1dc5ff"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "#f0f6ff"; }}
            >
              View Story
            </button>
          </Link>
          <Link href={`/quick-pay/${campaign.slug}`} style={{ flex: 1 }}>
            <button style={{
              width: "100%",
              padding: "9px 0",
              borderRadius: 10,
              border: "none",
              background: "linear-gradient(135deg, #1dc5ff, #079bd4)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(29,197,255,0.25)",
              transition: "opacity 0.2s",
            }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
            >
              Donate
            </button>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

export default function CampaignDiscoveryPage() {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<BrowseFilter>("all");
  const { data, isLoading } = usePublicCampaignDiscovery();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter((item) => {
      const matchesQuery =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.slug.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q);
      return matchesQuery && matchesFilter(item, activeFilter);
    });
  }, [activeFilter, data, query]);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1a" }}>
      {/* Hero header */}
      <div style={{
        padding: "60px clamp(16px, 4vw, 48px) 0",
        maxWidth: 1200,
        margin: "0 auto",
      }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "6px 14px",
            borderRadius: 20,
            border: "1px solid rgba(29,197,255,0.2)",
            background: "rgba(29,197,255,0.06)",
            marginBottom: 20,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#1dc5ff", display: "inline-block" }} />
            <span style={{ fontSize: 12, color: "#1dc5ff", fontWeight: 600, letterSpacing: "0.05em" }}>
              {data?.length ?? 0} campaigns live
            </span>
          </div>

          <h1 style={{
            fontSize: "clamp(28px, 4vw, 44px)",
            fontWeight: 800,
            color: "#f0f6ff",
            lineHeight: 1.15,
            margin: "0 0 12px",
          }}>
            Fund what matters<br />
            <span style={{ color: "#1dc5ff" }}>in The Gambia</span>
          </h1>
          <p style={{ fontSize: 17, color: "#8899aa", margin: "0 0 40px", maxWidth: 520, lineHeight: 1.7 }}>
            Every campaign shows real proof — photos, receipts, and updates so you know exactly where your money goes.
          </p>
        </motion.div>

        {/* Search + filters */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 48 }}>
          <div style={{ position: "relative", maxWidth: 560 }}>
            <SearchOutlined style={{
              position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
              color: "#4a5568", fontSize: 16, zIndex: 1,
            }} />
            <input
              type="text"
              placeholder="Search campaigns..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "13px 16px 13px 46px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.05)",
                color: "#f0f6ff",
                fontSize: 15,
                outline: "none",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => { e.target.style.borderColor = "rgba(29,197,255,0.4)"; }}
              onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; }}
            />
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setActiveFilter(f.value)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 16px",
                  borderRadius: 20,
                  border: activeFilter === f.value ? "1px solid rgba(29,197,255,0.4)" : "1px solid rgba(255,255,255,0.08)",
                  background: activeFilter === f.value ? "rgba(29,197,255,0.1)" : "rgba(255,255,255,0.04)",
                  color: activeFilter === f.value ? "#1dc5ff" : "#8899aa",
                  fontSize: 13,
                  fontWeight: activeFilter === f.value ? 600 : 400,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {f.icon}
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Campaign grid */}
      <div style={{
        padding: "0 clamp(16px, 4vw, 48px) 80px",
        maxWidth: 1200,
        margin: "0 auto",
      }}>
        {/* Result count */}
        <div style={{ marginBottom: 24, color: "#4a5568", fontSize: 13 }}>
          {isLoading ? "Loading campaigns..." : `${filtered.length} campaign${filtered.length !== 1 ? "s" : ""} found`}
        </div>

        {isLoading ? (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 24,
          }}>
            {Array.from({ length: 6 }).map((_, i) => <CampaignSkeleton key={i} />)}
          </div>
        ) : filtered.length > 0 ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeFilter + query}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: 24,
              }}
            >
              {filtered.map((campaign, i) => (
                <CampaignCard key={campaign.id} campaign={campaign} index={i} />
              ))}
            </motion.div>
          </AnimatePresence>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              textAlign: "center",
              padding: "80px 20px",
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>🔍</div>
            <h3 style={{ color: "#f0f6ff", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              No campaigns found
            </h3>
            <p style={{ color: "#8899aa", fontSize: 15 }}>
              Try a different keyword or browse all campaigns.
            </p>
            <button
              onClick={() => { setQuery(""); setActiveFilter("all"); }}
              style={{
                marginTop: 20,
                padding: "10px 24px",
                borderRadius: 10,
                border: "1px solid rgba(29,197,255,0.3)",
                background: "rgba(29,197,255,0.08)",
                color: "#1dc5ff",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Clear filters
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
