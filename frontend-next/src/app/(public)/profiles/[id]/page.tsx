"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

import { api } from "@/lib/api";
import type { PublicProfile } from "@/types/frontend";

const BLUE = "#14784a";
const GREEN = "#1f9960";

function fade(delay = 0) {
  return { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.32, delay, ease: "easeOut" as const } };
}

function Avatar({ name, size = 72 }: { name: string; size?: number }) {
  const initials = name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg, #e6f4ec, #cfe8da)", border: "2px solid rgba(20,120,74,0.35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.34, fontWeight: 800, color: BLUE, flexShrink: 0 }}>
      {initials}
    </div>
  );
}

function VerifiedBadge() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "4px 12px", borderRadius: 20, color: GREEN, background: "rgba(31,153,96,0.1)", border: "1px solid rgba(31,153,96,0.25)" }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5" />
      </svg>
      Identity verified
    </span>
  );
}

export default function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get<PublicProfile>(`/profiles/${id}`);
        if (!cancelled) {
          setProfile(response.data);
          setState("ready");
        }
      } catch {
        if (!cancelled) setState("missing");
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (state === "loading") {
    return (
      <div style={{ background: "#f6f4ef", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, border: `2px solid ${BLUE}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (state === "missing" || !profile) {
    return (
      <div style={{ background: "#f6f4ef", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#15201a" }}>Profile not found</div>
        <div style={{ fontSize: 14, color: "#626d66", textAlign: "center" }}>This organizer profile doesn&apos;t exist or is no longer available.</div>
        <Link href="/campaigns" style={{ marginTop: 8, padding: "10px 22px", borderRadius: 10, background: `${BLUE}`, color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
          Browse campaigns
        </Link>
      </div>
    );
  }

  const memberSince = new Date(profile.member_since).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <div style={{ background: "#f6f4ef", minHeight: "100vh", padding: "36px clamp(16px,4vw,48px)", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at top left, rgba(20,120,74,0.1), transparent 30%)", pointerEvents: "none" }} />

      <div style={{ maxWidth: 960, margin: "0 auto", position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Organizer header */}
        <motion.div {...fade(0)}>
          <div style={{ background: "#ffffff", border: "1px solid rgba(21,32,26,0.07)", borderRadius: 18, padding: "26px 28px", display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
            <Avatar name={profile.full_name ?? "?"} />
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#15201a", letterSpacing: "-0.03em" }}>{profile.full_name ?? "Kambeng organizer"}</h1>
                {profile.kyc_verified && <VerifiedBadge />}
              </div>
              <div style={{ fontSize: 13, color: "#626d66", marginTop: 6 }}>
                Campaign organizer · Member since {memberSince}
              </div>
              {profile.bio && (
                <p style={{ margin: "14px 0 0", fontSize: 14, color: "#56625b", lineHeight: 1.7, maxWidth: 640, whiteSpace: "pre-line" }}>{profile.bio}</p>
              )}
            </div>
          </div>
        </motion.div>

        {/* Campaigns */}
        <motion.div {...fade(0.06)}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#15201a", marginBottom: 14 }}>
            Campaigns by {profile.full_name?.split(" ")[0] ?? "this organizer"} ({profile.campaigns.length})
          </div>

          {profile.campaigns.length === 0 ? (
            <div style={{ background: "#ffffff", border: "1px solid rgba(21,32,26,0.07)", borderRadius: 16, padding: "44px 24px", textAlign: "center", color: "#6e7872", fontSize: 14 }}>
              No public campaigns yet
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18 }}>
              {profile.campaigns.map((campaign, index) => {
                const funded = campaign.target_amount ? campaign.amount_raised >= campaign.target_amount : false;
                const progress = campaign.target_amount ? Math.min((campaign.amount_raised / campaign.target_amount) * 100, 100) : 0;
                return (
                  <motion.div key={campaign.id} {...fade(0.05 + 0.04 * index)}>
                    <Link href={`/campaigns/${campaign.slug}`} style={{ textDecoration: "none" }}>
                      <div
                        style={{ background: "#ffffff", border: "1px solid rgba(21,32,26,0.07)", borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column", height: "100%", transition: "border-color 0.2s, transform 0.2s" }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(20,120,74,0.3)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(21,32,26,0.07)"; e.currentTarget.style.transform = ""; }}
                      >
                        <div style={{ position: "relative", height: 150, background: "#f1eee7", flexShrink: 0 }}>
                          {campaign.cover_image_url ? (
                            <Image src={campaign.cover_image_url} alt={campaign.title} fill unoptimized sizes="(max-width: 768px) 100vw, 33vw" style={{ objectFit: "cover" }} />
                          ) : (
                            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #e6f4ec 0%, #cfe8da 50%, #eef6f1 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <div style={{ width: 46, height: 46, borderRadius: 12, background: "rgba(20,120,74,0.1)", border: "1px solid rgba(20,120,74,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 900, color: BLUE }}>
                                {campaign.title.charAt(0).toUpperCase()}
                              </div>
                            </div>
                          )}
                          <div style={{ position: "absolute", top: 10, left: 10, padding: "3px 9px", borderRadius: 20, fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", background: campaign.status === "ACTIVE" ? "rgba(31,153,96,0.9)" : "rgba(21,32,26,0.12)", color: campaign.status === "ACTIVE" ? "#fff" : "#56625b" }}>
                            {campaign.status}
                          </div>
                        </div>
                        <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#15201a", lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{campaign.title}</div>
                          <div style={{ marginTop: "auto" }}>
                            {campaign.target_amount ? (
                              <>
                                <div style={{ height: 6, borderRadius: 4, background: "rgba(21,32,26,0.06)", overflow: "hidden" }}>
                                  <div style={{ width: `${progress}%`, height: "100%", borderRadius: 4, background: funded ? GREEN : `linear-gradient(90deg, ${BLUE}, #0f5e3a)` }} />
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7 }}>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: funded ? GREEN : BLUE }}>{campaign.amount_raised.toLocaleString()} GMD</span>
                                  <span style={{ fontSize: 11, color: "#6e7872" }}>of {campaign.target_amount.toLocaleString()} GMD</span>
                                </div>
                              </>
                            ) : (
                              <span style={{ fontSize: 12, fontWeight: 700, color: BLUE }}>{campaign.amount_raised.toLocaleString()} GMD raised</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
