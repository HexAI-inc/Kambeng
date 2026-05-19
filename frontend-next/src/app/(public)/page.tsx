"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRightOutlined,
  ThunderboltOutlined,
  SafetyOutlined,
  CheckCircleFilled,
} from "@ant-design/icons";
import { useHomeFeed, useSessionProfile } from "@/hooks/use-frontend-data";

const BLUE = "#1dc5ff";

function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, delay, ease: "easeOut" as const },
  };
}


function TrustPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "6px 12px", borderRadius: 20,
      background: "rgba(255,255,255,0.05)",
      border: "1px solid rgba(255,255,255,0.1)",
      fontSize: 12, color: "#8899aa", fontWeight: 500,
    }}>
      {icon}
      {label}
    </div>
  );
}

function StatPill({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: "clamp(16px, 2vw, 22px)", fontWeight: 800, color: "#f0f6ff", lineHeight: 1, letterSpacing: "-0.03em" }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: "#8899aa", marginTop: 3, fontWeight: 500 }}>{label}</div>
    </div>
  );
}

function RingProgress({ pct, size = 88 }: { pct: number; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      {/* Track */}
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="rgba(255,255,255,0.08)" strokeWidth={8} />
      {/* Progress */}
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={BLUE} strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={`${circ}`}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ - dash }}
        transition={{ duration: 1.2, delay: 0.4, ease: "easeOut" }}
      />
    </svg>
  );
}

