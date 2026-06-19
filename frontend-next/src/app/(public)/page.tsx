"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { LockOutlined } from "@ant-design/icons";
import { useHomeFeed, useSessionProfile } from "@/hooks/use-frontend-data";

const BLUE = "#1dc5ff";
const GREEN = "#1bbf88";

function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.55, delay, ease: "easeOut" as const },
  };
}

function fadeIn(delay = 0) {
  return {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.7, delay, ease: "easeOut" as const },
  };
}

function CountUp({ to, suffix = "", prefix = "" }: { to: number; suffix?: string; prefix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView || to === 0) return;
    const duration = 1600;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(ease * to));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, to]);

  return <span ref={ref}>{prefix}{val.toLocaleString()}{suffix}</span>;
}

function SectionLabel({ color = BLUE, children }: { color?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "4px 14px", borderRadius: 20, background: `${color}15`, border: `1px solid ${color}30`, fontSize: 11, color, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 16 }}>
      <svg width="6" height="6" viewBox="0 0 6 6"><circle cx="3" cy="3" r="3" fill={color}/></svg>
      {children}
    </div>
  );
}

function FeaturedCampaignCard({ campaign }: {
  campaign: {
    id: number; title: string; slug: string; status: string; mode: string;
    amount_raised: number; target_amount: number | null; cover_image_url: string | null;
  }
}) {
  const pct = campaign.target_amount && campaign.target_amount > 0
    ? Math.min(100, (campaign.amount_raised / campaign.target_amount) * 100) : 0;
  const hasTarget = campaign.target_amount && campaign.target_amount > 0;

  return (
    <motion.div {...fadeUp(0.2)} className="featured-card" style={{
      position: "relative", borderRadius: 20, overflow: "hidden",
      maxWidth: 400, width: "100%", aspectRatio: "4/5",
      boxShadow: "0 2px 0 rgba(255,255,255,0.06), 0 4px 8px rgba(0,0,0,0.4), 0 16px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)",
    }}
      whileHover={{ y: -6, boxShadow: "0 8px 16px rgba(0,0,0,0.45), 0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(29,197,255,0.2), 0 0 40px rgba(29,197,255,0.08)" } as object}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <Image src={campaign.cover_image_url ?? "/sample.png"} alt={campaign.title} fill unoptimized sizes="400px" style={{ objectFit: "cover", objectPosition: "center 15%" }} />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.65) 55%, rgba(0,0,0,0.97) 100%)" }} />
      <div style={{ position: "absolute", top: 14, left: 14, right: 14, zIndex: 2, display: "flex", justifyContent: "space-between" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(10px)", border: "1px solid rgba(27,191,136,0.5)" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN, boxShadow: `0 0 6px ${GREEN}`, display: "inline-block" }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: GREEN, letterSpacing: "0.05em" }}>LIVE</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(10px)", border: "1px solid rgba(29,197,255,0.35)" }}>
          <svg width="12" height="13" viewBox="0 0 13 14" fill="none">
            <path d="M6.5 0.5L1 2.5V6.5C1 9.538 3.44 12.376 6.5 13.5C9.56 12.376 12 9.538 12 6.5V2.5L6.5 0.5Z" fill="rgba(29,197,255,0.15)" stroke={BLUE} strokeWidth="1" strokeLinejoin="round"/>
            <path d="M4 7L5.8 8.8L9 5.5" stroke={BLUE} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontSize: 11, fontWeight: 600, color: BLUE }}>Verified</span>
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 2, padding: 16 }}>
        <Link href={`/campaigns/${campaign.slug}`}>
          <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: "#fff", lineHeight: 1.25, letterSpacing: "-0.02em", cursor: "pointer" }}>{campaign.title}</h3>
        </Link>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", marginBottom: 12 }}>
          <span style={{ fontWeight: 700, color: "#fff", fontSize: 15 }}>{campaign.amount_raised.toLocaleString()} GMD</span>
          {hasTarget && <span> raised · {Math.round(pct)}% of goal</span>}
        </div>
        {hasTarget && (
          <div style={{ height: 3, background: "rgba(255,255,255,0.15)", borderRadius: 2, marginBottom: 14, overflow: "hidden" }}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, delay: 0.4, ease: "easeOut" }}
              style={{ height: "100%", background: `linear-gradient(90deg, ${BLUE}, #079bd4)`, borderRadius: 2 }} />
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Link href={`/quick-pay/${campaign.slug}`}>
            <button style={{ width: "100%", padding: "12px 0", borderRadius: 50, border: "none", background: `linear-gradient(135deg, ${BLUE}, #079bd4)`, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 20px rgba(29,197,255,0.4)" }}>
              Donate now
            </button>
          </Link>
          <Link href={`/campaigns/${campaign.slug}`}>
            <button style={{ width: "100%", padding: "10px 0", borderRadius: 50, border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
              See the story →
            </button>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

function SmallCampaignCard({ campaign }: {
  campaign: { id: number; title: string; slug: string; amount_raised: number; target_amount: number | null; cover_image_url: string | null };
}) {
  const pct = campaign.target_amount && campaign.target_amount > 0
    ? Math.min(100, Math.round((campaign.amount_raised / campaign.target_amount) * 100)) : null;
  return (
    <Link href={`/campaigns/${campaign.slug}`}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, cursor: "pointer", transition: "border-color 0.2s, background 0.2s" }}
        onMouseEnter={(e) => { const d = e.currentTarget as HTMLDivElement; d.style.borderColor = "rgba(29,197,255,0.25)"; d.style.background = "rgba(29,197,255,0.05)"; }}
        onMouseLeave={(e) => { const d = e.currentTarget as HTMLDivElement; d.style.borderColor = "rgba(255,255,255,0.07)"; d.style.background = "rgba(255,255,255,0.03)"; }}
      >
        <div style={{ width: 48, height: 48, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: "#1a2333", position: "relative" }}>
          {campaign.cover_image_url
            ? <Image src={campaign.cover_image_url} alt={campaign.title} fill unoptimized sizes="48px" style={{ objectFit: "cover" }} />
            : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #0d2340, #0a3d5c)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: BLUE }}>{campaign.title.charAt(0)}</div>
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#f0f6ff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 4 }}>{campaign.title}</div>
          <div style={{ height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct ?? 0}%`, background: `linear-gradient(90deg, ${BLUE}, #079bd4)`, borderRadius: 2 }} />
          </div>
          <div style={{ fontSize: 11, color: "#4a5568", marginTop: 3 }}>{campaign.amount_raised.toLocaleString()} GMD raised</div>
        </div>
        <span style={{ color: "#4a5568", fontSize: 12, flexShrink: 0 }}>→</span>
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
  const sidebarCampaigns = campaigns.slice(1, 4);
  const gridCampaigns = campaigns.slice(0, 6);

  const fmt = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000 ? `${(n / 1_000).toFixed(0)}K`
    : String(n);

  return (
    <div style={{ background: "#0a0f1a" }}>

      {/* ══════════════════════════════════════════════
          §1  HERO
      ══════════════════════════════════════════════ */}
      <section className="hero-section" style={{
        position: "relative", overflow: "hidden",
        minHeight: "calc(100vh - 68px)",
        display: "flex", alignItems: "center",
        padding: "40px clamp(16px, 5vw, 72px)",
      }}>
        {/* Background */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
          <div style={{ position: "absolute", width: 900, height: 900, background: "radial-gradient(circle, rgba(29,197,255,0.09) 0%, transparent 60%)", left: "-25%", top: "-25%" }} />
          <div style={{ position: "absolute", width: 500, height: 500, background: "radial-gradient(circle, rgba(27,191,136,0.05) 0%, transparent 70%)", right: "5%", bottom: "5%" }} />
          <div style={{ position: "absolute", inset: 0, opacity: 0.018, backgroundImage: `linear-gradient(rgba(29,197,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(29,197,255,1) 1px, transparent 1px)`, backgroundSize: "64px 64px" }} />
        </div>

        <div style={{ position: "relative", zIndex: 1, maxWidth: 1200, margin: "0 auto", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "clamp(32px, 6vw, 80px)", flexWrap: "wrap" }}>

            {/* Left */}
            <div style={{ flex: "1 1 420px", minWidth: 0 }}>
              {/* Payment trust bar */}
              <motion.div {...fadeIn(0)} style={{ marginBottom: 24 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 16px", borderRadius: 24, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", flexWrap: "wrap" as const }}>
                  <span style={{ fontSize: 11, color: "#6b7a8d", fontWeight: 600 }}>🇬🇲 Trusted by Gambians</span>
                  <span style={{ width: 1, height: 14, background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />
                  {[
                    { label: "Wave", color: BLUE, bg: `${BLUE}20`, border: `${BLUE}40` },
                    { label: "APS", color: "#f59e0b", bg: "rgba(245,158,11,0.15)", border: "rgba(245,158,11,0.35)" },
                    { label: "Visa / MC", color: "#a5b4fc", bg: "rgba(99,102,241,0.15)", border: "rgba(99,102,241,0.35)" },
                  ].map(({ label, color, bg, border }) => (
                    <span key={label} style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 6, color, background: bg, border: `1px solid ${border}`, letterSpacing: "0.05em" }}>{label}</span>
                  ))}
                </div>
              </motion.div>

              <motion.h1 {...fadeUp(0.06)} style={{ fontSize: "clamp(36px, 5.5vw, 66px)", fontWeight: 900, lineHeight: 1.03, letterSpacing: "-0.04em", color: "#f0f6ff", margin: "0 0 8px" }}>
                Fund What<br />
                Matters in<br />
                <span style={{ color: BLUE, textShadow: `0 0 60px rgba(29,197,255,0.5)` }}>The Gambia</span>
              </motion.h1>

              <motion.p {...fadeUp(0.12)} style={{ fontSize: 13, color: "#f59e0b", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const, margin: "0 0 18px" }}>
                Real Causes · Real Proof · Real Gambians
              </motion.p>

              <motion.p {...fadeUp(0.18)} style={{ fontSize: "clamp(14px, 1.6vw, 16px)", color: "#8899aa", lineHeight: 1.78, maxWidth: 460, margin: "0 0 30px" }}>
                Launch a campaign, collect donations via Wave, APS Mobile Money, or card — and prove every dalasi was well spent with photos and receipts your donors can see.
              </motion.p>

              {/* CTAs */}
              <motion.div {...fadeUp(0.22)} style={{ display: "flex", gap: 12, flexWrap: "wrap" as const, marginBottom: 10 }}>
                <Link href="/campaigns">
                  <button className="btn-primary" style={{ padding: "14px 28px", borderRadius: 12, border: "none", background: `linear-gradient(135deg, ${BLUE}, #079bd4)`, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 8px 28px rgba(29,197,255,0.35)", transition: "opacity 0.2s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.88"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}>
                    Donate to a Campaign →
                  </button>
                </Link>
                <Link href={isLoggedIn ? "/dashboard" : "/auth/signup"}>
                  <button style={{ padding: "14px 28px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.05)", color: "#f0f6ff", fontSize: 15, fontWeight: 600, cursor: "pointer", transition: "border-color 0.2s, background 0.2s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(29,197,255,0.3)"; e.currentTarget.style.background = "rgba(29,197,255,0.06)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)"; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}>
                    {isLoggedIn ? "My Dashboard" : "Start a Campaign"}
                  </button>
                </Link>
              </motion.div>

              <motion.p {...fadeUp(0.26)} style={{ fontSize: 12, color: "#4a5568", marginBottom: 32, fontWeight: 500 }}>
                No account needed to donate · Takes under 2 minutes
              </motion.p>

              {/* Live stats bar */}
              <motion.div {...fadeUp(0.32)}>
                <div style={{ display: "flex", gap: 0, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden" }}>
                  {[
                    { label: "Total Raised", raw: stats?.total_raised ?? 0, display: `${fmt(stats?.total_raised ?? 0)} GMD` },
                    { label: "Live Campaigns", raw: stats?.active_campaigns ?? 0, display: String(stats?.active_campaigns ?? 0) },
                    { label: "Donations Made", raw: stats?.successful_donations ?? 0, display: String(stats?.successful_donations ?? 0) },
                  ].map(({ label, raw, display }, i, arr) => (
                    <div key={label} style={{ flex: 1, padding: "14px 10px", textAlign: "center", borderRight: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                      <div style={{ fontSize: "clamp(14px, 1.8vw, 20px)", fontWeight: 800, color: "#f0f6ff", lineHeight: 1, letterSpacing: "-0.03em" }}>
                        {isLoading ? "—" : raw > 0 ? <CountUp to={raw} suffix={display.replace(/[\d,]/g, "").trim()} /> : display}
                      </div>
                      <div style={{ fontSize: 11, color: "#8899aa", marginTop: 4, fontWeight: 500 }}>{label}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Right — dark video + featured card + sidebar */}
            <div style={{ flex: "0 1 400px", display: "flex", flexDirection: "column", gap: 14, minWidth: 280 }}>

              {/* Dark logo reveal video */}
              <motion.div {...fadeIn(0.08)} className="hero-video-card" style={{ borderRadius: 18, overflow: "hidden", position: "relative", background: "#000", border: "1px solid rgba(255,255,255,0.06)", aspectRatio: "1/1" }}>
                <video autoPlay muted loop playsInline style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}>
                  <source src="/logo-reveal-dark.mp4" type="video/mp4" />
                </video>
              </motion.div>

              {/* Featured campaign */}
              {isLoading ? (
                <div style={{ background: "#111827", borderRadius: 20, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ height: 200, background: "rgba(255,255,255,0.04)", animation: "shimmer 1.5s infinite" }} />
                  <div style={{ padding: 20 }}>
                    {[80, 60, 100].map((w) => <div key={w} style={{ height: 13, width: `${w}%`, background: "rgba(255,255,255,0.05)", borderRadius: 6, marginBottom: 10 }} />)}
                  </div>
                </div>
              ) : featured ? (
                <FeaturedCampaignCard campaign={featured} />
              ) : null}

              {/* Sidebar mini campaigns */}
              {sidebarCampaigns.length > 0 && !isLoading && (
                <motion.div {...fadeUp(0.35)} className="hero-more-campaigns" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {sidebarCampaigns.map((c) => <SmallCampaignCard key={c.id} campaign={c} />)}
                  <Link href="/campaigns" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: 10, border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, fontSize: 13, color: "#8899aa", fontWeight: 500 }}>
                    View all campaigns →
                  </Link>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          §2  IMPACT / STATS  (stats-counter video)
      ══════════════════════════════════════════════ */}
      <section style={{ borderTop: "1px solid rgba(255,255,255,0.05)", overflow: "hidden", position: "relative" }}>
        <div style={{ position: "relative", display: "flex", alignItems: "stretch", minHeight: 360, flexWrap: "wrap" as const }}>

          {/* Video side */}
          <div className="impact-video" style={{ flex: "0 0 45%", position: "relative", minHeight: 300, background: "#000", overflow: "hidden" }}>
            <video autoPlay muted loop playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}>
              <source src="/stats-counter.mp4" type="video/mp4" />
            </video>
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, transparent 60%, #0a0f1a 100%)" }} />
          </div>

          {/* Content side */}
          <div style={{ flex: "1 1 340px", padding: "64px clamp(24px, 5vw, 72px)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <motion.div {...fadeUp(0)}>
              <SectionLabel color={GREEN}>Platform impact</SectionLabel>
              <h2 style={{ fontSize: "clamp(24px, 3.5vw, 38px)", fontWeight: 900, color: "#f0f6ff", margin: "0 0 12px", letterSpacing: "-0.04em", lineHeight: 1.08 }}>
                Gambia Is Giving.<br />We&apos;re Just Keeping<br />It Transparent.
              </h2>
              <p style={{ color: "#8899aa", fontSize: 15, lineHeight: 1.75, maxWidth: 400, margin: "0 0 36px" }}>
                Every donation tracked, every receipt uploaded, every campaigner verified — because trust isn&apos;t optional in crowdfunding.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, maxWidth: 380 }}>
                {[
                  { label: "Dalasi raised", raw: stats?.total_raised ?? 0, suffix: " GMD", color: BLUE },
                  { label: "Active campaigns", raw: stats?.active_campaigns ?? 0, suffix: "", color: GREEN },
                  { label: "Successful donations", raw: stats?.successful_donations ?? 0, suffix: "", color: "#f59e0b" },
                  { label: "Verified campaigners", raw: 0, suffix: "", display: "100%", color: "#a855f7" },
                ].map(({ label, raw, suffix, display, color }) => (
                  <div key={label} style={{ padding: "16px 20px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, borderLeft: `3px solid ${color}` }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color, letterSpacing: "-0.03em" }}>
                      {display ?? (isLoading ? "—" : raw > 0 ? <CountUp to={raw} suffix={suffix} /> : `0${suffix}`)}
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7a8d", marginTop: 4, fontWeight: 500 }}>{label}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          §3  HOW IT WORKS
      ══════════════════════════════════════════════ */}
      <section style={{ padding: "96px clamp(16px, 5vw, 72px)", borderTop: "1px solid rgba(255,255,255,0.05)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 80% 40% at 50% 0%, rgba(29,197,255,0.04) 0%, transparent 60%)" }} />
        <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <motion.div {...fadeUp(0)} style={{ textAlign: "center", marginBottom: 64 }}>
            <SectionLabel>How it works</SectionLabel>
            <h2 style={{ fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 900, color: "#f0f6ff", margin: "0 0 14px", letterSpacing: "-0.04em", lineHeight: 1.07 }}>
              From Idea to Impact<br />in Four Steps
            </h2>
            <p style={{ color: "#8899aa", fontSize: 16, maxWidth: 440, margin: "0 auto", lineHeight: 1.75 }}>
              Kambeng makes it simple to raise money or donate — with full transparency built in from the start.
            </p>
          </motion.div>

          <div className="steps-grid" style={{ display: "grid", gap: 16, position: "relative" }}>
            {/* Connector line */}
            <div className="steps-connector" style={{ position: "absolute", top: 40, left: "12.5%", right: "12.5%", height: 1, background: "linear-gradient(90deg, transparent, rgba(29,197,255,0.2), rgba(29,197,255,0.2), rgba(29,197,255,0.2), transparent)", pointerEvents: "none" }} />
            {[
              {
                n: "01", title: "Create Your Campaign", color: BLUE,
                desc: "Set up your campaign in minutes. Add a title, goal, story, and cover photo.",
                icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke={BLUE} strokeWidth="2" strokeLinecap="round"/></svg>,
              },
              {
                n: "02", title: "Get ID-Verified", color: GREEN,
                desc: "Submit your national ID for a one-time KYC check. Takes under 24 hours.",
                icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2L3 6v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V6l-9-4z" fill={`${GREEN}20`} stroke={GREEN} strokeWidth="1.8"/><path d="M9 12l2 2 4-4" stroke={GREEN} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
              },
              {
                n: "03", title: "Share & Collect", color: "#f59e0b",
                desc: "Share your campaign link or QR code. Donors pay with Wave, APS, or card — instantly.",
                icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="18" cy="5" r="3" stroke="#f59e0b" strokeWidth="1.8"/><circle cx="6" cy="12" r="3" stroke="#f59e0b" strokeWidth="1.8"/><circle cx="18" cy="19" r="3" stroke="#f59e0b" strokeWidth="1.8"/><path d="M8.6 10.6l6.8-4.2M8.6 13.4l6.8 4.2" stroke="#f59e0b" strokeWidth="1.6" strokeLinecap="round"/></svg>,
              },
              {
                n: "04", title: "Prove & Withdraw", color: "#a855f7",
                desc: "Upload receipts showing how funds were spent. Donors see proof. You withdraw.",
                icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="#a855f7" strokeWidth="1.8"/><path d="M7 9h6M7 13h4" stroke="#a855f7" strokeWidth="1.6" strokeLinecap="round"/><path d="M16 13l2 2 2-2" stroke="#a855f7" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
              },
            ].map(({ n, title, color, desc, icon }, i) => (
              <motion.div key={n} {...fadeUp(0.1 * i)} style={{
                padding: "32px 24px", background: "#0d1120",
                border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20,
                position: "relative", overflow: "hidden", transition: "border-color 0.3s",
              }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = `${color}40`; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.07)"; }}
              >
                <div style={{ position: "absolute", top: -30, right: -30, fontSize: 80, fontWeight: 900, color, opacity: 0.04, lineHeight: 1, userSelect: "none" }}>{n}</div>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: `${color}18`, border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>{icon}</div>
                <div style={{ fontSize: 11, color, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 8 }}>Step {n}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#f0f6ff", marginBottom: 10, letterSpacing: "-0.02em" }}>{title}</div>
                <div style={{ fontSize: 13, color: "#6b7a8d", lineHeight: 1.75 }}>{desc}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          §4  TRUST — "Real Causes. Real Proof."
      ══════════════════════════════════════════════ */}
      <section className="trust-section" style={{ padding: "96px clamp(16px, 5vw, 72px)", borderTop: "1px solid rgba(255,255,255,0.05)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", width: 700, height: 700, background: "radial-gradient(circle, rgba(27,191,136,0.05) 0%, transparent 70%)", right: "-15%", top: "0%", pointerEvents: "none" }} />

        <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative", zIndex: 1 }}>
          {/* Header with transparent video overlay */}
          <div style={{ position: "relative", marginBottom: 56, overflow: "hidden", borderRadius: 20, padding: "56px 48px", background: "linear-gradient(135deg, rgba(27,191,136,0.08) 0%, rgba(29,197,255,0.05) 100%)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <video autoPlay muted loop playsInline style={{ position: "absolute", top: 0, right: 0, height: "100%", width: "45%", objectFit: "cover", opacity: 0.18, mixBlendMode: "screen" }}>
              <source src="/logo-reveal-transparent.webm" type="video/webm" />
            </video>
            <div className="trust-header" style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap" as const, gap: 24 }}>
              <div>
                <SectionLabel color={GREEN}>Built on trust</SectionLabel>
                <h2 style={{ fontSize: "clamp(26px, 4vw, 44px)", fontWeight: 900, color: "#f0f6ff", margin: "0", letterSpacing: "-0.04em", lineHeight: 1.05 }}>
                  Real Causes.<br />Real Proof.<br />Real Gambians.
                </h2>
              </div>
              <p className="trust-tagline" style={{ color: "#8899aa", fontSize: 15, maxWidth: 360, margin: 0, lineHeight: 1.75 }}>
                Every campaign comes with verified identity, photo proof, and spending receipts — because asking &ldquo;did this actually help?&rdquo; shouldn&apos;t be necessary.
              </p>
            </div>
          </div>

          <div className="trust-grid" style={{ display: "grid", gap: 2, background: "rgba(255,255,255,0.04)", borderRadius: 20, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" }}>
            {[
              {
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="13" rx="2" stroke={GREEN} strokeWidth="1.8"/><circle cx="8.5" cy="11.5" r="2" stroke={GREEN} strokeWidth="1.6"/><path d="M5 19c0-2 1.5-3 3.5-3s3.5 1 3.5 3" stroke={GREEN} strokeWidth="1.6" strokeLinecap="round"/><path d="M14 10h4M14 13.5h2.5" stroke={GREEN} strokeWidth="1.6" strokeLinecap="round"/></svg>,
                accent: GREEN, glow: `${GREEN}18`, border: `${GREEN}28`,
                badge: "100% ID-Verified", title: "KYC Verified Identity",
                desc: "Every campaigner submits a government ID and is manually reviewed before they can raise a single dalasi. No anonymous accounts, no fake campaigns.",
                stat: "100%", statLabel: "verified",
              },
              {
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke={BLUE} strokeWidth="1.8"/><circle cx="12" cy="12" r="3.5" stroke={BLUE} strokeWidth="1.6"/><circle cx="12" cy="12" r="1" fill={BLUE}/></svg>,
                accent: BLUE, glow: `${BLUE}18`, border: `${BLUE}28`,
                badge: "Public Proof", title: "Photo & Receipt Proof",
                desc: "Campaigners upload photos and receipts showing exactly how funds were spent — visible to every donor, forever.",
                stat: "Public", statLabel: "to everyone",
              },
              {
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 10h18M7 15h2M11 15h4" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round"/><rect x="2" y="6" width="20" height="13" rx="3" stroke="#f59e0b" strokeWidth="1.8"/></svg>,
                accent: "#f59e0b", glow: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.2)",
                badge: "3 Ways to Pay", title: "Wave · APS · Visa/Mastercard",
                desc: "Donate instantly with Wave, APS Mobile Money, or a Visa/Mastercard via secure card checkout. No app required, no waiting.",
                stat: "3", statLabel: "payment rails",
              },
              {
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2Z" stroke="#a855f7" strokeWidth="1.7" strokeLinejoin="round"/></svg>,
                accent: "#a855f7", glow: "rgba(168,85,247,0.1)", border: "rgba(168,85,247,0.2)",
                badge: "Always Visible", title: "Public Donor Reviews",
                desc: "Donors leave public ratings and feedback on every campaign. A campaigner's track record is permanent — good or bad.",
                stat: "Always", statLabel: "visible",
              },
            ].map(({ icon, accent, glow, border, badge, title, desc, stat, statLabel }) => (
              <div key={title} className="trust-card" style={{ padding: "32px 28px", background: "#0d1120", position: "relative", cursor: "default", transition: "background 0.3s" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = glow; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#0d1120"; }}
              >
                <div style={{ position: "absolute", top: 0, left: 28, right: 28, height: 2, background: `linear-gradient(90deg, ${accent}, transparent)` }} />
                <div style={{ width: 48, height: 48, borderRadius: 12, background: glow, border: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>{icon}</div>
                <div style={{ fontSize: 10, color: accent, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 4 }}>{badge}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#f0f6ff", marginBottom: 8 }}>{title}</div>
                <div className="trust-desc" style={{ fontSize: 13, color: "#6b7a8d", lineHeight: 1.75, marginBottom: 18 }}>{desc}</div>
                <div style={{ display: "inline-flex", alignItems: "baseline", gap: 5, padding: "4px 10px", borderRadius: 8, background: glow, border: `1px solid ${border}` }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: accent }}>{stat}</span>
                  <span style={{ fontSize: 11, color: "#4a5568" }}>{statLabel}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          §5  TESTIMONIALS
      ══════════════════════════════════════════════ */}
      <section style={{ padding: "96px clamp(16px, 5vw, 72px)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <SectionLabel color="#f59e0b">What people are saying</SectionLabel>
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(28px, 4vw, 40px)", letterSpacing: "-0.02em", color: "#f0f6ff", margin: 0 }}>
              Real Causes. Real Gambians.
            </h2>
          </div>
          <div className="testimonials-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
            {[
              { id:"t1", quote:"I sent money through Wave in under a minute, and I could actually see photos of the borehole being built. That's the part that got me — most fundraisers, you never know what happened with your money.", name:"Aisha N.", role:"donor" as const, location:"Serrekunda", rating:5 },
              { id:"t2", quote:"My brother is in the UK and wanted to support a campaign here but didn't have Wave. He used his card and it just worked. Donating felt as easy as it should be.", name:"Lamin J.", role:"donor" as const, location:"Bakau", rating:5 },
              { id:"t3", quote:"What convinced me to donate was seeing the campaigner was KYC verified. In a small country like ours, that reassurance matters more than people think.", name:"Fatoumatta C.", role:"donor" as const, location:"Banjul", rating:5 },
              { id:"t4", quote:"We raised more for the school's library in three weeks on Kambeng than we did in three months asking around. Posting receipts each week kept donors coming back.", name:"Modou S.", role:"campaigner" as const, location:"Brikama", rating:5 },
              { id:"t5", quote:"I was nervous putting my ID up for verification, but it's what made donors trust the campaign. We hit our goal for the borehole faster than I expected.", name:"Sarjo B.", role:"campaigner" as const, location:"Farafenni", rating:4 },
              { id:"t6", quote:"Being able to show exactly what we spent — cement, labor, transport — meant nobody asked 'where did the money go?' It was all right there.", name:"Ndey F.", role:"campaigner" as const, location:"Gunjur", rating:5 },
            ].map((t, i) => (
              <div key={t.id} style={{ background: "#0f1929", border: "1px solid #1e2636", borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Stars */}
                <div style={{ color: "#f2a93b", fontSize: 13, letterSpacing: 2 }}>
                  {"★".repeat(t.rating)}{"☆".repeat(5 - t.rating)}
                </div>
                {/* Quote */}
                <p style={{ color: "#c8d0dc", fontSize: 14, lineHeight: 1.65, margin: 0, flexGrow: 1 }}>
                  &ldquo;{t.quote}&rdquo;
                </p>
                {/* Footer */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: ["#16B7F0","#0B82BD"][i % 2], display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                    {t.name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ color: "#f5f7fa", fontSize: 13, fontWeight: 600 }}>{t.name}</div>
                    <div style={{ color: "#8c9ab3", fontSize: 11 }}>
                      {t.role === "donor" ? "Donor" : "Campaign organizer"} · {t.location}
                    </div>
                  </div>
                  <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, color: "#16b7f0", background: "rgba(22,183,240,0.1)", padding: "3px 8px", borderRadius: 6, whiteSpace: "nowrap" }}>
                    {t.role === "donor" ? "Verified donor" : "KYC verified"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          §6  PAYMENT METHODS
      ══════════════════════════════════════════════ */}
      <section style={{ padding: "96px clamp(16px, 5vw, 72px)", borderTop: "1px solid rgba(255,255,255,0.05)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 60% 40% at 50% 100%, rgba(99,102,241,0.06) 0%, transparent 70%)" }} />
        <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <motion.div {...fadeUp(0)} style={{ textAlign: "center", marginBottom: 56 }}>
            <SectionLabel color="#a5b4fc">Pay your way</SectionLabel>
            <h2 style={{ fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 900, color: "#f0f6ff", margin: "0 0 14px", letterSpacing: "-0.04em", lineHeight: 1.07 }}>
              However You Want to Give,<br />We&apos;ve Got You
            </h2>
            <p style={{ color: "#8899aa", fontSize: 16, maxWidth: 460, margin: "0 auto", lineHeight: 1.75 }}>
              Choose the payment method that works for you. All transactions are secure, encrypted, and instant.
            </p>
          </motion.div>

          <div className="pay-grid" style={{ display: "grid", gap: 16 }}>
            {[
              {
                label: "Wave Mobile Money", tagline: "Scan & Pay — most popular",
                desc: "Scan the QR code or enter your number to pay via Wave. Funds land directly in the campaigner's Wave wallet — no intermediary, no delay.",
                color: BLUE, glow: `${BLUE}1a`, border: `${BLUE}35`,
                icon: <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="8" height="8" rx="1.5" stroke={BLUE} strokeWidth="1.8"/><rect x="3" y="13" width="8" height="8" rx="1.5" stroke={BLUE} strokeWidth="1.8"/><rect x="13" y="3" width="8" height="8" rx="1.5" stroke={BLUE} strokeWidth="1.8"/><rect x="5" y="5" width="4" height="4" rx="0.5" fill={BLUE}/><rect x="5" y="15" width="4" height="4" rx="0.5" fill={BLUE}/><rect x="15" y="5" width="4" height="4" rx="0.5" fill={BLUE}/><path d="M13 13h2v2h-2zM17 13h4M13 17h4M17 17v4" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round"/></svg>,
              },
              {
                label: "APS Mobile Money", tagline: "Pay with APS / Afrimoney",
                desc: "Pay with your APS or Afrimoney balance directly from your phone. No card needed — just your mobile number.",
                color: "#f59e0b", glow: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)",
                icon: <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><rect x="5" y="2" width="14" height="20" rx="3" stroke="#f59e0b" strokeWidth="1.8"/><path d="M9 18h6" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round"/><path d="M8 8h8M8 11h5" stroke="#f59e0b" strokeWidth="1.6" strokeLinecap="round"/></svg>,
              },
              {
                label: "Visa & Mastercard", tagline: "Secure card checkout via Stripe",
                desc: "Pay with any major credit or debit card. Processed by Stripe — PCI DSS compliant, 3D Secure, encrypted end-to-end.",
                color: "#a5b4fc", glow: "rgba(99,102,241,0.12)", border: "rgba(99,102,241,0.3)",
                icon: <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="3" stroke="#a5b4fc" strokeWidth="1.8"/><path d="M2 10h20" stroke="#a5b4fc" strokeWidth="1.8"/><path d="M6 15h4M14 15h4" stroke="#a5b4fc" strokeWidth="1.6" strokeLinecap="round"/></svg>,
              },
            ].map(({ label, tagline, desc, color, glow, border, icon }, i) => (
              <motion.div key={label} {...fadeUp(0.08 * i)} style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: "36px 28px", position: "relative", overflow: "hidden", transition: "border-color 0.3s, box-shadow 0.3s" }}
                whileHover={{ borderColor: border, boxShadow: `0 8px 40px ${glow}` } as object}
              >
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${color}, transparent)` }} />
                <div style={{ position: "absolute", bottom: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: `radial-gradient(circle, ${glow} 0%, transparent 70%)`, pointerEvents: "none" }} />
                <div style={{ width: 60, height: 60, borderRadius: 16, background: glow, border: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 22 }}>{icon}</div>
                <div style={{ fontSize: 11, color, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const, marginBottom: 6 }}>{tagline}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#f0f6ff", marginBottom: 12, letterSpacing: "-0.02em" }}>{label}</div>
                <div style={{ fontSize: 14, color: "#6b7a8d", lineHeight: 1.78 }}>{desc}</div>
              </motion.div>
            ))}
          </div>

          <motion.div {...fadeUp(0.3)} style={{ textAlign: "center", marginTop: 28 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 18px", borderRadius: 24, background: `${GREEN}10`, border: `1px solid ${GREEN}25`, fontSize: 13, color: "#6b7a8d" }}>
              <LockOutlined style={{ fontSize: 12, color: GREEN }} />
              All payments encrypted and processed by licensed, regulated payment partners.
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          §7  LIVE CAMPAIGNS GRID
      ══════════════════════════════════════════════ */}
      <section style={{ padding: "96px clamp(16px, 5vw, 72px)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <motion.div {...fadeUp(0)} style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap" as const, gap: 16, marginBottom: 40 }}>
            <div>
              <SectionLabel color="#f59e0b">Live now</SectionLabel>
              <h2 style={{ fontSize: "clamp(24px, 3.5vw, 38px)", fontWeight: 900, color: "#f0f6ff", margin: 0, letterSpacing: "-0.04em", lineHeight: 1.08 }}>
                Campaigns Raising<br />Money Right Now
              </h2>
            </div>
            <Link href="/campaigns" style={{ fontSize: 14, color: BLUE, fontWeight: 600, whiteSpace: "nowrap" as const }}>
              Browse all campaigns →
            </Link>
          </motion.div>

          {isLoading ? (
            <div className="campaigns-grid" style={{ display: "grid", gap: 16 }}>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} style={{ background: "#0d1120", borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
                  <div style={{ height: 160, background: "rgba(255,255,255,0.04)", animation: "shimmer 1.5s infinite" }} />
                  <div style={{ padding: 16 }}>
                    {[70, 50, 90].map((w) => <div key={w} style={{ height: 12, width: `${w}%`, background: "rgba(255,255,255,0.05)", borderRadius: 4, marginBottom: 8 }} />)}
                  </div>
                </div>
              ))}
            </div>
          ) : gridCampaigns.length > 0 ? (
            <div className="campaigns-grid" style={{ display: "grid", gap: 16 }}>
              {gridCampaigns.map((c, i) => {
                const pct = c.target_amount && c.target_amount > 0 ? Math.min(100, (c.amount_raised / c.target_amount) * 100) : 0;
                return (
                  <motion.div key={c.id} {...fadeUp(0.06 * i)} style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden", transition: "border-color 0.25s, transform 0.25s", cursor: "pointer" }}
                    whileHover={{ y: -4, borderColor: "rgba(29,197,255,0.25)" } as object}
                  >
                    <div style={{ position: "relative", height: 160, background: "#1a2333" }}>
                      {c.cover_image_url
                        ? <Image src={c.cover_image_url} alt={c.title} fill unoptimized sizes="380px" style={{ objectFit: "cover" }} />
                        : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #0d2340, #0a3d5c)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, fontWeight: 900, color: `${BLUE}40` }}>{c.title.charAt(0)}</div>
                      }
                      <div style={{ position: "absolute", top: 10, left: 10 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 12, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", color: GREEN, border: `1px solid ${GREEN}60` }}>● LIVE</span>
                      </div>
                    </div>
                    <div style={{ padding: "16px" }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#f0f6ff", marginBottom: 8, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>{c.title}</div>
                      {c.target_amount && c.target_amount > 0 && (
                        <div style={{ height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 2, marginBottom: 8, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${BLUE}, #079bd4)`, borderRadius: 2 }} />
                        </div>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: GREEN }}>{c.amount_raised.toLocaleString()} GMD</div>
                        <Link href={`/quick-pay/${c.slug}`}>
                          <button style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: `${BLUE}20`, color: BLUE, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Donate</button>
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "48px 0", color: "#4a5568", fontSize: 15 }}>No campaigns yet — <Link href="/auth/signup" style={{ color: BLUE }}>start the first one</Link>.</div>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          §8  FINAL CTA  (loader loop bg video)
      ══════════════════════════════════════════════ */}
      <section className="cta-section" style={{ padding: "0 clamp(16px, 5vw, 72px) 96px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <motion.div {...fadeUp(0)} style={{
            position: "relative", overflow: "hidden",
            borderRadius: 24, padding: "88px clamp(24px, 5vw, 80px)",
            background: "linear-gradient(135deg, rgba(29,197,255,0.1) 0%, rgba(7,155,212,0.06) 100%)",
            border: "1px solid rgba(29,197,255,0.18)",
          }}>
            {/* Loader loop video as atmospheric background */}
            <video autoPlay muted loop playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.06, mixBlendMode: "screen" }}>
              <source src="/loader-loop.webm" type="video/webm" />
            </video>
            <div style={{ position: "absolute", width: 600, height: 600, background: "radial-gradient(circle, rgba(29,197,255,0.18) 0%, transparent 70%)", left: "-15%", top: "-60%", pointerEvents: "none" }} />
            <div style={{ position: "absolute", width: 400, height: 400, background: "radial-gradient(circle, rgba(27,191,136,0.12) 0%, transparent 70%)", right: "5%", bottom: "-50%", pointerEvents: "none" }} />

            <div style={{ position: "relative", zIndex: 1, textAlign: "center", maxWidth: 620, margin: "0 auto" }}>
              <div style={{ fontSize: 12, color: BLUE, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 18 }}>Start now</div>
              <h2 style={{ fontSize: "clamp(28px, 4.5vw, 50px)", fontWeight: 900, color: "#f0f6ff", margin: "0 0 18px", letterSpacing: "-0.04em", lineHeight: 1.05 }}>
                Your First Donation<br />Takes Less Than 2 Minutes
              </h2>
              <p style={{ color: "#8899aa", fontSize: 16, margin: "0 0 40px", lineHeight: 1.78, maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
                Browse a verified campaign, choose Wave, APS, or card, and see exactly where your money goes. No account. No app download. No hassle.
              </p>
              <div className="cta-buttons" style={{ display: "flex", gap: 14, flexWrap: "wrap" as const, justifyContent: "center" }}>
                <Link href="/campaigns" className="cta-btn-link">
                  <button style={{ padding: "16px 36px", borderRadius: 12, border: "none", background: `linear-gradient(135deg, ${BLUE}, #079bd4)`, color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer", boxShadow: "0 8px 32px rgba(29,197,255,0.4)", width: "100%", whiteSpace: "nowrap" as const }}>
                    Browse Campaigns →
                  </button>
                </Link>
                <Link href="/auth/signup" className="cta-btn-link">
                  <button style={{ padding: "16px 36px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)", color: "#f0f6ff", fontSize: 16, fontWeight: 600, cursor: "pointer", width: "100%", whiteSpace: "nowrap" as const }}>
                    Start a Campaign
                  </button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <style>{`
        @keyframes shimmer { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .trust-grid { grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); }
        .pay-grid { grid-template-columns: repeat(3, 1fr); }
        .steps-grid { grid-template-columns: repeat(4, 1fr); }
        .campaigns-grid { grid-template-columns: repeat(3, 1fr); }
        .testimonials-grid { grid-template-columns: repeat(3, 1fr); }
        @media (max-width: 1024px) {
          .steps-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .steps-connector { display: none !important; }
          .campaigns-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .testimonials-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 900px) {
          .pay-grid { grid-template-columns: 1fr !important; }
          .impact-video { flex: 0 0 100% !important; min-height: 220px !important; }
        }
        @media (max-width: 640px) {
          .hero-section { min-height: unset !important; padding: 28px clamp(16px, 5vw, 72px) 40px !important; }
          .hero-video-card { display: none !important; }
          .hero-more-campaigns { display: none !important; }
          .featured-card { aspect-ratio: unset !important; height: 240px !important; }
          .trust-section { padding: 48px clamp(16px, 5vw, 72px) !important; }
          .trust-header { flex-direction: column !important; }
          .trust-tagline { display: none !important; }
          .trust-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .trust-card { padding: 18px 12px !important; }
          .trust-desc { display: -webkit-box !important; -webkit-line-clamp: 2 !important; -webkit-box-orient: vertical !important; overflow: hidden !important; margin-bottom: 12px !important; }
          .steps-grid { grid-template-columns: 1fr !important; }
          .campaigns-grid { grid-template-columns: 1fr !important; }
          .testimonials-grid { grid-template-columns: 1fr !important; }
          .cta-buttons { flex-direction: column !important; }
          .cta-btn-link { width: 100% !important; display: block !important; }
          .cta-section { padding: 0 clamp(16px, 5vw, 72px) 48px !important; }
        }
      `}</style>
    </div>
  );
}
