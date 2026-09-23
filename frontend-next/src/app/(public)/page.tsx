"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { LockOutlined } from "@ant-design/icons";
import { useHomeFeed, useSessionProfile } from "@/hooks/use-frontend-data";
import EmailCaptureForm from "@/components/marketing/email-capture-form";
import { fmtCompact, fmtGMDShort } from "@/lib/fmt";

const BLUE = "#14784a";
const GREEN = "#1f9960";
const ORANGE = "#e8650f";
const ORANGE_INK = "#b9500b";

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

function CountUp({ to, format }: { to: number; format: (n: number) => string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView || to === 0) return;
    const duration = 1600;
    const start = Date.now();
    let frame = 0;
    const tick = () => {
      const progress = Math.min((Date.now() - start) / duration, 1);
      setVal(Math.round((1 - Math.pow(1 - progress, 3)) * to));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, to]);

  return <span ref={ref}>{format(val)}</span>;
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
      boxShadow: "0 1px 2px rgba(21,32,26,0.08), 0 18px 40px -16px rgba(21,32,26,0.35)",
    }}
      whileHover={{ y: -4, boxShadow: "0 2px 4px rgba(21,32,26,0.08), 0 28px 50px -18px rgba(21,32,26,0.45)" } as object}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <Image src={campaign.cover_image_url ?? "/sample.png"} alt={campaign.title} fill unoptimized sizes="400px" style={{ objectFit: "cover", objectPosition: "center 15%" }} />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "linear-gradient(to bottom, transparent 30%, rgba(12,28,20,0.6) 55%, rgba(10,24,17,0.94) 100%)" }} />
      <div style={{ position: "absolute", top: 14, left: 14, right: 14, zIndex: 2, display: "flex", justifyContent: "space-between" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, background: ORANGE }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", display: "inline-block" }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: "0.05em" }}>LIVE</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, background: "#fff" }}>
          <svg width="12" height="13" viewBox="0 0 13 14" fill="none">
            <path d="M6.5 0.5L1 2.5V6.5C1 9.538 3.44 12.376 6.5 13.5C9.56 12.376 12 9.538 12 6.5V2.5L6.5 0.5Z" fill="rgba(20,120,74,0.12)" stroke={BLUE} strokeWidth="1" strokeLinejoin="round"/>
            <path d="M4 7L5.8 8.8L9 5.5" stroke={BLUE} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontSize: 11, fontWeight: 600, color: BLUE }}>Verified</span>
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 2, padding: 16 }}>
        <Link href={`/campaigns/${campaign.slug}`}>
          <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: "#fff", lineHeight: 1.25, letterSpacing: "-0.02em", cursor: "pointer" }}>{campaign.title}</h3>
        </Link>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.78)", marginBottom: 12 }}>
          <span style={{ fontWeight: 700, color: "#fff", fontSize: 15 }}>{campaign.amount_raised.toLocaleString()} GMD</span>
          {hasTarget && <span> raised · {Math.round(pct)}% of goal</span>}
        </div>
        {hasTarget && (
          <div style={{ height: 4, background: "rgba(255,255,255,0.22)", borderRadius: 2, marginBottom: 14, overflow: "hidden" }}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, delay: 0.4, ease: "easeOut" }}
              style={{ height: "100%", background: ORANGE, borderRadius: 2 }} />
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Link href={`/quick-pay/${campaign.slug}`}>
            <button style={{ width: "100%", padding: "12px 0", borderRadius: 50, border: "none", background: `${BLUE}`, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 6px 16px -6px rgba(21,32,26,0.12)" }}>
              Donate now
            </button>
          </Link>
          <Link href={`/campaigns/${campaign.slug}`}>
            <button style={{ width: "100%", padding: "10px 0", borderRadius: 50, border: "1px solid rgba(255,255,255,0.3)", background: "transparent", color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
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
      <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 14px", background: "#fff", border: "1px solid rgba(21,32,26,0.08)", borderRadius: 12, cursor: "pointer", transition: "border-color 0.2s, background 0.2s" }}
        onMouseEnter={(e) => { const d = e.currentTarget as HTMLDivElement; d.style.borderColor = "rgba(20,120,74,0.25)"; d.style.background = "rgba(20,120,74,0.05)"; }}
        onMouseLeave={(e) => { const d = e.currentTarget as HTMLDivElement; d.style.borderColor = "rgba(21,32,26,0.08)"; d.style.background = "#fff"; }}
      >
        <div style={{ width: 48, height: 48, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: "#f1eee7", position: "relative" }}>
          {campaign.cover_image_url
            ? <Image src={campaign.cover_image_url} alt={campaign.title} fill unoptimized sizes="48px" style={{ objectFit: "cover" }} />
            : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #e6f4ec, #cfe8da)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: BLUE }}>{campaign.title.charAt(0)}</div>
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#15201a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 4 }}>{campaign.title}</div>
          <div style={{ height: 3, background: "rgba(21,32,26,0.07)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct ?? 0}%`, background: BLUE, borderRadius: 2 }} />
          </div>
          <div style={{ fontSize: 11, color: "#6e7872", marginTop: 3 }}>{campaign.amount_raised.toLocaleString()} GMD raised</div>
        </div>
        <span style={{ color: "#6e7872", fontSize: 12, flexShrink: 0 }}>→</span>
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

  const compactGMD = (n: number) => `${fmtCompact(n)} GMD`;
  const plain = (n: number) => n.toLocaleString("en-GB");

  return (
    <div>

      {/* ══════════════════════════════════════════════
          §1  HERO
      ══════════════════════════════════════════════ */}
      <section className="hero-section" style={{
        position: "relative", overflow: "hidden",
                display: "flex", alignItems: "center",
        padding: "56px clamp(16px, 5vw, 72px) 64px",
      }}>
        {/* Background */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
          <div style={{ position: "absolute", width: 900, height: 900, background: "radial-gradient(circle, rgba(20,120,74,0.08) 0%, transparent 60%)", left: "-25%", top: "-25%" }} />
          <div style={{ position: "absolute", width: 500, height: 500, background: "radial-gradient(circle, rgba(232,101,15,0.08) 0%, transparent 70%)", right: "5%", bottom: "5%" }} />
        </div>

        <div style={{ position: "relative", zIndex: 1, maxWidth: 1200, margin: "0 auto", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "clamp(32px, 6vw, 80px)", flexWrap: "wrap" }}>

            {/* Left */}
            <div style={{ flex: "1 1 420px", minWidth: 0 }}>
              {/* Payment trust bar */}
              <motion.div {...fadeIn(0)} style={{ marginBottom: 24 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 16px", borderRadius: 24, background: "#fff", border: "1px solid rgba(21,32,26,0.09)", flexWrap: "wrap" as const }}>
                  <span style={{ fontSize: 11, color: "#626d66", fontWeight: 600 }}>🇬🇲 Trusted by Gambians</span>
                  <span style={{ width: 1, height: 14, background: "rgba(21,32,26,0.1)", flexShrink: 0 }} />
                  {[
                    { label: "Wave", color: BLUE, bg: `${BLUE}14`, border: `${BLUE}40` },
                    { label: "APS", color: ORANGE_INK, bg: "rgba(232,101,15,0.1)", border: "rgba(232,101,15,0.3)" },
                    { label: "Visa / MC", color: "#4f46e5", bg: "rgba(99,102,241,0.15)", border: "rgba(99,102,241,0.35)" },
                  ].map(({ label, color, bg, border }) => (
                    <span key={label} style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 6, color, background: bg, border: `1px solid ${border}`, letterSpacing: "0.05em" }}>{label}</span>
                  ))}
                </div>
              </motion.div>

              <motion.h1 {...fadeUp(0.06)} style={{ fontSize: "clamp(36px, 5.5vw, 66px)", fontWeight: 900, lineHeight: 1.03, letterSpacing: "-0.04em", color: "#15201a", margin: "0 0 8px" }}>
                Fund What<br />
                Matters in<br />
                <span style={{ color: BLUE }}>The Gambia</span>
              </motion.h1>

              <motion.p {...fadeUp(0.12)} style={{ fontSize: 13, color: ORANGE_INK, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const, margin: "0 0 18px" }}>
                Real Causes · Real Proof · Real Gambians
              </motion.p>

              <motion.p {...fadeUp(0.18)} style={{ fontSize: "clamp(14px, 1.6vw, 16px)", color: "#56625b", lineHeight: 1.78, maxWidth: 460, margin: "0 0 30px" }}>
                Launch a campaign, collect donations via Wave, APS Mobile Money, or card — and prove every dalasi was well spent with photos and receipts your donors can see.
              </motion.p>

              {/* CTAs */}
              <motion.div {...fadeUp(0.22)} style={{ display: "flex", gap: 12, flexWrap: "wrap" as const, marginBottom: 10 }}>
                <Link href="/campaigns">
                  <button className="btn-primary" style={{ padding: "14px 28px", borderRadius: 12, border: "none", background: `${BLUE}`, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 10px 24px -10px rgba(20,120,74,0.6)", transition: "opacity 0.2s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.88"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}>
                    Donate to a Campaign →
                  </button>
                </Link>
                <Link href={isLoggedIn ? "/dashboard" : "/auth/signup"}>
                  <button style={{ padding: "14px 28px", borderRadius: 12, border: "1px solid rgba(21,32,26,0.14)", background: "#fff", color: "#15201a", fontSize: 15, fontWeight: 600, cursor: "pointer", transition: "border-color 0.2s, background 0.2s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(20,120,74,0.3)"; e.currentTarget.style.background = "rgba(20,120,74,0.06)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(21,32,26,0.14)"; e.currentTarget.style.background = "#fff"; }}>
                    {isLoggedIn ? "My Dashboard" : "Start a Campaign"}
                  </button>
                </Link>
              </motion.div>

              <motion.p {...fadeUp(0.26)} style={{ fontSize: 12, color: "#6e7872", marginBottom: 32, fontWeight: 500 }}>
                No account needed to donate · Takes under 2 minutes
              </motion.p>

              {/* Live stats bar */}
              <motion.div {...fadeUp(0.32)}>
                <div style={{ display: "flex", gap: 0, background: "#fff", border: "1px solid rgba(21,32,26,0.08)", borderRadius: 14, overflow: "hidden" }}>
                  {[
                    { label: "Total Raised", raw: stats?.total_raised ?? 0, format: compactGMD },
                    { label: "Live Campaigns", raw: stats?.active_campaigns ?? 0, format: fmtCompact },
                    { label: "Donations Made", raw: stats?.successful_donations ?? 0, format: fmtCompact },
                  ].map(({ label, raw, format }, i, arr) => (
                    <div key={label} style={{ flex: 1, padding: "14px 10px", textAlign: "center", borderRight: i < arr.length - 1 ? "1px solid rgba(21,32,26,0.06)" : "none" }}>
                      <div style={{ fontSize: "clamp(14px, 1.8vw, 20px)", fontWeight: 800, color: "#15201a", lineHeight: 1, letterSpacing: "-0.03em" }}>
                        {isLoading ? "—" : <CountUp to={raw} format={format} />}
                      </div>
                      <div style={{ fontSize: 11, color: "#56625b", marginTop: 4, fontWeight: 500 }}>{label}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Right — featured card + sidebar */}
            <div style={{ flex: "0 1 400px", display: "flex", flexDirection: "column", gap: 14, minWidth: 280 }}>

              {/* Featured campaign */}
              {isLoading ? (
                <div style={{ background: "#ffffff", borderRadius: 20, overflow: "hidden", border: "1px solid rgba(21,32,26,0.06)" }}>
                  <div style={{ height: 200, background: "rgba(21,32,26,0.04)", animation: "shimmer 1.5s infinite" }} />
                  <div style={{ padding: 20 }}>
                    {[80, 60, 100].map((w) => <div key={w} style={{ height: 13, width: `${w}%`, background: "rgba(21,32,26,0.05)", borderRadius: 6, marginBottom: 10 }} />)}
                  </div>
                </div>
              ) : featured ? (
                <FeaturedCampaignCard campaign={featured} />
              ) : null}

              {/* Sidebar mini campaigns */}
              {sidebarCampaigns.length > 0 && !isLoading && (
                <motion.div {...fadeUp(0.35)} className="hero-more-campaigns" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {sidebarCampaigns.map((c) => <SmallCampaignCard key={c.id} campaign={c} />)}
                  <Link href="/campaigns" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: 10, border: "1px solid rgba(21,32,26,0.07)", borderRadius: 10, fontSize: 13, color: "#56625b", fontWeight: 500 }}>
                    View all campaigns →
                  </Link>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="woven-strip" aria-hidden="true" />

      {/* ══════════════════════════════════════════════
          §2  IMPACT / STATS  (stats-counter video)
      ══════════════════════════════════════════════ */}
      <section style={{ background: "#fff", overflow: "hidden", position: "relative" }}>
        <div style={{ position: "relative", maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "stretch", flexWrap: "wrap" as const }}>

          {/* Content side */}
          <div style={{ flex: "1 1 340px", padding: "48px clamp(16px, 5vw, 72px)" }}>
            <motion.div {...fadeUp(0)} className="impact-row" style={{ display: "flex", flexWrap: "wrap" as const, gap: "32px 64px", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ flex: "1 1 360px" }}>
              <h2 style={{ fontSize: "clamp(24px, 3.5vw, 38px)", fontWeight: 900, color: "#15201a", margin: "0 0 12px", letterSpacing: "-0.04em", lineHeight: 1.08 }}>
                Gambia Is Giving.<br />We&apos;re Just Keeping<br />It Transparent.
              </h2>
              <p style={{ color: "#56625b", fontSize: 15, lineHeight: 1.75, maxWidth: 400, margin: 0 }}>
                Every donation tracked, every receipt uploaded, every campaigner verified — because trust isn&apos;t optional in crowdfunding.
              </p>
              </div>
              <div style={{ flex: "1 1 380px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "rgba(21,32,26,0.08)", border: "1px solid rgba(21,32,26,0.08)", borderRadius: 16, overflow: "hidden" }}>
                {[
                  { label: "Dalasi raised", raw: stats?.total_raised ?? 0, format: fmtGMDShort, color: BLUE },
                  { label: "Active campaigns", raw: stats?.active_campaigns ?? 0, format: plain, color: ORANGE_INK },
                  { label: "Successful donations", raw: stats?.successful_donations ?? 0, format: plain, color: "#15201a" },
                  { label: "Verified campaigners", raw: 0, format: plain, display: "100%", color: BLUE },
                ].map(({ label, raw, format, display, color }) => (
                  <div key={label} style={{ padding: "22px 24px", background: "#fcfbf8" }}>
                    <div style={{ fontSize: "clamp(22px, 2.6vw, 30px)", fontVariantNumeric: "tabular-nums", fontWeight: 800, color, letterSpacing: "-0.03em" }}>
                      {display ?? (isLoading ? "—" : <CountUp to={raw} format={format} />)}
                    </div>
                    <div style={{ fontSize: 11, color: "#626d66", marginTop: 4, fontWeight: 500 }}>{label}</div>
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
      <section style={{ padding: "64px clamp(16px, 5vw, 72px)", borderTop: "1px solid rgba(21,32,26,0.05)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 80% 40% at 50% 0%, rgba(20,120,74,0.04) 0%, transparent 60%)" }} />
        <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <motion.div {...fadeUp(0)} style={{ textAlign: "center", marginBottom: 40 }}>
            <h2 style={{ fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 900, color: "#15201a", margin: "0 0 14px", letterSpacing: "-0.04em", lineHeight: 1.07 }}>
              From Idea to Impact<br />in Four Steps
            </h2>
            <p style={{ color: "#56625b", fontSize: 16, maxWidth: 440, margin: "0 auto", lineHeight: 1.75 }}>
              Kambeng makes it simple to raise money or donate — with full transparency built in from the start.
            </p>
          </motion.div>

          <div className="steps-grid" style={{ display: "grid", gap: 16, position: "relative" }}>
            {/* Connector line */}
            <div className="steps-connector" style={{ position: "absolute", top: 40, left: "12.5%", right: "12.5%", height: 1, background: "linear-gradient(90deg, transparent, rgba(20,120,74,0.2), rgba(20,120,74,0.2), rgba(20,120,74,0.2), transparent)", pointerEvents: "none" }} />
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
                n: "03", title: "Share & Collect", color: ORANGE_INK,
                desc: "Share your campaign link or QR code. Donors pay with Wave, APS, or card — instantly.",
                icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="18" cy="5" r="3" stroke={ORANGE} strokeWidth="1.8"/><circle cx="6" cy="12" r="3" stroke={ORANGE} strokeWidth="1.8"/><circle cx="18" cy="19" r="3" stroke={ORANGE} strokeWidth="1.8"/><path d="M8.6 10.6l6.8-4.2M8.6 13.4l6.8 4.2" stroke={ORANGE} strokeWidth="1.6" strokeLinecap="round"/></svg>,
              },
              {
                n: "04", title: "Prove & Withdraw", color: "#8b3fd9",
                desc: "Upload receipts showing how funds were spent. Donors see proof. You withdraw.",
                icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="#8b3fd9" strokeWidth="1.8"/><path d="M7 9h6M7 13h4" stroke="#8b3fd9" strokeWidth="1.6" strokeLinecap="round"/><path d="M16 13l2 2 2-2" stroke="#8b3fd9" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
              },
            ].map(({ n, title, color, desc, icon }, i) => (
              <motion.div key={n} {...fadeUp(0.1 * i)} style={{
                padding: "32px 24px", background: "#ffffff",
                border: "1px solid rgba(21,32,26,0.07)", borderRadius: 20,
                position: "relative", overflow: "hidden", transition: "border-color 0.3s",
              }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = `${color}40`; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(21,32,26,0.07)"; }}
              >
                <div style={{ width: 48, height: 48, borderRadius: 14, background: `${color}18`, border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>{icon}</div>
                <div style={{ fontSize: 11, color, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 8 }}>Step {n}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#15201a", marginBottom: 10, letterSpacing: "-0.02em" }}>{title}</div>
                <div style={{ fontSize: 13, color: "#626d66", lineHeight: 1.75 }}>{desc}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          §4  TRUST — "Real Causes. Real Proof."
      ══════════════════════════════════════════════ */}
      <section className="trust-section" style={{ padding: "64px clamp(16px, 5vw, 72px)", borderTop: "1px solid rgba(21,32,26,0.05)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", width: 700, height: 700, background: "radial-gradient(circle, rgba(31,153,96,0.05) 0%, transparent 70%)", right: "-15%", top: "0%", pointerEvents: "none" }} />

        <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative", zIndex: 1 }}>
          {/* Header with transparent video overlay */}
          <div style={{ position: "relative", marginBottom: 24, overflow: "hidden", borderRadius: 20, padding: "40px clamp(20px, 4vw, 48px)", background: "#e6f4ec", border: "1px solid rgba(20,120,74,0.14)" }}>
            <div className="trust-header" style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap" as const, gap: 24 }}>
              <div>
                <h2 style={{ fontSize: "clamp(26px, 4vw, 44px)", fontWeight: 900, color: "#15201a", margin: "0", letterSpacing: "-0.04em", lineHeight: 1.05 }}>
                  Real Causes.<br />Real Proof.<br />Real Gambians.
                </h2>
              </div>
              <p className="trust-tagline" style={{ color: "#56625b", fontSize: 15, maxWidth: 360, margin: 0, lineHeight: 1.75 }}>
                Every campaign comes with verified identity, photo proof, and spending receipts — because asking &ldquo;did this actually help?&rdquo; shouldn&apos;t be necessary.
              </p>
            </div>
          </div>

          <div className="trust-grid" style={{ display: "grid", gap: 2, background: "rgba(21,32,26,0.04)", borderRadius: 20, overflow: "hidden", border: "1px solid rgba(21,32,26,0.06)" }}>
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
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 10h18M7 15h2M11 15h4" stroke={ORANGE} strokeWidth="1.8" strokeLinecap="round"/><rect x="2" y="6" width="20" height="13" rx="3" stroke={ORANGE} strokeWidth="1.8"/></svg>,
                accent: ORANGE_INK, glow: "rgba(232,101,15,0.08)", border: "rgba(232,101,15,0.22)",
                badge: "3 Ways to Pay", title: "Wave · APS · Visa/Mastercard",
                desc: "Donate instantly with Wave, APS Mobile Money, or a Visa/Mastercard via secure card checkout. No app required, no waiting.",
                stat: "3", statLabel: "payment rails",
              },
              {
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2Z" stroke="#8b3fd9" strokeWidth="1.7" strokeLinejoin="round"/></svg>,
                accent: "#8b3fd9", glow: "rgba(168,85,247,0.1)", border: "rgba(168,85,247,0.2)",
                badge: "Always Visible", title: "Public Donor Reviews",
                desc: "Donors leave public ratings and feedback on every campaign. A campaigner's track record is permanent — good or bad.",
                stat: "Always", statLabel: "visible",
              },
            ].map(({ icon, accent, glow, border, badge, title, desc, stat, statLabel }) => (
              <div key={title} className="trust-card" style={{ padding: "32px 28px", background: "#ffffff", position: "relative", cursor: "default", transition: "background 0.3s" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = glow; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#ffffff"; }}
              >
                <div style={{ position: "absolute", top: 0, left: 28, right: 28, height: 2, background: `linear-gradient(90deg, ${accent}, transparent)` }} />
                <div style={{ width: 48, height: 48, borderRadius: 12, background: glow, border: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>{icon}</div>
                <div style={{ fontSize: 10, color: accent, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 4 }}>{badge}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#15201a", marginBottom: 8 }}>{title}</div>
                <div className="trust-desc" style={{ fontSize: 13, color: "#626d66", lineHeight: 1.75, marginBottom: 18 }}>{desc}</div>
                <div style={{ display: "inline-flex", alignItems: "baseline", gap: 5, padding: "4px 10px", borderRadius: 8, background: glow, border: `1px solid ${border}` }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: accent }}>{stat}</span>
                  <span style={{ fontSize: 11, color: "#6e7872" }}>{statLabel}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          §5  TESTIMONIALS
      ══════════════════════════════════════════════ */}
      <section style={{ padding: "64px clamp(16px, 5vw, 72px)", borderTop: "1px solid rgba(21,32,26,0.05)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(28px, 4vw, 40px)", letterSpacing: "-0.02em", color: "#15201a", margin: 0 }}>
              Real Causes. Real Gambians.
            </h2>
          </div>
          <div className="testimonials-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
            {[
              { id:"t1", quote:"I sent money through Wave in under a minute, and I could actually see photos of the borehole being built. That's the part that got me — most fundraisers, you never know what happened with your money.", name:"Amadou Tijani Jallow", photo:"/testimonials/Amadou_Tijani_jallow.jpeg", role:"donor" as const, location:"Serrekunda", rating:5 },
              { id:"t2", quote:"My brother is in the UK and wanted to support a campaign here but didn't have Wave. He used his card and it just worked. Donating felt as easy as it should be.", name:"Burry Jobe", photo:"/testimonials/Burry_Jobe.jpeg", role:"donor" as const, location:"Bakau", rating:5 },
              { id:"t3", quote:"What convinced me to donate was seeing the campaigner was KYC verified. In a small country like ours, that reassurance matters more than people think.", name:"Jariatou Camara", photo:"/testimonials/Jariatou_Camara.jpeg", role:"donor" as const, location:"Banjul", rating:5 },
              { id:"t4", quote:"We raised more for the school's library in three weeks on Kambeng than we did in three months asking around. Posting receipts each week kept donors coming back.", name:"Momodou Salieu Jallow", photo:"/testimonials/Momodou_Salieu_Jallow.jpeg", role:"campaigner" as const, location:"Brikama", rating:5 },
              { id:"t5", quote:"I was nervous putting my ID up for verification, but it's what made donors trust the campaign. We hit our goal for the borehole faster than I expected.", name:"Omar Keita", photo:"/testimonials/Omar_Keita.jpeg", role:"campaigner" as const, location:"Farafenni", rating:4 },
              { id:"t6", quote:"Being able to show exactly what we spent — cement, labor, transport — meant nobody asked 'where did the money go?' It was all right there.", name:"Penda Sowe", photo:"/testimonials/Penda_Sowe.jpeg", role:"campaigner" as const, location:"Gunjur", rating:5 },
            ].map((t) => (
              <div key={t.id} style={{ background: "#ffffff", border: "1px solid rgba(21,32,26,0.09)", borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Stars */}
                <div style={{ color: ORANGE, fontSize: 13, letterSpacing: 2 }}>
                  {"★".repeat(t.rating)}{"☆".repeat(5 - t.rating)}
                </div>
                {/* Quote */}
                <p style={{ color: "#36443c", fontSize: 15, lineHeight: 1.65, margin: 0, flexGrow: 1 }}>
                  &ldquo;{t.quote}&rdquo;
                </p>
                {/* Footer */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <img
                    src={t.photo}
                    alt={t.name}
                    width={38}
                    height={38}
                    style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "2px solid rgba(20,120,74,0.2)" }}
                  />
                  <div>
                    <div style={{ color: "#15201a", fontSize: 13, fontWeight: 600 }}>{t.name}</div>
                    <div style={{ color: "#626d66", fontSize: 12 }}>
                      {t.role === "donor" ? "Donor" : "Campaign organizer"} · {t.location}
                    </div>
                  </div>
                  <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, color: BLUE, background: "rgba(20,120,74,0.1)", padding: "3px 8px", borderRadius: 6, whiteSpace: "nowrap" }}>
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
      <section style={{ padding: "64px clamp(16px, 5vw, 72px)", borderTop: "1px solid rgba(21,32,26,0.05)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 60% 40% at 50% 100%, rgba(99,102,241,0.06) 0%, transparent 70%)" }} />
        <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <motion.div {...fadeUp(0)} style={{ textAlign: "center", marginBottom: 40 }}>
            <h2 style={{ fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 900, color: "#15201a", margin: "0 0 14px", letterSpacing: "-0.04em", lineHeight: 1.07 }}>
              However You Want to Give,<br />We&apos;ve Got You
            </h2>
            <p style={{ color: "#56625b", fontSize: 16, maxWidth: 460, margin: "0 auto", lineHeight: 1.75 }}>
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
                color: ORANGE_INK, glow: "rgba(232,101,15,0.08)", border: "rgba(232,101,15,0.3)",
                icon: <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><rect x="5" y="2" width="14" height="20" rx="3" stroke={ORANGE} strokeWidth="1.8"/><path d="M9 18h6" stroke={ORANGE} strokeWidth="1.8" strokeLinecap="round"/><path d="M8 8h8M8 11h5" stroke={ORANGE} strokeWidth="1.6" strokeLinecap="round"/></svg>,
              },
              {
                label: "Visa & Mastercard", tagline: "Secure card checkout",
                desc: "Pay with any major credit or debit card. PCI DSS compliant, 3D Secure, encrypted end-to-end.",
                color: "#4f46e5", glow: "rgba(99,102,241,0.12)", border: "rgba(99,102,241,0.3)",
                icon: <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="3" stroke="#4f46e5" strokeWidth="1.8"/><path d="M2 10h20" stroke="#4f46e5" strokeWidth="1.8"/><path d="M6 15h4M14 15h4" stroke="#4f46e5" strokeWidth="1.6" strokeLinecap="round"/></svg>,
              },
            ].map(({ label, tagline, desc, color, glow, border, icon }, i) => (
              <motion.div key={label} {...fadeUp(0.08 * i)} style={{ background: "#ffffff", border: "1px solid rgba(21,32,26,0.07)", borderRadius: 20, padding: "36px 28px", position: "relative", overflow: "hidden", transition: "border-color 0.3s, box-shadow 0.3s" }}
                whileHover={{ borderColor: border, boxShadow: `0 8px 40px ${glow}` } as object}
              >
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${color}, transparent)` }} />
                <div style={{ position: "absolute", bottom: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: `radial-gradient(circle, ${glow} 0%, transparent 70%)`, pointerEvents: "none" }} />
                <div style={{ width: 60, height: 60, borderRadius: 16, background: glow, border: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 22 }}>{icon}</div>
                <div style={{ fontSize: 11, color, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const, marginBottom: 6 }}>{tagline}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#15201a", marginBottom: 12, letterSpacing: "-0.02em" }}>{label}</div>
                <div style={{ fontSize: 14, color: "#626d66", lineHeight: 1.78 }}>{desc}</div>
              </motion.div>
            ))}
          </div>

          <motion.div {...fadeUp(0.3)} style={{ textAlign: "center", marginTop: 28 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 18px", borderRadius: 24, background: `${GREEN}10`, border: `1px solid ${GREEN}25`, fontSize: 13, color: "#626d66" }}>
              <LockOutlined style={{ fontSize: 12, color: GREEN }} />
              All payments encrypted and processed by licensed, regulated payment partners.
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          §7  LIVE CAMPAIGNS GRID
      ══════════════════════════════════════════════ */}
      <section style={{ padding: "64px clamp(16px, 5vw, 72px)", borderTop: "1px solid rgba(21,32,26,0.05)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <motion.div {...fadeUp(0)} style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap" as const, gap: 16, marginBottom: 28 }}>
            <div>
              <h2 style={{ fontSize: "clamp(24px, 3.5vw, 38px)", fontWeight: 900, color: "#15201a", margin: 0, letterSpacing: "-0.04em", lineHeight: 1.08 }}>
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
                <div key={i} style={{ background: "#ffffff", borderRadius: 16, border: "1px solid rgba(21,32,26,0.06)", overflow: "hidden" }}>
                  <div style={{ height: 160, background: "rgba(21,32,26,0.04)", animation: "shimmer 1.5s infinite" }} />
                  <div style={{ padding: 16 }}>
                    {[70, 50, 90].map((w) => <div key={w} style={{ height: 12, width: `${w}%`, background: "rgba(21,32,26,0.05)", borderRadius: 4, marginBottom: 8 }} />)}
                  </div>
                </div>
              ))}
            </div>
          ) : gridCampaigns.length > 0 ? (
            <div className="campaigns-grid" style={{ display: "grid", gap: 16 }}>
              {gridCampaigns.map((c, i) => {
                const pct = c.target_amount && c.target_amount > 0 ? Math.min(100, (c.amount_raised / c.target_amount) * 100) : 0;
                return (
                  <motion.div key={c.id} {...fadeUp(0.06 * i)} style={{ background: "#ffffff", border: "1px solid rgba(21,32,26,0.07)", borderRadius: 16, overflow: "hidden", transition: "border-color 0.25s, transform 0.25s", cursor: "pointer" }}
                    whileHover={{ y: -4, borderColor: "rgba(20,120,74,0.25)" } as object}
                  >
                    <div style={{ position: "relative", height: 160, background: "#f1eee7" }}>
                      {c.cover_image_url
                        ? <Image src={c.cover_image_url} alt={c.title} fill unoptimized sizes="380px" style={{ objectFit: "cover" }} />
                        : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #e6f4ec, #cfe8da)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, fontWeight: 900, color: `${BLUE}40` }}>{c.title.charAt(0)}</div>
                      }
                      <div style={{ position: "absolute", top: 10, left: 10 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 12, background: ORANGE, color: "#fff" }}>LIVE</span>
                      </div>
                    </div>
                    <div style={{ padding: "16px" }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#15201a", marginBottom: 8, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>{c.title}</div>
                      {c.target_amount && c.target_amount > 0 && (
                        <div style={{ height: 3, background: "rgba(21,32,26,0.07)", borderRadius: 2, marginBottom: 8, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: BLUE, borderRadius: 2 }} />
                        </div>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#15201a", fontVariantNumeric: "tabular-nums" }}>{c.amount_raised.toLocaleString()} GMD</div>
                        <Link href={`/quick-pay/${c.slug}`}>
                          <button style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: BLUE, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Donate</button>
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "48px 0", color: "#6e7872", fontSize: 15 }}>No campaigns yet — <Link href="/auth/signup" style={{ color: BLUE }}>start the first one</Link>.</div>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          §7.5  EMAIL OPT-IN
      ══════════════════════════════════════════════ */}
      <section style={{ padding: "0 clamp(16px, 5vw, 72px) 40px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <motion.div {...fadeUp(0)} style={{
            display: "flex", flexWrap: "wrap" as const, alignItems: "center", gap: 24,
            borderRadius: 20, padding: "32px clamp(20px, 4vw, 40px)",
            background: "#ffffff", border: "1px solid rgba(21,32,26,0.08)",
          }}>
            <div style={{ flex: "1 1 320px" }}>
              <h3 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 900, color: "#15201a", letterSpacing: "-0.03em" }}>
                Be the first to know about campaigns in your community
              </h3>
              <p style={{ margin: 0, color: "#56625b", fontSize: 14, lineHeight: 1.7 }}>
                One short email each week from Kambeng. No spam, unsubscribe anytime.
              </p>
            </div>
            <div style={{ flex: "1 1 320px" }}>
              <EmailCaptureForm source="homepage" buttonLabel="Keep me posted" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          §8  FINAL CTA  (loader loop bg video)
      ══════════════════════════════════════════════ */}
      <section className="cta-section" style={{ padding: "0 clamp(16px, 5vw, 72px) 64px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <motion.div {...fadeUp(0)} style={{
            position: "relative", overflow: "hidden",
            borderRadius: 24, padding: "64px clamp(24px, 5vw, 80px)",
            background: "#0f5e3a",
            backgroundImage: "var(--tapestry)",
          }}>
            <div style={{ position: "absolute", width: 600, height: 600, background: "radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)", left: "-15%", top: "-60%", pointerEvents: "none" }} />
            <div style={{ position: "absolute", width: 400, height: 400, background: "radial-gradient(circle, rgba(232,101,15,0.35) 0%, transparent 70%)", right: "-5%", bottom: "-60%", pointerEvents: "none" }} />

            <div style={{ position: "relative", zIndex: 1, textAlign: "center", maxWidth: 620, margin: "0 auto" }}>
              <h2 style={{ fontSize: "clamp(28px, 4.5vw, 50px)", fontWeight: 900, color: "#fff", margin: "0 0 18px", letterSpacing: "-0.04em", lineHeight: 1.05 }}>
                Your First Donation<br />Takes Less Than 2 Minutes
              </h2>
              <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 16, margin: "0 0 40px", lineHeight: 1.78, maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
                Browse a verified campaign, choose Wave, APS, or card, and see exactly where your money goes. No account. No app download. No hassle.
              </p>
              <div className="cta-buttons" style={{ display: "flex", gap: 14, flexWrap: "wrap" as const, justifyContent: "center" }}>
                <Link href="/campaigns" className="cta-btn-link">
                  <button style={{ padding: "16px 36px", borderRadius: 12, border: "none", background: ORANGE, color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer", boxShadow: "0 10px 24px -10px rgba(21,32,26,0.12)", width: "100%", whiteSpace: "nowrap" as const }}>
                    Browse Campaigns →
                  </button>
                </Link>
                <Link href="/auth/signup" className="cta-btn-link">
                  <button style={{ padding: "16px 36px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.35)", background: "transparent", color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer", width: "100%", whiteSpace: "nowrap" as const }}>
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
        }
        @media (max-width: 640px) {
          .hero-section { padding: 28px clamp(16px, 5vw, 72px) 40px !important; }
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
