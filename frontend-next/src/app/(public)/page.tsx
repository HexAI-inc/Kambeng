"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { CameraOutlined, StarOutlined, LockOutlined } from "@ant-design/icons";
import { useHomeFeed, useSessionProfile } from "@/hooks/use-frontend-data";

const BLUE = "#1dc5ff";
const GREEN = "#1bbf88";

function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 22 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, delay, ease: "easeOut" as const },
  };
}

function fadeIn(delay = 0) {
  return {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.6, delay, ease: "easeOut" as const },
  };
}

/* Animated counting number */
function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView || to === 0) return;
    const duration = 1400;
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

  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

function StatPill({ value, label, raw }: { value: string; label: string; raw: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  return (
    <div ref={ref} style={{ textAlign: "center" }}>
      <div style={{ fontSize: "clamp(15px, 2vw, 21px)", fontWeight: 800, color: "#f0f6ff", lineHeight: 1, letterSpacing: "-0.03em" }}>
        {inView && raw > 0 ? <CountUp to={raw} suffix={value.replace(/[\d,]/g, "")} /> : value}
      </div>
      <div style={{ fontSize: 11, color: "#8899aa", marginTop: 3, fontWeight: 500 }}>{label}</div>
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
    ? Math.min(100, (campaign.amount_raised / campaign.target_amount) * 100)
    : 0;
  const hasTarget = campaign.target_amount && campaign.target_amount > 0;

  return (
    <motion.div {...fadeUp(0.2)} className="featured-card" style={{
      position: "relative",
      borderRadius: 20,
      overflow: "hidden",
      maxWidth: 400,
      width: "100%",
      aspectRatio: "4/5",
      boxShadow: `
        0 2px 0 rgba(255,255,255,0.06),
        0 4px 8px rgba(0,0,0,0.4),
        0 16px 40px rgba(0,0,0,0.5),
        0 32px 80px rgba(0,0,0,0.4),
        0 0 0 1px rgba(255,255,255,0.06)
      `,
    }}
      whileHover={{ y: -6, boxShadow: `
        0 2px 0 rgba(255,255,255,0.06),
        0 8px 16px rgba(0,0,0,0.45),
        0 24px 60px rgba(0,0,0,0.55),
        0 48px 100px rgba(0,0,0,0.4),
        0 0 0 1px rgba(29,197,255,0.2),
        0 0 40px rgba(29,197,255,0.08)
      ` }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <Image
        src={campaign.cover_image_url ?? "/sample.png"}
        alt={campaign.title}
        fill unoptimized sizes="400px"
        style={{ objectFit: "cover", objectPosition: "center 15%" }}
      />
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.65) 55%, rgba(0,0,0,0.97) 100%)",
      }} />

      {/* Badges */}
      <div style={{ position: "absolute", top: 14, left: 14, right: 14, zIndex: 2, display: "flex", justifyContent: "space-between" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(10px)", border: "1px solid rgba(27,191,136,0.5)" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#1bbf88", boxShadow: "0 0 6px #1bbf88", display: "inline-block" }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: "#1bbf88", letterSpacing: "0.05em" }}>LIVE</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(10px)", border: "1px solid rgba(29,197,255,0.35)" }}>
          <svg width="12" height="13" viewBox="0 0 13 14" fill="none">
            <path d="M6.5 0.5L1 2.5V6.5C1 9.538 3.44 12.376 6.5 13.5C9.56 12.376 12 9.538 12 6.5V2.5L6.5 0.5Z" fill="rgba(29,197,255,0.15)" stroke={BLUE} strokeWidth="1" strokeLinejoin="round"/>
            <path d="M4 7L5.8 8.8L9 5.5" stroke={BLUE} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontSize: 11, fontWeight: 600, color: BLUE }}>Verified</span>
        </div>
      </div>

      {/* Content */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 2, padding: "16px" }}>
        <Link href={`/campaigns/${campaign.slug}`}>
          <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: "#fff", lineHeight: 1.25, letterSpacing: "-0.02em", cursor: "pointer" }}>
            {campaign.title}
          </h3>
        </Link>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", marginBottom: 12 }}>
          <span style={{ fontWeight: 700, color: "#fff", fontSize: 15 }}>{campaign.amount_raised.toLocaleString()} GMD</span>
          {hasTarget && <span> raised · {Math.round(pct)}% of goal</span>}
        </div>
        {hasTarget && (
          <div style={{ height: 3, background: "rgba(255,255,255,0.15)", borderRadius: 2, marginBottom: 14, overflow: "hidden" }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 1, delay: 0.4, ease: "easeOut" }}
              style={{ height: "100%", background: `linear-gradient(90deg, ${BLUE}, #079bd4)`, borderRadius: 2 }}
            />
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
      <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, cursor: "pointer", transition: "border-color 0.2s, background 0.2s" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(29,197,255,0.25)"; (e.currentTarget as HTMLDivElement).style.background = "rgba(29,197,255,0.05)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)"; }}
      >
        <div style={{ width: 48, height: 48, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: "#1a2333", position: "relative" }}>
          {campaign.cover_image_url ? (
            <Image src={campaign.cover_image_url} alt={campaign.title} fill unoptimized sizes="48px" style={{ objectFit: "cover" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #0d2340, #0a3d5c)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: BLUE }}>
              {campaign.title.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#f0f6ff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 4 }}>
            {campaign.title}
          </div>
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
  const otherCampaigns = campaigns.slice(1, 4);

  const fmt = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1000 ? `${(n / 1000).toFixed(0)}K`
    : String(n);

  return (
    <div style={{ background: "#0a0f1a" }}>

      {/* ── HERO ── */}
      <section className="hero-section" style={{
        position: "relative", overflow: "hidden",
        minHeight: "calc(100vh - 68px)",
        display: "flex", alignItems: "center",
        padding: "40px clamp(16px, 5vw, 72px)",
      }}>
        {/* Background glows */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
          <div style={{ position: "absolute", width: 800, height: 800, background: "radial-gradient(circle, rgba(29,197,255,0.1) 0%, transparent 65%)", left: "-20%", top: "-20%" }} />
          <div style={{ position: "absolute", width: 500, height: 500, background: "radial-gradient(circle, rgba(27,191,136,0.06) 0%, transparent 70%)", right: "5%", bottom: "10%" }} />
          <div style={{ position: "absolute", inset: 0, opacity: 0.02, backgroundImage: `linear-gradient(rgba(29,197,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(29,197,255,1) 1px, transparent 1px)`, backgroundSize: "64px 64px" }} />
        </div>

        <div style={{ position: "relative", zIndex: 1, maxWidth: 1200, margin: "0 auto", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "clamp(32px, 6vw, 80px)", flexWrap: "wrap" }}>

            {/* ── LEFT ── */}
            <div style={{ flex: "1 1 420px", minWidth: 0 }}>

              {/* Multi-payment trust bar */}
              <motion.div {...fadeIn(0)} style={{ marginBottom: 22 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 24, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, color: "#6b7a8d", fontWeight: 600 }}>🇬🇲 Trusted by Gambians</span>
                  <span style={{ width: 1, height: 14, background: "rgba(255,255,255,0.1)" }} />
                  {[
                    { label: "Wave", color: BLUE, bg: "rgba(29,197,255,0.12)", border: "rgba(29,197,255,0.25)" },
                    { label: "APS", color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.25)" },
                    { label: "Visa / MC", color: "#a5b4fc", bg: "rgba(99,102,241,0.12)", border: "rgba(99,102,241,0.25)" },
                  ].map(({ label, color, bg, border }) => (
                    <span key={label} style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, color, background: bg, border: `1px solid ${border}`, letterSpacing: "0.05em" }}>{label}</span>
                  ))}
                </div>
              </motion.div>

              {/* Headline */}
              <motion.h1 {...fadeUp(0.06)} style={{ fontSize: "clamp(34px, 5vw, 62px)", fontWeight: 900, lineHeight: 1.04, letterSpacing: "-0.04em", color: "#f0f6ff", margin: "0 0 16px" }}>
                Real Causes.<br />
                Real Proof.<br />
                <span style={{ color: BLUE, textShadow: `0 0 48px rgba(29,197,255,0.5)` }}>Real Gambians.</span>
              </motion.h1>

              <motion.p {...fadeUp(0.14)} style={{ fontSize: "clamp(14px, 1.6vw, 16px)", color: "#8899aa", lineHeight: 1.75, maxWidth: 460, margin: "0 0 28px" }}>
                Donate to verified campaigns in seconds — with Wave, APS Mobile Money, or your card. Every dalasi tracked, every campaigner ID-verified, every receipt public.
              </motion.p>

              {/* CTAs */}
              <motion.div {...fadeUp(0.2)} style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
                <Link href="/campaigns">
                  <button style={{ padding: "14px 28px", borderRadius: 12, border: "none", background: `linear-gradient(135deg, ${BLUE}, #079bd4)`, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 8px 28px rgba(29,197,255,0.35)", transition: "opacity 0.2s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.88"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}>
                    Donate to a Campaign →
                  </button>
                </Link>
                <Link href={isLoggedIn ? "/dashboard" : "/auth/signup"}>
                  <button style={{ padding: "14px 28px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.05)", color: "#f0f6ff", fontSize: 15, fontWeight: 600, cursor: "pointer", transition: "border-color 0.2s, background 0.2s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(29,197,255,0.3)"; e.currentTarget.style.background = "rgba(29,197,255,0.06)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)"; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}>
                    {isLoggedIn ? "My Dashboard" : "Start Your Own Campaign"}
                  </button>
                </Link>
              </motion.div>

              <motion.p {...fadeUp(0.24)} style={{ fontSize: 12, color: "#4a5568", marginBottom: 28, fontWeight: 500 }}>
                No account needed to donate · Takes under 2 minutes
              </motion.p>

              {/* Trust pills */}
              <motion.div {...fadeUp(0.28)} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28 }}>
                {[
                  { icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 2L3 6v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V6l-9-4z" fill="rgba(27,191,136,0.2)" stroke="#1bbf88" strokeWidth="1.5"/><path d="M9 12l2 2 4-4" stroke="#1bbf88" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>, label: "KYC Verified Campaigners" },
                  { icon: <CameraOutlined style={{ fontSize: 12, color: "#1bbf88" }} />, label: "Proof of Expenditure" },
                  { icon: <StarOutlined style={{ fontSize: 12, color: "#fbbf24" }} />, label: "Donor Reviews" },
                ].map(({ icon, label }) => (
                  <div key={label} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 20, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", fontSize: 12, color: "#8899aa", fontWeight: 500 }}>
                    {icon}{label}
                  </div>
                ))}
              </motion.div>

              {/* Live stats */}
              <motion.div {...fadeUp(0.34)}>
                <div style={{ fontSize: 10, color: "#4a5568", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 12, textTransform: "uppercase" }}>
                  Platform activity
                </div>
                <div style={{ display: "flex", gap: 0, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden" }}>
                  {[
                    { v: isLoading ? "—" : `${fmt(stats?.total_raised ?? 0)} GMD`, l: "Total Raised", raw: stats?.total_raised ?? 0 },
                    { v: isLoading ? "—" : String(stats?.active_campaigns ?? 0), l: "Live Campaigns", raw: stats?.active_campaigns ?? 0 },
                    { v: isLoading ? "—" : String(stats?.successful_donations ?? 0), l: "Donations", raw: stats?.successful_donations ?? 0 },
                  ].map(({ v, l, raw }, i, arr) => (
                    <div key={l} style={{ flex: 1, padding: "14px 12px", textAlign: "center", borderRight: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                      <StatPill value={v} label={l} raw={raw} />
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* ── RIGHT: video + featured campaign + more ── */}
            <div style={{ flex: "0 1 420px", display: "flex", flexDirection: "column", gap: 16, minWidth: 300 }}>

              {/* Logo reveal video card */}
              <motion.div {...fadeIn(0.1)} className="hero-video-card" style={{
                borderRadius: 16,
                overflow: "hidden",
                background: "#0d1120",
                border: "1px solid rgba(29,197,255,0.15)",
                boxShadow: "0 8px 40px rgba(29,197,255,0.1)",
                position: "relative",
                aspectRatio: "16/7",
              }}>
                <video
                  autoPlay muted loop playsInline
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                >
                  <source src="/logo-reveal.mp4" type="video/mp4" />
                </video>
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(10,15,26,0.3) 0%, transparent 60%)", pointerEvents: "none" }} />
              </motion.div>

              {/* Featured campaign card */}
              {isLoading ? (
                <div style={{ background: "#111827", borderRadius: 20, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)", maxWidth: 420, width: "100%" }}>
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

              {/* More campaigns */}
              {otherCampaigns.length > 0 && !isLoading && (
                <motion.div {...fadeUp(0.35)} className="hero-more-campaigns" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 10, color: "#4a5568", fontWeight: 700, letterSpacing: "0.09em", marginBottom: 4, textTransform: "uppercase" }}>More campaigns</div>
                  {otherCampaigns.map((c) => <SmallCampaignCard key={c.id} campaign={c} />)}
                  <Link href="/campaigns" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, fontSize: 13, color: "#8899aa", fontWeight: 500, transition: "color 0.2s" }}>
                    View all campaigns →
                  </Link>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── PAYMENT METHODS ── */}
      <section style={{ padding: "88px clamp(16px, 5vw, 72px)", borderTop: "1px solid rgba(255,255,255,0.05)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(29,197,255,0.04) 0%, transparent 60%)" }} />
        <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <motion.div {...fadeUp(0)} style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "4px 14px", borderRadius: 20, background: "rgba(29,197,255,0.08)", border: "1px solid rgba(29,197,255,0.2)", fontSize: 11, color: BLUE, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>
              <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill={BLUE}/></svg>
              Pay your way
            </div>
            <h2 style={{ fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 900, color: "#f0f6ff", margin: "0 0 14px", letterSpacing: "-0.04em", lineHeight: 1.07 }}>
              However You Want to Give,<br />We&apos;ve Got You
            </h2>
            <p style={{ color: "#8899aa", fontSize: 16, maxWidth: 480, margin: "0 auto", lineHeight: 1.7 }}>
              Choose the payment method that works for you. All transactions are secure and instant.
            </p>
          </motion.div>

          <div className="pay-grid" style={{ display: "grid", gap: 16 }}>
            {[
              {
                label: "Wave Mobile Money",
                tagline: "Scan & Pay",
                desc: "Scan the QR code or pay via Wave. Funds land directly in the campaigner's wallet — instant, no intermediary.",
                color: BLUE,
                glow: "rgba(29,197,255,0.12)",
                border: "rgba(29,197,255,0.2)",
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="8" height="8" rx="1.5" stroke={BLUE} strokeWidth="1.8"/>
                    <rect x="3" y="13" width="8" height="8" rx="1.5" stroke={BLUE} strokeWidth="1.8"/>
                    <rect x="13" y="3" width="8" height="8" rx="1.5" stroke={BLUE} strokeWidth="1.8"/>
                    <path d="M13 13h2v2h-2zM17 13h4M13 17h4M17 17v4" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round"/>
                    <rect x="5" y="5" width="4" height="4" rx="0.5" fill={BLUE}/>
                    <rect x="5" y="15" width="4" height="4" rx="0.5" fill={BLUE}/>
                    <rect x="15" y="5" width="4" height="4" rx="0.5" fill={BLUE}/>
                  </svg>
                ),
              },
              {
                label: "APS Mobile Money",
                tagline: "Pay with APS / Afrimoney",
                desc: "Pay with your APS or Afrimoney balance in a few taps. No card needed — just your phone number.",
                color: "#f59e0b",
                glow: "rgba(245,158,11,0.12)",
                border: "rgba(245,158,11,0.2)",
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <rect x="5" y="2" width="14" height="20" rx="3" stroke="#f59e0b" strokeWidth="1.8"/>
                    <path d="M9 18h6" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round"/>
                    <path d="M8 8h8M8 11h5" stroke="#f59e0b" strokeWidth="1.6" strokeLinecap="round"/>
                  </svg>
                ),
              },
              {
                label: "Card Payment",
                tagline: "Visa & Mastercard via Stripe",
                desc: "Securely pay with any major credit or debit card. Processed by Stripe — PCI compliant, encrypted end-to-end.",
                color: "#a5b4fc",
                glow: "rgba(99,102,241,0.12)",
                border: "rgba(99,102,241,0.2)",
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <rect x="2" y="5" width="20" height="14" rx="3" stroke="#a5b4fc" strokeWidth="1.8"/>
                    <path d="M2 10h20" stroke="#a5b4fc" strokeWidth="1.8"/>
                    <path d="M6 15h4M14 15h4" stroke="#a5b4fc" strokeWidth="1.6" strokeLinecap="round"/>
                  </svg>
                ),
              },
            ].map(({ label, tagline, desc, color, glow, border, icon }, i) => (
              <motion.div key={label} {...fadeUp(0.08 * i)} style={{
                background: "#0d1120",
                border: `1px solid rgba(255,255,255,0.07)`,
                borderRadius: 20,
                padding: "32px 28px",
                position: "relative",
                overflow: "hidden",
                cursor: "default",
                transition: "border-color 0.3s, box-shadow 0.3s",
              }}
                whileHover={{ borderColor: border, boxShadow: `0 8px 40px ${glow}` } as object}
              >
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${color}, transparent)`, borderRadius: "2px 2px 0 0" }} />
                <div style={{ position: "absolute", bottom: -60, right: -60, width: 180, height: 180, borderRadius: "50%", background: `radial-gradient(circle, ${glow} 0%, transparent 70%)`, pointerEvents: "none" }} />

                <div style={{ width: 56, height: 56, borderRadius: 14, background: glow, border: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                  {icon}
                </div>

                <div style={{ fontSize: 11, color, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6 }}>{tagline}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#f0f6ff", marginBottom: 12, letterSpacing: "-0.02em" }}>{label}</div>
                <div style={{ fontSize: 14, color: "#6b7a8d", lineHeight: 1.75 }}>{desc}</div>
              </motion.div>
            ))}
          </div>

          {/* Trust microcopy */}
          <motion.div {...fadeUp(0.3)} style={{ textAlign: "center", marginTop: 32 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 18px", borderRadius: 24, background: "rgba(27,191,136,0.07)", border: "1px solid rgba(27,191,136,0.15)", fontSize: 13, color: "#6b7a8d" }}>
              <LockOutlined style={{ fontSize: 12, color: GREEN }} />
              All payments are encrypted and processed by licensed, secure payment partners.
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── TRUST SECTION ── */}
      <section className="trust-section" style={{ padding: "88px clamp(16px, 5vw, 72px)", borderTop: "1px solid rgba(255,255,255,0.05)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", width: 600, height: 600, background: "radial-gradient(circle, rgba(27,191,136,0.05) 0%, transparent 70%)", right: "-10%", top: "0%", pointerEvents: "none" }} />

        <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div className="trust-header" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 24, marginBottom: 56 }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "4px 12px", borderRadius: 20, background: "rgba(27,191,136,0.08)", border: "1px solid rgba(27,191,136,0.2)", fontSize: 11, color: "#1bbf88", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>
                <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="#1bbf88"/></svg>
                Built on trust
              </div>
              <h2 style={{ fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 900, color: "#f0f6ff", margin: "0", letterSpacing: "-0.04em", lineHeight: 1.05 }}>
                You&apos;ll Never Wonder<br />Where Your Money Went
              </h2>
            </div>
            <p className="trust-tagline" style={{ color: "#8899aa", fontSize: 15, maxWidth: 360, margin: 0, lineHeight: 1.75 }}>
              Every campaign comes with verified identity, photo proof, and spending receipts — because asking &ldquo;did this actually help?&rdquo; shouldn&apos;t be necessary.
            </p>
          </div>

          <div className="trust-grid" style={{ display: "grid", gap: 2, background: "rgba(255,255,255,0.04)", borderRadius: 20, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" }}>
            {[
              {
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="13" rx="2" stroke="#1bbf88" strokeWidth="1.8"/><circle cx="8.5" cy="11.5" r="2" stroke="#1bbf88" strokeWidth="1.6"/><path d="M5 19c0-2 1.5-3 3.5-3s3.5 1 3.5 3" stroke="#1bbf88" strokeWidth="1.6" strokeLinecap="round"/><path d="M14 10h4M14 13.5h2.5" stroke="#1bbf88" strokeWidth="1.6" strokeLinecap="round"/></svg>,
                accent: "#1bbf88", glow: "rgba(27,191,136,0.1)", border: "rgba(27,191,136,0.18)",
                title: "100% ID-Verified", label: "KYC Verified Identity",
                desc: "Every campaigner submits a government ID and is manually verified before they can raise a single dalasi. No anonymous accounts, no fake campaigns.",
                stat: "100%", statLabel: "verified",
              },
              {
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke={BLUE} strokeWidth="1.8"/><circle cx="12" cy="12" r="3.5" stroke={BLUE} strokeWidth="1.6"/><circle cx="12" cy="12" r="1" fill={BLUE}/><path d="M5 7h2M17 7h2" stroke={BLUE} strokeWidth="1.4" strokeLinecap="round"/></svg>,
                accent: BLUE, glow: "rgba(29,197,255,0.1)", border: "rgba(29,197,255,0.15)",
                title: "Public Proof", label: "Photo & Receipt Proof",
                desc: "Campaigners upload photos and receipts showing exactly how funds were spent — visible to every donor, forever. If a campaigner can't show proof, you'll see it.",
                stat: "Public", statLabel: "to everyone",
              },
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M3 10h18M7 15h2M11 15h4" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round"/>
                    <rect x="2" y="6" width="20" height="13" rx="3" stroke="#f59e0b" strokeWidth="1.8"/>
                  </svg>
                ),
                accent: "#f59e0b", glow: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.18)",
                title: "3 Ways to Pay", label: "Wave · APS · Visa/Mastercard",
                desc: "Donate instantly with Wave, APS Mobile Money, or a Visa/Mastercard via secure card checkout. No app required, no waiting.",
                stat: "3", statLabel: "payment rails",
              },
              {
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2Z" stroke="#a855f7" strokeWidth="1.7" strokeLinejoin="round"/></svg>,
                accent: "#a855f7", glow: "rgba(168,85,247,0.1)", border: "rgba(168,85,247,0.15)",
                title: "Always Visible", label: "Public Donor Reviews",
                desc: "Donors rate and review every campaign publicly. A campaigner's track record is permanent — good or bad. Accountability you can see.",
                stat: "Always", statLabel: "visible",
              },
            ].map(({ icon, accent, glow, border, title, label, desc, stat, statLabel }) => (
              <div key={title} className="trust-card" style={{ padding: "32px 28px", background: "#0d1120", position: "relative", cursor: "default", transition: "background 0.3s" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = glow; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#0d1120"; }}
              >
                <div style={{ position: "absolute", top: 0, left: 28, right: 28, height: 2, background: `linear-gradient(90deg, ${accent}, transparent)`, borderRadius: "0 0 2px 2px" }} />
                <div style={{ width: 48, height: 48, borderRadius: 12, background: glow, border: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>{icon}</div>
                <div style={{ fontSize: 11, color: accent, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4 }}>{title}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#f0f6ff", marginBottom: 8, letterSpacing: "-0.01em" }}>{label}</div>
                <div className="trust-desc" style={{ fontSize: 13, color: "#6b7a8d", lineHeight: 1.75, marginBottom: 20 }}>{desc}</div>
                <div style={{ display: "inline-flex", alignItems: "baseline", gap: 5, padding: "4px 10px", borderRadius: 8, background: glow, border: `1px solid ${border}` }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: accent }}>{stat}</span>
                  <span style={{ fontSize: 11, color: "#4a5568" }}>{statLabel}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="cta-section" style={{ padding: "0 clamp(16px, 5vw, 72px) 96px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <motion.div {...fadeUp(0)} style={{
            position: "relative", overflow: "hidden",
            background: "linear-gradient(135deg, rgba(29,197,255,0.1) 0%, rgba(7,155,212,0.06) 100%)",
            border: "1px solid rgba(29,197,255,0.18)",
            borderRadius: 24, padding: "72px clamp(24px, 5vw, 80px)",
          }}>
            <div style={{ position: "absolute", width: 500, height: 500, background: "radial-gradient(circle, rgba(29,197,255,0.18) 0%, transparent 70%)", left: "-10%", top: "-60%", pointerEvents: "none" }} />
            <div style={{ position: "absolute", width: 300, height: 300, background: "radial-gradient(circle, rgba(27,191,136,0.1) 0%, transparent 70%)", right: "5%", bottom: "-40%", pointerEvents: "none" }} />

            <div style={{ position: "relative", zIndex: 1, textAlign: "center", maxWidth: 600, margin: "0 auto" }}>
              <div style={{ fontSize: 13, color: BLUE, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>Start now</div>
              <h2 style={{ fontSize: "clamp(26px, 4vw, 44px)", fontWeight: 900, color: "#f0f6ff", margin: "0 0 16px", letterSpacing: "-0.04em", lineHeight: 1.07 }}>
                Your First Donation Takes<br />Less Than 2 Minutes
              </h2>
              <p style={{ color: "#8899aa", fontSize: 16, margin: "0 0 36px", lineHeight: 1.75 }}>
                Browse a verified campaign, choose Wave, APS, or card, and see exactly where your money goes. No account, no app download, no hassle.
              </p>
              <div className="cta-buttons" style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
                <Link href="/campaigns" className="cta-btn-link">
                  <button style={{ padding: "15px 32px", borderRadius: 12, border: "none", background: `linear-gradient(135deg, ${BLUE}, #079bd4)`, color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer", boxShadow: "0 8px 32px rgba(29,197,255,0.4)", width: "100%" }}>
                    Browse Campaigns →
                  </button>
                </Link>
                <Link href="/auth/signup" className="cta-btn-link">
                  <button style={{ padding: "15px 32px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)", color: "#f0f6ff", fontSize: 16, fontWeight: 600, cursor: "pointer", width: "100%" }}>
                    Start a Campaign
                  </button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <style>{`
        @keyframes shimmer {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .trust-grid { grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); }
        .pay-grid { grid-template-columns: repeat(3, 1fr); }
        @media (max-width: 900px) {
          .pay-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 640px) {
          .hero-section { min-height: unset !important; padding: 28px clamp(16px, 5vw, 72px) 40px !important; }
          .trust-section { padding: 48px clamp(16px, 5vw, 72px) !important; }
          .trust-header { margin-bottom: 28px !important; }
          .trust-grid { grid-template-columns: repeat(2, 1fr); }
          .trust-card { padding: 18px 12px !important; }
          .trust-tagline { display: none !important; }
          .trust-desc { display: -webkit-box !important; -webkit-line-clamp: 2 !important; -webkit-box-orient: vertical !important; overflow: hidden !important; margin-bottom: 12px !important; }
          .featured-card { aspect-ratio: unset !important; height: 240px !important; }
          .hero-more-campaigns { display: none !important; }
          .hero-video-card { display: none !important; }
          .cta-buttons { flex-direction: column !important; }
          .cta-btn-link { width: 100% !important; display: block !important; }
          .cta-section { padding: 0 clamp(16px, 5vw, 72px) 40px !important; }
        }
      `}</style>
    </div>
  );
}
