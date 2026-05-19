"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRightOutlined, ThunderboltOutlined, SafetyOutlined, QrcodeOutlined } from "@ant-design/icons";
import { AppProgress } from "@/components/ui";
import { useHomeFeed, useSessionProfile } from "@/hooks/use-frontend-data";

const WAVE_BLUE = "#1dc5ff";

function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, delay, ease: "easeOut" as const },
  };
}

function GlowOrb({ x, y, size, color }: { x: string; y: string; size: number; color: string }) {
  return (
    <div style={{
      position: "absolute", left: x, top: y,
      width: size, height: size,
      background: color,
      borderRadius: "50%",
      filter: `blur(${size * 0.6}px)`,
      opacity: 0.15,
      pointerEvents: "none",
    }} />
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div style={{
      flex: 1, minWidth: 140,
      padding: "24px 20px",
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 16,
      textAlign: "center",
    }}>
      <div style={{ fontSize: "clamp(24px,3vw,36px)", fontWeight: 800, color: WAVE_BLUE, letterSpacing: "-0.03em", lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 13, color: "#8899aa", marginTop: 6, fontWeight: 500 }}>{label}</div>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div style={{
      flex: 1, minWidth: 220,
      padding: 28,
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 16,
      transition: "all 0.3s",
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: "rgba(29,197,255,0.12)",
        border: "1px solid rgba(29,197,255,0.2)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22, color: WAVE_BLUE, marginBottom: 16,
      }}>{icon}</div>
      <div style={{ fontWeight: 700, fontSize: 16, color: "#f0f6ff", marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 14, color: "#8899aa", lineHeight: 1.7 }}>{desc}</div>
    </div>
  );
}

function CampaignCard({ campaign }: { campaign: {
  id: number; title: string; slug: string; amount_raised: number;
  target_amount: number | null; status: string; mode: string; cover_image_url: string | null;
}}) {
  const pct = campaign.target_amount && campaign.target_amount > 0
    ? Math.min(100, Math.round((campaign.amount_raised / campaign.target_amount) * 100))
    : null;

  return (
    <Link href={`/campaigns/${campaign.slug}`}>
      <motion.div
        whileHover={{ y: -4, scale: 1.01 }}
        transition={{ duration: 0.2 }}
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          overflow: "hidden",
          cursor: "pointer",
          height: "100%",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Cover */}
        <div style={{
          height: 200, position: "relative", flexShrink: 0,
          background: campaign.cover_image_url
            ? undefined
            : "linear-gradient(135deg, rgba(29,197,255,0.12) 0%, rgba(7,155,212,0.08) 100%)",
        }}>
          {campaign.cover_image_url ? (
            <Image src={campaign.cover_image_url} alt={campaign.title} fill unoptimized
              sizes="(max-width: 768px) 100vw, 33vw" style={{ objectFit: "cover" }} />
          ) : (
            <div style={{
              position: "absolute", inset: 0, display: "flex",
              alignItems: "center", justifyContent: "center",
              flexDirection: "column", gap: 8,
            }}>
              <div style={{ fontSize: 32, opacity: 0.3 }}>🇬🇲</div>
              <span style={{ color: WAVE_BLUE, fontWeight: 700, fontSize: 12, opacity: 0.5, letterSpacing: "0.1em" }}>KAMBENG</span>
            </div>
          )}
          <div style={{
            position: "absolute", top: 12, left: 12,
            display: "flex", gap: 6,
          }}>
            <span style={{
              padding: "4px 10px", borderRadius: 20,
              background: campaign.status === "ACTIVE" ? "rgba(27,191,136,0.85)" : "rgba(100,100,100,0.7)",
              color: "#fff", fontSize: 11, fontWeight: 600, backdropFilter: "blur(8px)",
            }}>{campaign.status}</span>
            <span style={{
              padding: "4px 10px", borderRadius: 20,
              background: "rgba(29,197,255,0.25)",
              color: WAVE_BLUE, fontSize: 11, fontWeight: 600, backdropFilter: "blur(8px)",
              border: "1px solid rgba(29,197,255,0.3)",
            }}>{campaign.mode}</span>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: "18px 20px 20px", flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "#f0f6ff", lineHeight: 1.4 }}>
            {campaign.title}
          </div>

          <div style={{ marginTop: "auto" }}>
            {pct !== null ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: "#8899aa" }}>
                    {campaign.amount_raised.toLocaleString()} GMD raised
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: WAVE_BLUE }}>{pct}%</span>
                </div>
                <AppProgress percent={pct} showInfo={false} strokeColor={WAVE_BLUE}
                  trailColor="rgba(255,255,255,0.08)" size="small" />
                <div style={{ fontSize: 12, color: "#4a5568", marginTop: 6 }}>
                  Goal: {(campaign.target_amount ?? 0).toLocaleString()} GMD
                </div>
              </>
            ) : (
              <div style={{ fontSize: 14, fontWeight: 600, color: WAVE_BLUE }}>
                {campaign.amount_raised.toLocaleString()} GMD raised
              </div>
            )}

            <div style={{
              marginTop: 14, padding: "10px 14px",
              background: "linear-gradient(135deg, rgba(29,197,255,0.15), rgba(7,155,212,0.1))",
              border: "1px solid rgba(29,197,255,0.2)",
              borderRadius: 10,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              color: WAVE_BLUE, fontSize: 13, fontWeight: 600,
            }}>
              <span>Donate with Wave</span>
              <ArrowRightOutlined />
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

