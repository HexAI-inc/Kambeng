"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { AppstoreOutlined, SearchOutlined } from "@ant-design/icons";
import { usePopularCampaignTags, usePublicCampaignDiscovery } from "@/hooks/use-frontend-data";
import { CAMPAIGN_CATEGORIES, getCampaignCategory, normalizeTag } from "@/lib/campaign-categories";
import { OrganizationBadge } from "@/components/campaigns/organization-badge";

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "8px 16px",
        borderRadius: 20,
        border: active ? "1px solid rgba(20,120,74,0.4)" : "1px solid rgba(21,32,26,0.08)",
        background: active ? "rgba(20,120,74,0.1)" : "rgba(21,32,26,0.04)",
        color: active ? "#14784a" : "#56625b",
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        cursor: "pointer",
        transition: "all 0.2s",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ height: 4, background: "rgba(21,32,26,0.08)", borderRadius: 2, overflow: "hidden" }}>
      <div style={{
        height: "100%",
        width: `${pct}%`,
        background: pct >= 100
          ? "linear-gradient(90deg, #1f9960, #0fa870)"
          : "linear-gradient(90deg, #14784a, #0f5e3a)",
        borderRadius: 2,
        transition: "width 0.6s ease",
      }} />
    </div>
  );
}

function CampaignSkeleton() {
  return (
    <div style={{
      background: "#ffffff",
      borderRadius: 16,
      overflow: "hidden",
      border: "1px solid rgba(21,32,26,0.06)",
    }}>
      <div style={{ height: 200, background: "#fff" }} />
      <div style={{ padding: 20 }}>
        <div style={{ height: 12, width: "40%", background: "rgba(21,32,26,0.06)", borderRadius: 6, marginBottom: 12 }} />
        <div style={{ height: 18, width: "80%", background: "rgba(21,32,26,0.06)", borderRadius: 6, marginBottom: 8 }} />
        <div style={{ height: 14, width: "60%", background: "rgba(21,32,26,0.04)", borderRadius: 6, marginBottom: 16 }} />
        <div style={{ height: 4, background: "rgba(21,32,26,0.04)", borderRadius: 2, marginBottom: 12 }} />
        <div style={{ height: 36, background: "rgba(21,32,26,0.04)", borderRadius: 10 }} />
      </div>
    </div>
  );
}

