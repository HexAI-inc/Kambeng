"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { useMyCampaigns } from "@/hooks/use-frontend-data";

const BLUE = "#1dc5ff";
const GREEN = "#1bbf88";

function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.38, delay, ease: "easeOut" as const },
  };
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    ACTIVE:    { color: GREEN,     bg: "rgba(27,191,136,0.12)" },
    DRAFT:     { color: "#fbbf24", bg: "rgba(251,191,36,0.10)" },
    PAUSED:    { color: "#8899aa", bg: "rgba(255,255,255,0.06)" },
    COMPLETED: { color: BLUE,      bg: "rgba(29,197,255,0.10)" },
    REJECTED:  { color: "#ef4444", bg: "rgba(239,68,68,0.10)" },
  };
  const s = map[status] ?? map.PAUSED;
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const,
      padding: "2px 8px", borderRadius: 20, color: s.color, background: s.bg,
    }}>{status}</span>
  );
}

function ModeChip({ mode }: { mode: string }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const,
      padding: "2px 8px", borderRadius: 20,
      color: "#8899aa", background: "rgba(255,255,255,0.05)",
    }}>{mode}</span>
  );
}

function fmt(n: number) {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K`
    : n.toLocaleString();
}

export default function MyCampaignsPage() {
  const { data: campaigns, isLoading, isError } = useMyCampaigns(true);

  const totalRaised = (campaigns ?? []).reduce((s, c) => s + c.amount_raised, 0);
  const activeCnt = (campaigns ?? []).filter((c) => c.status === "ACTIVE").length;

  return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", padding: "28px clamp(16px, 4vw, 48px)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Header */}
        <motion.div {...fadeUp(0)} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.03em", marginBottom: 4 }}>My Campaigns</div>
            <div style={{ fontSize: 13, color: "#6b7a8d" }}>Manage images, proofs, goals, and QR codes for each campaign.</div>
          </div>
          <Link href="/campaigns">
            <button style={{
              padding: "9px 18px", borderRadius: 9, border: "none",
              background: `linear-gradient(135deg, ${BLUE}, #079bd4)`,
              color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
              boxShadow: "0 4px 14px rgba(29,197,255,0.3)",
            }}>Browse campaigns</button>
          </Link>
        </motion.div>

        {/* Error */}
        {isError && (
          <div style={{
            padding: "12px 16px", borderRadius: 10,
            background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)",
            fontSize: 13, color: "#fca5a5",
          }}>
            Unable to load your campaigns. Try refreshing.
          </div>
        )}

        {/* Summary strip */}
        {!isLoading && campaigns && campaigns.length > 0 && (
          <motion.div {...fadeUp(0.06)} style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 14, overflow: "hidden",
          }}>
            {[
              { label: "Total raised", value: `${fmt(totalRaised)} GMD`, color: GREEN },
              { label: "Campaigns", value: String(campaigns.length), color: "#f0f6ff" },
              { label: "Active", value: String(activeCnt), color: BLUE },
            ].map(({ label, value, color }, i, arr) => (
              <div key={label} style={{
                padding: "14px 20px",
                borderRight: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
              }}>
                <div style={{ fontSize: 10, color: "#4a5568", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const, marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color, letterSpacing: "-0.03em" }}>{value}</div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Campaign list */}
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ height: 130, borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }} />
            ))}
          </div>
        ) : campaigns && campaigns.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {campaigns.map((c, idx) => {
              const pct = c.target_amount && c.target_amount > 0
                ? Math.min(100, Math.round((c.amount_raised / c.target_amount) * 100))
                : null;
              return (
                <motion.div key={c.id} {...fadeUp(0.04 * idx)} style={{
                  background: "#0d1120",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 14, overflow: "hidden",
                  transition: "border-color 0.2s",
                }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(29,197,255,0.18)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.07)"; }}
                >
                  <div style={{ display: "flex", gap: 0 }}>
                    {/* Thumbnail strip */}
                    <div style={{ width: 100, minHeight: 130, flexShrink: 0, position: "relative", background: "#1a2333" }}>
                      {c.cover_image_url ? (
                        <Image src={c.cover_image_url} alt={c.title} fill unoptimized sizes="100px" style={{ objectFit: "cover" }} />
                      ) : (
                        <div style={{
                          width: "100%", height: "100%", minHeight: 130,
                          background: "linear-gradient(135deg, #0d2340, #0a3d5c)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 28, fontWeight: 800, color: BLUE,
                        }}>
                          {c.title.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <StatusChip status={c.status} />
                        <ModeChip mode={c.mode} />
                        <span style={{ fontSize: 11, color: "#4a5568" }}>/{c.slug}</span>
                      </div>

                      <div style={{ fontSize: 16, fontWeight: 800, color: "#f0f6ff", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                        {c.title}
                      </div>

                      <div style={{ fontSize: 12, color: "#6b7a8d", lineHeight: 1.6, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
                        {c.description}
                      </div>

                      {/* Progress */}
                      <div>
                        <div style={{ height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 99, overflow: "hidden", marginBottom: 4 }}>
                          <div style={{
                            height: "100%", width: `${pct ?? 0}%`,
                            background: `linear-gradient(90deg, ${BLUE}, #079bd4)`, borderRadius: 99,
                          }} />
                        </div>
                        <div style={{ fontSize: 11, color: "#4a5568" }}>
                          <span style={{ color: GREEN, fontWeight: 700 }}>{fmt(c.amount_raised)} GMD</span>
                          {c.target_amount ? ` raised · ${pct}% of ${fmt(c.target_amount)} GMD goal` : " raised · no target set"}
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
                        {[
                          { label: "Uploads", href: `/dashboard/my-campaigns/${c.id}/images`, primary: true },
                          { label: "Goals", href: `/dashboard/my-campaigns/${c.id}/goals`, primary: false },
                          { label: "QR Codes", href: `/dashboard/my-campaigns/${c.id}/qr-codes`, primary: false },
                          { label: "Public page", href: `/campaigns/${c.slug}`, primary: false },
                        ].map(({ label, href, primary }) => (
                          <Link key={label} href={href}>
                            <button style={{
                              padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                              border: primary ? "none" : "1px solid rgba(255,255,255,0.1)",
                              background: primary ? `linear-gradient(135deg, ${BLUE}, #079bd4)` : "rgba(255,255,255,0.04)",
                              color: primary ? "#fff" : "#8899aa",
                              boxShadow: primary ? "0 2px 10px rgba(29,197,255,0.25)" : "none",
                            }}>
                              {label}
                            </button>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <motion.div {...fadeUp(0.08)} style={{
            padding: "52px 28px", textAlign: "center",
            background: "linear-gradient(135deg, rgba(29,197,255,0.03), rgba(7,155,212,0.01))",
            border: "1px dashed rgba(29,197,255,0.18)", borderRadius: 16,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14, margin: "0 auto 16px",
              background: "rgba(29,197,255,0.08)", border: "1px solid rgba(29,197,255,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke={BLUE} strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#f0f6ff", marginBottom: 6 }}>No campaigns yet</div>
            <div style={{ fontSize: 13, color: "#6b7a8d", marginBottom: 24, maxWidth: 340, margin: "0 auto 24px" }}>
              Campaigns are created by the admin on your behalf. Contact support to get started.
            </div>
            <Link href="/campaigns">
              <button style={{
                padding: "11px 24px", borderRadius: 10, border: "none",
                background: `linear-gradient(135deg, ${BLUE}, #079bd4)`,
                color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
                boxShadow: "0 4px 16px rgba(29,197,255,0.3)",
              }}>Browse campaigns</button>
            </Link>
          </motion.div>
        )}
      </div>
    </div>
  );
}