export default function PublicHomePage() {
  const { data, isLoading } = useHomeFeed();
  const { data: session } = useSessionProfile(true);
  const isLoggedIn = Boolean(session?.id);

  const stats = data?.stats;
  const campaigns = data?.featured_campaigns ?? [];

  const totalRaised = stats
    ? stats.total_raised >= 1_000_000
      ? `${(stats.total_raised / 1_000_000).toFixed(1)}M`
      : stats.total_raised >= 1000
        ? `${(stats.total_raised / 1000).toFixed(1)}K`
        : String(stats.total_raised)
    : "0";

  return (
    <div>
      {/* ── HERO ── */}
      <section style={{ position: "relative", overflow: "hidden", minHeight: "92vh",
        display: "flex", alignItems: "center", padding: "80px clamp(16px,5vw,80px) 60px" }}>
        <GlowOrb x="-5%" y="10%" size={600} color="#1dc5ff" />
        <GlowOrb x="60%" y="-20%" size={500} color="#079bd4" />
        <GlowOrb x="80%" y="60%" size={400} color="#1dc5ff" />

        {/* Grid lines decoration */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.03,
          backgroundImage: "linear-gradient(rgba(29,197,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(29,197,255,1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }} />

        <div style={{ position: "relative", zIndex: 1, maxWidth: 1200, margin: "0 auto", width: "100%" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 60, alignItems: "center" }}>
            {/* Left */}
            <div style={{ flex: "1 1 500px", maxWidth: 640 }}>
              <motion.div {...fadeUp(0)}>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "6px 14px", borderRadius: 20,
                  background: "rgba(29,197,255,0.1)",
                  border: "1px solid rgba(29,197,255,0.25)",
                  marginBottom: 24,
                }}>
                  <ThunderboltOutlined style={{ color: WAVE_BLUE, fontSize: 12 }} />
                  <span style={{ color: WAVE_BLUE, fontSize: 13, fontWeight: 600 }}>
                    Powered by Wave Mobile Money
                  </span>
                </div>
              </motion.div>

              <motion.h1 {...fadeUp(0.1)} style={{
                fontSize: "clamp(36px, 6vw, 72px)",
                fontWeight: 900, lineHeight: 1.05,
                letterSpacing: "-0.04em", color: "#f0f6ff",
                marginBottom: 20,
              }}>
                Fund What<br />
                Matters in<br />
                <span style={{ color: WAVE_BLUE }}>The Gambia</span>
              </motion.h1>

              <motion.p {...fadeUp(0.2)} style={{
                fontSize: "clamp(15px, 2vw, 18px)", color: "#8899aa",
                lineHeight: 1.75, maxWidth: 460, marginBottom: 36,
              }}>
                Launch a campaign, share your Wave QR code, and collect donations
                directly to your mobile wallet. Transparent, fast, and built for Gambians.
              </motion.p>

              <motion.div {...fadeUp(0.3)} style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Link href="/campaigns">
                  <button style={{
                    padding: "14px 28px", borderRadius: 12, border: "none",
                    background: "linear-gradient(135deg, #1dc5ff, #079bd4)",
                    color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
                    boxShadow: "0 8px 32px rgba(29,197,255,0.35)",
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                    Browse Campaigns <ArrowRightOutlined />
                  </button>
                </Link>
                {isLoggedIn ? (
                  <Link href="/dashboard">
                    <button style={{
                      padding: "14px 28px", borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.15)",
                      background: "rgba(255,255,255,0.06)",
                      color: "#f0f6ff", fontSize: 15, fontWeight: 600, cursor: "pointer",
                    }}>My Dashboard</button>
                  </Link>
                ) : (
                  <Link href="/auth/signup">
                    <button style={{
                      padding: "14px 28px", borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.15)",
                      background: "rgba(255,255,255,0.06)",
                      color: "#f0f6ff", fontSize: 15, fontWeight: 600, cursor: "pointer",
                    }}>Start a Campaign</button>
                  </Link>
                )}
              </motion.div>

              {/* Stat pills */}
              <motion.div {...fadeUp(0.4)} style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 48 }}>
                {[
                  { v: isLoading ? "..." : `${totalRaised} GMD`, l: "Total Raised" },
                  { v: isLoading ? "..." : String(stats?.active_campaigns ?? 0), l: "Active Campaigns" },
                  { v: isLoading ? "..." : String(stats?.successful_donations ?? 0), l: "Donations" },
                ].map(({ v, l }) => (
                  <div key={l} style={{
                    padding: "10px 18px", borderRadius: 10,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}>
                    <div style={{ fontWeight: 800, fontSize: 20, color: "#f0f6ff" }}>{v}</div>
                    <div style={{ fontSize: 12, color: "#8899aa", marginTop: 2 }}>{l}</div>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Right — How it works card */}
            <motion.div {...fadeUp(0.3)} style={{ flex: "1 1 300px", maxWidth: 400 }}>
              <div style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 20,
                padding: 28,
                backdropFilter: "blur(20px)",
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#8899aa", letterSpacing: "0.1em", marginBottom: 20, textTransform: "uppercase" }}>
                  How it works
                </div>
                {[
                  { n: "01", t: "Create your campaign", d: "Tell your story, set a goal, upload photos" },
                  { n: "02", t: "Share your Wave QR", d: "Print it, post it, or send it on WhatsApp" },
                  { n: "03", t: "Collect & withdraw", d: "Funds go directly to your Wave wallet" },
                ].map(({ n, t, d }, i) => (
                  <div key={n} style={{
                    display: "flex", gap: 16, paddingBottom: i < 2 ? 20 : 0,
                    marginBottom: i < 2 ? 20 : 0,
                    borderBottom: i < 2 ? "1px solid rgba(255,255,255,0.06)" : "none",
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: "rgba(29,197,255,0.12)",
                      border: "1px solid rgba(29,197,255,0.2)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 800, color: WAVE_BLUE,
                    }}>{n}</div>
                    <div>
                      <div style={{ fontWeight: 600, color: "#f0f6ff", fontSize: 14, marginBottom: 4 }}>{t}</div>
                      <div style={{ fontSize: 13, color: "#8899aa", lineHeight: 1.5 }}>{d}</div>
                    </div>
                  </div>
                ))}
                <Link href="/auth/signup">
                  <button style={{
                    width: "100%", marginTop: 24,
                    padding: "12px 20px", borderRadius: 10,
                    background: "linear-gradient(135deg, #1dc5ff, #079bd4)",
                    border: "none", color: "#fff",
                    fontSize: 14, fontWeight: 700, cursor: "pointer",
                    boxShadow: "0 4px 16px rgba(29,197,255,0.3)",
                  }}>Start a Campaign Free →</button>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── TRUST FEATURES ── */}
      <section style={{ padding: "80px clamp(16px,5vw,80px)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <motion.div {...fadeUp(0)} style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ fontSize: "clamp(26px,4vw,40px)", fontWeight: 800, color: "#f0f6ff", marginBottom: 12, letterSpacing: "-0.03em" }}>
              Built on trust, backed by proof
            </h2>
            <p style={{ color: "#8899aa", fontSize: 16, maxWidth: 480, margin: "0 auto" }}>
              Every campaign shows its story, photos, and verified proof of expenditure — so donors know exactly where their money goes.
            </p>
          </motion.div>

          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            <FeatureCard icon={<QrcodeOutlined />} title="Wave QR Payments"
              desc="Every campaign gets a unique QR code. Donors scan and pay instantly with Wave — no app required." />
            <FeatureCard icon={<SafetyOutlined />} title="Verified Campaigners"
              desc="KYC verification ensures every campaigner is a real person in The Gambia before they can withdraw." />
            <FeatureCard icon="📸" title="Photo & Proof"
              desc="Campaigners upload receipts, photos, and documents so donors can see exactly how funds were used." />
            <FeatureCard icon="⭐" title="Donor Reviews"
              desc="Supporters leave public reviews and ratings, building a track record of transparency and trust." />
          </div>
        </div>
      </section>

      {/* ── FEATURED CAMPAIGNS ── */}
      <section style={{ padding: "80px clamp(16px,5vw,80px)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 40, flexWrap: "wrap", gap: 16 }}>
            <div>
              <h2 style={{ fontSize: "clamp(24px,3.5vw,36px)", fontWeight: 800, color: "#f0f6ff", margin: 0, letterSpacing: "-0.03em" }}>
                Featured Campaigns
              </h2>
              <p style={{ color: "#8899aa", fontSize: 15, marginTop: 8 }}>
                Real stories from real Gambians — click any campaign to see the full story & proof
              </p>
            </div>
            <Link href="/campaigns">
              <button style={{
                padding: "10px 20px", borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.05)",
                color: "#f0f6ff", fontSize: 14, fontWeight: 500, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                View All <ArrowRightOutlined />
              </button>
            </Link>
          </div>

          {isLoading ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{
                  height: 360, borderRadius: 16,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  animation: "pulse 2s infinite",
                }} />
              ))}
            </div>
          ) : campaigns.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "60px 24px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 20,
            }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🌱</div>
              <div style={{ fontWeight: 700, fontSize: 20, color: "#f0f6ff", marginBottom: 8 }}>No campaigns yet</div>
              <div style={{ color: "#8899aa", marginBottom: 24 }}>Be the first to launch a campaign in The Gambia</div>
              <Link href="/auth/signup">
                <button style={{
                  padding: "12px 24px", borderRadius: 10, border: "none",
                  background: "linear-gradient(135deg, #1dc5ff, #079bd4)",
                  color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 15,
                }}>Start a Campaign</button>
              </Link>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
              {campaigns.slice(0, 6).map((c, i) => (
                <motion.div key={c.id} {...fadeUp(i * 0.08)}>
                  <CampaignCard campaign={c} />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section style={{ padding: "80px clamp(16px,5vw,80px)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <motion.div {...fadeUp(0)} style={{
            position: "relative", overflow: "hidden",
            background: "linear-gradient(135deg, rgba(29,197,255,0.12) 0%, rgba(7,155,212,0.08) 100%)",
            border: "1px solid rgba(29,197,255,0.2)",
            borderRadius: 24, padding: "60px clamp(24px,5vw,64px)",
            textAlign: "center",
          }}>
            <GlowOrb x="10%" y="50%" size={300} color="#1dc5ff" />
            <GlowOrb x="70%" y="20%" size={250} color="#079bd4" />
            <div style={{ position: "relative", zIndex: 1 }}>
              <h2 style={{ fontSize: "clamp(26px,4vw,48px)", fontWeight: 900, color: "#f0f6ff", marginBottom: 16, letterSpacing: "-0.03em" }}>
                Ready to make a difference?
              </h2>
              <p style={{ color: "#8899aa", fontSize: 17, maxWidth: 480, margin: "0 auto 32px", lineHeight: 1.7 }}>
                Join hundreds of Gambians using Kambeng to fund schools, health projects, and community causes.
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                <Link href="/auth/signup">
                  <button style={{
                    padding: "14px 32px", borderRadius: 12, border: "none",
                    background: "linear-gradient(135deg, #1dc5ff, #079bd4)",
                    color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer",
                    boxShadow: "0 8px 32px rgba(29,197,255,0.4)",
                  }}>Start a Campaign Free</button>
                </Link>
                <Link href="/campaigns">
                  <button style={{
                    padding: "14px 32px", borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.2)",
                    background: "rgba(255,255,255,0.06)",
                    color: "#f0f6ff", fontSize: 16, fontWeight: 600, cursor: "pointer",
                  }}>Browse Campaigns</button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