function CampaignCard({ campaign, index, onTagClick }: { campaign: ReturnType<typeof usePublicCampaignDiscovery>["data"] extends Array<infer T> | undefined ? T : never; index: number; onTagClick: (tag: string) => void }) {
  const category = getCampaignCategory(campaign.category);
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
        background: "#ffffff",
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid rgba(21,32,26,0.06)",
        transition: "box-shadow 0.3s ease, border-color 0.3s ease",
        cursor: "pointer",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(20,120,74,0.3)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 12px 40px rgba(20,120,74,0.12)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(21,32,26,0.06)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
      }}
    >
      {/* Cover */}
      <div className="campaign-cover" style={{ position: "relative", height: 200, flexShrink: 0, overflow: "hidden", background: "#f1eee7" }}>
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
            background: "linear-gradient(135deg, #e6f4ec 0%, #cfe8da 50%, #eef6f1 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: "#e8f2ed",
              border: "1px solid rgba(20,120,74,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24, fontWeight: 900, color: "#14784a",
            }}>
              {campaign.title.charAt(0).toUpperCase()}
            </div>
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
            ? "rgba(31,153,96,0.9)"
            : "rgba(21,32,26,0.12)",
          color: campaign.status === "ACTIVE" ? "#fff" : "#56625b",
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
            background: "rgba(217,135,11,0.9)",
            color: "#000",
            backdropFilter: "blur(8px)",
          }}>
            GOAL MET
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", flex: 1, gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {category && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontSize: 11, fontWeight: 600, color: "#14784a",
              background: "#e8f2ed",
              padding: "2px 8px", borderRadius: 4,
              textTransform: "uppercase", letterSpacing: "0.05em",
            }}>
              <category.icon style={{ fontSize: 11 }} />
              {category.label}
            </span>
          )}
          <span style={{
            fontSize: 11, fontWeight: 600, color: "#56625b",
            background: "rgba(21,32,26,0.05)",
            padding: "2px 8px", borderRadius: 4,
            textTransform: "uppercase", letterSpacing: "0.05em",
          }}>
            {campaign.mode}
          </span>
        </div>

        <h3 style={{
          margin: 0, fontSize: 16, fontWeight: 700,
          color: "#15201a", lineHeight: 1.3,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>
          {campaign.title}
        </h3>

        {campaign.organization && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: -4 }}>
            <span style={{ fontSize: 12, color: "#56625b", fontWeight: 600 }}>{campaign.organization.name}</span>
            <OrganizationBadge verified={campaign.organization.is_verified} size="sm" />
          </div>
        )}

        <p style={{
          margin: 0, fontSize: 13, color: "#56625b", lineHeight: 1.6,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          flex: 1,
        }}>
          {campaign.description}
        </p>

        {campaign.tags && campaign.tags.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {campaign.tags.slice(0, 3).map((tag) => (
              <button
                key={tag}
                onClick={() => onTagClick(tag)}
                style={{
                  padding: 0, border: "none", background: "none", cursor: "pointer",
                  fontSize: 12, color: "#14784a", fontWeight: 500,
                }}
              >
                #{tag}
              </button>
            ))}
            {campaign.tags.length > 3 && (
              <span style={{ fontSize: 12, color: "#6e7872" }}>+{campaign.tags.length - 3}</span>
            )}
          </div>
        )}

        {/* Progress */}
        <div style={{ marginTop: 4 }}>
          <ProgressBar value={campaign.amount_raised} max={campaign.target_amount ?? 0} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: funded ? "#1f9960" : "#14784a" }}>
              {campaign.amount_raised.toLocaleString()} GMD
            </span>
            <span style={{ fontSize: 12, color: "#6e7872" }}>
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
              border: "1px solid rgba(21,32,26,0.12)",
              background: "transparent",
              color: "#15201a",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(20,120,74,0.4)"; e.currentTarget.style.color = "#14784a"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(21,32,26,0.12)"; e.currentTarget.style.color = "#15201a"; }}
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
              background: "#14784a",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(20,120,74,0.25)",
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
  return (
    <Suspense>
      <CampaignDiscovery />
    </Suspense>
  );
}