function FeaturedCampaignCard({ campaign }: {
  campaign: {
    id: number; title: string; slug: string; status: string; mode: string;
    amount_raised: number; target_amount: number | null; cover_image_url: string | null;
  }
}) {
  const pct = campaign.target_amount && campaign.target_amount > 0
    ? Math.min(100, (campaign.amount_raised / campaign.target_amount) * 100)
    : 0;
  const hasTarget = campaign.target_amount && campaign.target_amount > 0;

  return (
    <motion.div {...fadeUp(0.2)} style={{
      background: "#111827",
      borderRadius: 20,
      overflow: "hidden",
      border: "1px solid rgba(255,255,255,0.09)",
      boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
      maxWidth: 400,
      width: "100%",
    }}>
      {/* Cover — full bleed image OR rich gradient placeholder */}
      <div style={{ position: "relative", height: 170, flexShrink: 0, overflow: "hidden" }}>
        <Image
          src={campaign.cover_image_url ?? "/sample.png"}
          alt={campaign.title}
          fill unoptimized sizes="400px"
          style={{ objectFit: "cover", objectPosition: "center top" }}
        />
        {/* Gradient overlay — title reads on top of any image */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(10,15,26,0.85) 100%)",
        }} />
        {/* LIVE badge + title overlaid on image */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "12px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "3px 8px", borderRadius: 20,
              background: "rgba(27,191,136,0.2)", border: "1px solid rgba(27,191,136,0.35)",
            }}>
              <span style={{
                width: 5, height: 5, borderRadius: "50%",
                background: "#1bbf88", boxShadow: "0 0 5px #1bbf88", display: "inline-block",
              }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: "#1bbf88", letterSpacing: "0.06em" }}>LIVE</span>
            </div>
          </div>
          <h3 style={{
            margin: 0, fontSize: 16, fontWeight: 700,
            color: "#fff", lineHeight: 1.25,
            textShadow: "0 1px 8px rgba(0,0,0,0.6)",
          }}>
            {campaign.title}
          </h3>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "14px 18px 18px" }}>

        {/* Ring + numbers — compact horizontal */}
        <div style={{
          display: "flex", alignItems: "center", gap: 16,
          padding: "14px 16px",
          background: "rgba(255,255,255,0.03)",
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.06)",
          marginBottom: 14,
        }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <RingProgress pct={pct} size={72} />
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 800, color: BLUE,
            }}>
              {Math.round(pct)}%
            </div>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#f0f6ff", lineHeight: 1, letterSpacing: "-0.03em" }}>
              {campaign.amount_raised.toLocaleString()}
            </div>
            <div style={{ fontSize: 12, color: "#8899aa", marginTop: 2 }}>GMD raised</div>
            {hasTarget && (
              <div style={{ fontSize: 11, color: "#4a5568", marginTop: 4 }}>
                {(campaign.target_amount ?? 0).toLocaleString()} GMD goal
              </div>
            )}
          </div>
        </div>

        {/* Trust — one compact line */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          fontSize: 11, color: "#8899aa", marginBottom: 14,
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: 3, color: "#1bbf88" }}>
            <CheckCircleFilled style={{ fontSize: 10 }} />KYC Verified
          </span>
          <span style={{ opacity: 0.2 }}>·</span>
          <span>📸 Proof uploaded</span>
        </div>

        {/* Buttons — pill style, compact */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Link href={`/quick-pay/${campaign.slug}`}>
            <button style={{
              width: "100%", padding: "11px 0", borderRadius: 50, border: "none",
              background: `linear-gradient(135deg, ${BLUE}, #079bd4)`,
              color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
              boxShadow: "0 5px 18px rgba(29,197,255,0.28)",
            }}>
              Donate now
            </button>
          </Link>
          <Link href={`/campaigns/${campaign.slug}`}>
            <button style={{
              width: "100%", padding: "10px 0", borderRadius: 50,
              border: "1px solid rgba(255,255,255,0.11)",
              background: "rgba(255,255,255,0.04)",
              color: "#8899aa", fontSize: 13, fontWeight: 500, cursor: "pointer",
            }}>
              See the story →
            </button>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

function SmallCampaignCard({ campaign }: {
  campaign: {
    id: number; title: string; slug: string;
    amount_raised: number; target_amount: number | null; cover_image_url: string | null;
  }
}) {
  const pct = campaign.target_amount && campaign.target_amount > 0
    ? Math.min(100, Math.round((campaign.amount_raised / campaign.target_amount) * 100))
    : null;

  return (
    <Link href={`/campaigns/${campaign.slug}`}>
      <div style={{
        display: "flex", gap: 12, alignItems: "center",
        padding: "12px 14px",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 12, cursor: "pointer",
        transition: "border-color 0.2s, background 0.2s",
      }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(29,197,255,0.25)";
          (e.currentTarget as HTMLDivElement).style.background = "rgba(29,197,255,0.05)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.07)";
          (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)";
        }}
      >
        <div style={{
          width: 48, height: 48, borderRadius: 8, overflow: "hidden",
          flexShrink: 0, background: "#1a2333", position: "relative",
        }}>
          {campaign.cover_image_url ? (
            <Image src={campaign.cover_image_url} alt={campaign.title} fill unoptimized sizes="48px" style={{ objectFit: "cover" }} />
          ) : (
            <div style={{
              width: "100%", height: "100%",
              background: "linear-gradient(135deg, #0d2340, #0a3d5c)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, fontWeight: 800, color: BLUE,
            }}>
              {campaign.title.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 600, color: "#f0f6ff",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            marginBottom: 4,
          }}>
            {campaign.title}
          </div>
          <div style={{ height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${pct ?? 0}%`,
              background: `linear-gradient(90deg, ${BLUE}, #079bd4)`,
              borderRadius: 2,
            }} />
          </div>
          <div style={{ fontSize: 11, color: "#4a5568", marginTop: 3 }}>
            {campaign.amount_raised.toLocaleString()} GMD raised
          </div>
        </div>
        <ArrowRightOutlined style={{ color: "#4a5568", fontSize: 12, flexShrink: 0 }} />
      </div>
    </Link>
  );
}

export default function PublicHomePage() {
  const { data, isLoading } = useHomeFeed();
  const { data: session } = useSessionProfile(true);
  const isLoggedIn = Boolean(session?.id);

  const stats = data?.stats;
  const campaigns = data?.featured_campaigns ?? [];
  const featured = campaigns[0] ?? null;
  const otherCampaigns = campaigns.slice(1, 4);

  const fmt = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1000 ? `${(n / 1000).toFixed(0)}K`
    : String(n);

  return (
    <div style={{ background: "#0a0f1a" }}>

      {/* ── HERO ── */}
      <section style={{
        position: "relative", overflow: "hidden",
        minHeight: "calc(100vh - 68px)",
        display: "flex", alignItems: "center",
        padding: "32px clamp(16px, 5vw, 72px)",
      }}>
        {/* Background glows */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
          <div style={{
            position: "absolute", width: 700, height: 700,
            background: "radial-gradient(circle, rgba(29,197,255,0.12) 0%, transparent 70%)",
            left: "-15%", top: "-10%",
          }} />
          <div style={{
            position: "absolute", width: 500, height: 500,
            background: "radial-gradient(circle, rgba(7,155,212,0.08) 0%, transparent 70%)",
            right: "10%", bottom: "0%",
          }} />
          {/* Subtle grid */}
          <div style={{
            position: "absolute", inset: 0, opacity: 0.025,
            backgroundImage: `linear-gradient(rgba(29,197,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(29,197,255,1) 1px, transparent 1px)`,
            backgroundSize: "64px 64px",
          }} />
        </div>

        <div style={{ position: "relative", zIndex: 1, maxWidth: 1200, margin: "0 auto", width: "100%" }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "clamp(32px, 6vw, 80px)",
            flexWrap: "wrap",
          }}>

            {/* ── LEFT: Headline + trust + CTAs + stats ── */}
            <div style={{ flex: "1 1 420px", minWidth: 0 }}>

              {/* Wave badge */}
              <motion.div {...fadeUp(0)} style={{ marginBottom: 18 }}>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "5px 14px", borderRadius: 20,
                  background: "rgba(29,197,255,0.08)",
                  border: "1px solid rgba(29,197,255,0.2)",
                }}>
                  <ThunderboltOutlined style={{ color: BLUE, fontSize: 12 }} />
                  <span style={{ color: BLUE, fontSize: 12, fontWeight: 600 }}>Powered by Wave Mobile Money</span>
                </div>
              </motion.div>

              {/* Headline */}
              <motion.h1 {...fadeUp(0.08)} style={{
                fontSize: "clamp(34px, 5vw, 60px)",
                fontWeight: 900,
                lineHeight: 1.06,
                letterSpacing: "-0.04em",
                color: "#f0f6ff",
                margin: "0 0 14px",
              }}>
                Fund What<br />
                Matters in<br />
                <span style={{
                  color: BLUE,
                  textShadow: `0 0 40px rgba(29,197,255,0.4)`,
                }}>The Gambia</span>
              </motion.h1>

              <motion.p {...fadeUp(0.16)} style={{
                fontSize: "clamp(14px, 1.6vw, 16px)",
                color: "#8899aa", lineHeight: 1.7,
                maxWidth: 460, margin: "0 0 24px",
              }}>
                Launch a campaign, share your Wave QR code, and collect donations directly to your wallet.
                Every campaign shows photos and proof so donors know exactly where their money goes.
              </motion.p>

              {/* CTAs */}
              <motion.div {...fadeUp(0.22)} style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
                <Link href="/campaigns">
                  <button style={{
                    padding: "13px 26px", borderRadius: 12, border: "none",
                    background: `linear-gradient(135deg, ${BLUE}, #079bd4)`,
                    color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
                    boxShadow: "0 8px 28px rgba(29,197,255,0.35)",
                    display: "flex", alignItems: "center", gap: 8,
                    transition: "opacity 0.2s",
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.88"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
                  >
                    Browse Campaigns <ArrowRightOutlined />
                  </button>
                </Link>
                <Link href={isLoggedIn ? "/dashboard" : "/auth/signup"}>
                  <button style={{
                    padding: "13px 26px", borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.14)",
                    background: "rgba(255,255,255,0.05)",
                    color: "#f0f6ff", fontSize: 15, fontWeight: 600, cursor: "pointer",
                    transition: "border-color 0.2s, background 0.2s",
                  }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "rgba(29,197,255,0.3)";
                      e.currentTarget.style.background = "rgba(29,197,255,0.05)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)";
                      e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                    }}
                  >
                    {isLoggedIn ? "My Dashboard" : "Start a Campaign"}
                  </button>
                </Link>
              </motion.div>

              {/* Trust pills */}
              <motion.div {...fadeUp(0.28)} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
                <TrustPill icon={<SafetyOutlined style={{ color: "#1bbf88", fontSize: 12 }} />} label="KYC Verified Campaigners" />
                <TrustPill icon={<span style={{ fontSize: 12 }}>📸</span>} label="Proof of Expenditure" />
                <TrustPill icon={<span style={{ fontSize: 12 }}>⭐</span>} label="Donor Reviews" />
              </motion.div>

              {/* Live stats */}
              <motion.div {...fadeUp(0.34)}>
                <div style={{ fontSize: 11, color: "#4a5568", fontWeight: 600, letterSpacing: "0.08em", marginBottom: 16, textTransform: "uppercase" }}>
                  Platform stats
                </div>
                <div style={{
                  display: "flex", gap: 0,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 14,
                  overflow: "hidden",
                }}>
                  {[
                    { v: isLoading ? "—" : `${fmt(stats?.total_raised ?? 0)} GMD`, l: "Total Raised" },
                    { v: isLoading ? "—" : String(stats?.active_campaigns ?? 0), l: "Live Campaigns" },
                    { v: isLoading ? "—" : String(stats?.successful_donations ?? 0), l: "Donations" },
                  ].map(({ v, l }, i, arr) => (
                    <div key={l} style={{
                      flex: 1, padding: "12px 12px", textAlign: "center",
                      borderRight: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                    }}>
                      <StatPill value={v} label={l} />
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* ── RIGHT: Featured campaign + others ── */}
            <div style={{ flex: "0 1 420px", display: "flex", flexDirection: "column", gap: 16, minWidth: 300 }}>
              {/* Featured card */}
              {isLoading ? (
                <div style={{
                  background: "#111827", borderRadius: 20, overflow: "hidden",
                  border: "1px solid rgba(255,255,255,0.06)", maxWidth: 420, width: "100%",
                }}>
                  <div style={{ height: 240, background: "rgba(255,255,255,0.04)", animation: "shimmer 1.5s infinite" }} />
                  <div style={{ padding: 22 }}>
                    {[80, 60, 100].map((w) => (
                      <div key={w} style={{ height: 14, width: `${w}%`, background: "rgba(255,255,255,0.05)", borderRadius: 6, marginBottom: 12 }} />
                    ))}
                    <div style={{ height: 44, background: "rgba(255,255,255,0.05)", borderRadius: 10 }} />
                  </div>
                </div>
              ) : featured ? (
                <FeaturedCampaignCard campaign={featured} />
              ) : null}

              {/* Other campaigns mini list */}
              {otherCampaigns.length > 0 && !isLoading && (
                <motion.div {...fadeUp(0.35)} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 11, color: "#4a5568", fontWeight: 600, letterSpacing: "0.08em", marginBottom: 4, textTransform: "uppercase" }}>
                    More campaigns
                  </div>
                  {otherCampaigns.map((c) => (
                    <SmallCampaignCard key={c.id} campaign={c} />
                  ))}
                  <Link href="/campaigns" style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    padding: "10px",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 10, fontSize: 13, color: "#8899aa", fontWeight: 500,
                    transition: "color 0.2s",
                  }}>
                    View all campaigns <ArrowRightOutlined style={{ fontSize: 11 }} />
                  </Link>
                </motion.div>
              )}
            </div>

          </div>
        </div>
      </section>

      {/* ── TRUST SECTION ── */}
      <section style={{
        padding: "80px clamp(16px, 5vw, 72px)",
        borderTop: "1px solid rgba(255,255,255,0.05)",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <div style={{
              display: "inline-block",
              padding: "5px 14px", borderRadius: 20,
              background: "rgba(29,197,255,0.07)",
              border: "1px solid rgba(29,197,255,0.15)",
              fontSize: 12, color: BLUE, fontWeight: 600, letterSpacing: "0.06em",
              textTransform: "uppercase", marginBottom: 16,
            }}>
              Built on trust
            </div>
            <h2 style={{
              fontSize: "clamp(26px, 4vw, 40px)",
              fontWeight: 800, color: "#f0f6ff",
              margin: "0 0 14px", letterSpacing: "-0.03em",
            }}>
              Donors know exactly where<br />their money goes
            </h2>
            <p style={{ color: "#8899aa", fontSize: 16, maxWidth: 520, margin: "0 auto", lineHeight: 1.7 }}>
              Every campaign on Kambeng comes with photos, receipts, and verified identity — because trust is everything.
            </p>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 20,
          }}>
            {[
              {
                icon: "🪪",
                color: "rgba(27,191,136,0.1)",
                border: "rgba(27,191,136,0.2)",
                iconColor: "#1bbf88",
                title: "KYC Verified Identity",
                desc: "Every campaigner submits ID and is verified before they can receive or withdraw money. No anonymous accounts.",
              },
              {
                icon: "📸",
                color: "rgba(29,197,255,0.08)",
                border: "rgba(29,197,255,0.15)",
                iconColor: BLUE,
                title: "Photo & Receipt Proof",
                desc: "Campaigners upload photos and receipts showing exactly how donations were spent. Visible to all donors.",
              },
              {
                icon: "⚡",
                color: "rgba(251,191,36,0.08)",
                border: "rgba(251,191,36,0.15)",
                iconColor: "#fbbf24",
                title: "Wave Mobile Money",
                desc: "Payments go directly to the campaigner's Wave wallet — no intermediary, no delay, no hidden fees.",
              },
              {
                icon: "⭐",
                color: "rgba(168,85,247,0.08)",
                border: "rgba(168,85,247,0.15)",
                iconColor: "#a855f7",
                title: "Public Donor Reviews",
                desc: "Donors leave public ratings and feedback on every campaign. A transparent track record, permanently visible.",
              },
            ].map(({ icon, color, border, iconColor, title, desc }) => (
              <div key={title} style={{
                padding: "28px 24px",
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 16,
                transition: "border-color 0.3s, background 0.3s",
              }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = border;
                  (e.currentTarget as HTMLDivElement).style.background = color;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.07)";
                  (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.02)";
                }}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: color, border: `1px solid ${border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22, marginBottom: 16,
                }}>{icon}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#f0f6ff", marginBottom: 10 }}>{title}</div>
                <div style={{ fontSize: 14, color: "#8899aa", lineHeight: 1.7 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section style={{ padding: "0 clamp(16px, 5vw, 72px) 80px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{
            position: "relative", overflow: "hidden",
            background: "linear-gradient(135deg, rgba(29,197,255,0.1) 0%, rgba(7,155,212,0.06) 100%)",
            border: "1px solid rgba(29,197,255,0.18)",
            borderRadius: 24, padding: "60px clamp(24px, 5vw, 72px)",
          }}>
            <div style={{
              position: "absolute", width: 400, height: 400,
              background: "radial-gradient(circle, rgba(29,197,255,0.15) 0%, transparent 70%)",
              left: "-10%", top: "-50%", pointerEvents: "none",
            }} />
            <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 32 }}>
              <div>
                <h2 style={{
                  fontSize: "clamp(24px, 3.5vw, 40px)",
                  fontWeight: 800, color: "#f0f6ff",
                  margin: "0 0 12px", letterSpacing: "-0.03em",
                }}>
                  Ready to make a difference?
                </h2>
                <p style={{ color: "#8899aa", fontSize: 16, margin: 0, lineHeight: 1.7, maxWidth: 480 }}>
                  Join Gambians using Kambeng to fund schools, health projects, and community causes — transparently.
                </p>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", flexShrink: 0 }}>
                <Link href="/auth/signup">
                  <button style={{
                    padding: "13px 28px", borderRadius: 12, border: "none",
                    background: `linear-gradient(135deg, ${BLUE}, #079bd4)`,
                    color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
                    boxShadow: "0 8px 28px rgba(29,197,255,0.35)",
                  }}>Start a Campaign</button>
                </Link>
                <Link href="/campaigns">
                  <button style={{
                    padding: "13px 28px", borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "rgba(255,255,255,0.06)",
                    color: "#f0f6ff", fontSize: 15, fontWeight: 600, cursor: "pointer",
                  }}>Browse Campaigns</button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <style>{`
        @keyframes shimmer {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