function CampaignDiscovery() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const { data, isLoading } = usePublicCampaignDiscovery();
  const { data: popularTags } = usePopularCampaignTags(12);

  // Category and tag live in the URL so filtered views can be shared and
  // campaign pages can link straight to them (/campaigns?tag=brikama).
  const activeCategory = searchParams.get("category");
  const rawTag = searchParams.get("tag");
  const activeTag = rawTag ? normalizeTag(rawTag) : null;

  const setFilters = (next: { category?: string | null; tag?: string | null }) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of data ?? []) {
      if (item.category) counts[item.category] = (counts[item.category] ?? 0) + 1;
    }
    return counts;
  }, [data]);

  // Show categories that have campaigns (plus the active one), so the row
  // stays short on phones.
  const visibleCategories = CAMPAIGN_CATEGORIES.filter(
    (c) => categoryCounts[c.value] || c.value === activeCategory,
  );

  // Keep the active tag visible even when it isn't one of the popular ones.
  const tagChips = useMemo(() => {
    const tags = (popularTags ?? []).map((t) => t.tag);
    return activeTag && !tags.includes(activeTag) ? [activeTag, ...tags] : tags;
  }, [activeTag, popularTags]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter((item) => {
      const matchesQuery =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.slug.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        (item.tags ?? []).some((t) => t.includes(q));
      const matchesCategory = !activeCategory || item.category === activeCategory;
      const matchesTag = !activeTag || (item.tags ?? []).includes(activeTag);
      return matchesQuery && matchesCategory && matchesTag;
    });
  }, [activeCategory, activeTag, data, query]);

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Hero header */}
      <div className="campaigns-hero" style={{
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
            border: "1px solid rgba(20,120,74,0.2)",
            background: "#f1f7f4",
            marginBottom: 20,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#14784a", display: "inline-block" }} />
            <span style={{ fontSize: 12, color: "#14784a", fontWeight: 600, letterSpacing: "0.05em" }}>
              {data?.length ?? 0} campaigns live
            </span>
          </div>

          <h1 style={{
            fontSize: "clamp(28px, 4vw, 44px)",
            fontWeight: 800,
            color: "#15201a",
            lineHeight: 1.15,
            margin: "0 0 12px",
          }}>
            Fund what matters<br />
            <span style={{ color: "#14784a" }}>in The Gambia</span>
          </h1>
          <p style={{ fontSize: 17, color: "#56625b", margin: "0 0 40px", maxWidth: 520, lineHeight: 1.7 }}>
            Every campaign shows real proof — photos, receipts, and updates so you know exactly where your money goes.
          </p>
        </motion.div>

        {/* Search + filters */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 48 }}>
          <div style={{ position: "relative", maxWidth: 560 }}>
            <SearchOutlined style={{
              position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
              color: "#6e7872", fontSize: 15, zIndex: 1, lineHeight: 1,
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
                border: "1px solid rgba(21,32,26,0.1)",
                background: "#fff",
                color: "#15201a",
                fontSize: 15,
                outline: "none",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => { e.target.style.borderColor = "rgba(20,120,74,0.4)"; }}
              onBlur={(e) => { e.target.style.borderColor = "rgba(21,32,26,0.1)"; }}
            />
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <FilterChip active={!activeCategory} onClick={() => setFilters({ category: null })}>
              <AppstoreOutlined style={{ fontSize: 13 }} />
              All
            </FilterChip>
            {visibleCategories.map((c) => (
              <FilterChip
                key={c.value}
                active={activeCategory === c.value}
                onClick={() => setFilters({ category: activeCategory === c.value ? null : c.value })}
              >
                <c.icon style={{ fontSize: 13 }} />
                {c.label}
                <span style={{ fontSize: 11, opacity: 0.7 }}>{categoryCounts[c.value] ?? 0}</span>
              </FilterChip>
            ))}
          </div>

          {tagChips.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#6e7872", marginRight: 4 }}>Popular tags</span>
              {tagChips.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setFilters({ tag: activeTag === tag ? null : tag })}
                  aria-pressed={activeTag === tag}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 14,
                    border: activeTag === tag ? "1px solid rgba(20,120,74,0.4)" : "1px solid transparent",
                    background: activeTag === tag ? "rgba(20,120,74,0.1)" : "transparent",
                    color: activeTag === tag ? "#14784a" : "#56625b",
                    fontSize: 12,
                    fontWeight: activeTag === tag ? 600 : 400,
                    cursor: "pointer",
                  }}
                >
                  #{tag}{activeTag === tag ? " ×" : ""}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Campaign grid */}
      <div className="campaigns-grid-wrap" style={{
        padding: "0 clamp(16px, 4vw, 48px) 80px",
        maxWidth: 1200,
        margin: "0 auto",
      }}>
        {/* Result count */}
        <div style={{ marginBottom: 24, color: "#6e7872", fontSize: 13 }}>
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
              key={`${activeCategory}|${activeTag}|${query}`}
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
                <CampaignCard key={campaign.id} campaign={campaign} index={i} onTagClick={(tag) => setFilters({ tag })} />
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
            <SearchOutlined style={{ fontSize: 48, marginBottom: 16, opacity: 0.4, color: "#6e7872", display: "block" }} />
            <h3 style={{ color: "#15201a", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              No campaigns found
            </h3>
            <p style={{ color: "#56625b", fontSize: 15 }}>
              Try a different keyword or browse all campaigns.
            </p>
            <button
              onClick={() => { setQuery(""); setFilters({ category: null, tag: null }); }}
              style={{
                marginTop: 20,
                padding: "10px 24px",
                borderRadius: 10,
                border: "1px solid rgba(20,120,74,0.3)",
                background: "#ecf4f1",
                color: "#14784a",
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

      <style>{`
        @media (max-width: 640px) {
          .campaigns-hero { padding-top: 32px !important; }
          .campaigns-grid-wrap { padding-bottom: 48px !important; }
          .campaign-cover { height: 160px !important; }
        }
      `}</style>
    </div>
  );
}
