"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeftOutlined, ArrowRightOutlined, StarFilled, SafetyOutlined, PictureOutlined, FileTextOutlined } from "@ant-design/icons";

import { AppProgress } from "@/components/ui";
import { ReviewForm } from "@/components/reviews/review-form";
import { ProofList } from "@/components/ProofList";
import {
  useCampaignGoals,
  usePublicCampaignImages,
  useCampaignProofs,
  usePublicCampaignReviews,
  useSessionProfile,
} from "@/hooks/use-frontend-data";
import { api } from "@/lib/api";
import type { CampaignDiscoveryItem, CampaignGoal, CampaignReview, PublicCampaignImage } from "@/types/frontend";

const WAVE_BLUE = "#1dc5ff";

function GlowOrb({ x, y, size, color }: { x: string; y: string; size: number; color: string }) {
  return (
    <div style={{
      position: "absolute", left: x, top: y, width: size, height: size,
      background: color, borderRadius: "50%", filter: `blur(${size * 0.6}px)`,
      opacity: 0.1, pointerEvents: "none",
    }} />
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: "rgba(29,197,255,0.12)", border: "1px solid rgba(29,197,255,0.2)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 16, color: WAVE_BLUE,
      }}>{icon}</div>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: "#f0f6ff", margin: 0 }}>{title}</h3>
    </div>
  );
}

export default function CampaignDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const { data: session } = useSessionProfile(true);
  const isLoggedIn = Boolean(session?.id);

  const { data: campaign, isLoading, error } = useQuery({
    queryKey: ["campaign-detail", slug],
    enabled: Boolean(slug),
    queryFn: async () => {
      const response = await api.get<CampaignDiscoveryItem>(`/campaigns/${slug}`);
      return response.data;
    },
  });

  const { data: reviews = [], isLoading: reviewsLoading } = usePublicCampaignReviews(slug, Boolean(slug));
  const { data: images = [], isLoading: imagesLoading } = usePublicCampaignImages(slug, Boolean(slug));
  const { data: goals = [], isLoading: goalsLoading } = useCampaignGoals(slug, Boolean(slug));
  const { data: proofs = [], isLoading: proofsLoading } = useCampaignProofs(slug, Boolean(slug));

  const progress = campaign?.target_amount
    ? Math.min((campaign.amount_raised / campaign.target_amount) * 100, 100)
    : 0;

  const reviewSummary = useMemo(() => {
    if (reviews.length === 0) return { average: 0, count: 0, distribution: [0, 0, 0, 0, 0] };
    const total = reviews.reduce((sum, r) => sum + r.rating, 0);
    return {
      average: total / reviews.length,
      count: reviews.length,
      distribution: [5, 4, 3, 2, 1].map((r) => reviews.filter((rev) => rev.rating === r).length),
    };
  }, [reviews]);

  if (isLoading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 48, height: 48, border: `3px solid ${WAVE_BLUE}`, borderTopColor: "transparent",
            borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ color: "#8899aa" }}>Loading campaign...</p>
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>😕</div>
          <h2 style={{ color: "#f0f6ff", marginBottom: 8 }}>Campaign not found</h2>
          <p style={{ color: "#8899aa", marginBottom: 24 }}>This campaign may have been removed or the link is incorrect.</p>
          <Link href="/campaigns">
            <button style={{
              padding: "10px 20px", borderRadius: 10, border: "none",
              background: "linear-gradient(135deg, #1dc5ff, #079bd4)",
              color: "#fff", fontWeight: 600, cursor: "pointer",
            }}>Browse All Campaigns</button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px clamp(16px,4vw,48px) 80px" }}>
      {/* Back */}
      <Link href="/campaigns">
        <button style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "8px 16px", borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(255,255,255,0.04)",
          color: "#8899aa", fontSize: 14, cursor: "pointer", marginBottom: 32,
        }}>
          <ArrowLeftOutlined /> Back to Campaigns
        </button>
      </Link>

      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div style={{
          position: "relative", borderRadius: 20, overflow: "hidden",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          marginBottom: 32,
        }}>
          <GlowOrb x="70%" y="-20%" size={400} color="#1dc5ff" />

          <div style={{ display: "flex", flexWrap: "wrap", gap: 0 }}>
            {/* Cover image */}
            <div style={{
              flex: "0 0 clamp(280px, 45%, 520px)",
              minHeight: 340, position: "relative",
              background: campaign.cover_image_url
                ? undefined
                : "linear-gradient(135deg, rgba(29,197,255,0.1), rgba(7,155,212,0.06))",
            }}>
              {campaign.cover_image_url ? (
                <Image src={campaign.cover_image_url} alt={campaign.title} fill unoptimized
                  sizes="45vw" style={{ objectFit: "cover" }} />
              ) : (
                <div style={{
                  position: "absolute", inset: 0,
                  background: "linear-gradient(135deg, #0d2340 0%, #0a3d5c 50%, #061e30 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <div style={{
                    width: 80, height: 80, borderRadius: 20,
                    background: "rgba(29,197,255,0.1)",
                    border: "1px solid rgba(29,197,255,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 36, fontWeight: 900, color: WAVE_BLUE,
                  }}>
                    {campaign.title.charAt(0).toUpperCase()}
                  </div>
                </div>
              )}
            </div>

            {/* Info */}
            <div style={{ flex: "1 1 320px", padding: "36px 32px", position: "relative", zIndex: 1 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                <span style={{
                  padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                  background: campaign.status === "ACTIVE" ? "rgba(27,191,136,0.2)" : "rgba(100,100,100,0.2)",
                  color: campaign.status === "ACTIVE" ? "#1bbf88" : "#8899aa",
                  border: `1px solid ${campaign.status === "ACTIVE" ? "rgba(27,191,136,0.3)" : "rgba(100,100,100,0.3)"}`,
                }}>{campaign.status}</span>
                <span style={{
                  padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                  background: "rgba(29,197,255,0.1)", color: WAVE_BLUE,
                  border: "1px solid rgba(29,197,255,0.2)",
                }}>{campaign.mode}</span>
              </div>

              <h1 style={{ fontSize: "clamp(22px,3vw,32px)", fontWeight: 800, color: "#f0f6ff",
                lineHeight: 1.2, letterSpacing: "-0.03em", marginBottom: 12 }}>
                {campaign.title}
              </h1>

              <p style={{ color: "#8899aa", fontSize: 15, lineHeight: 1.75, marginBottom: 28 }}>
                {campaign.description}
              </p>

              {/* Progress */}
              <div style={{
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 14, padding: "20px 24px", marginBottom: 20,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, alignItems: "baseline" }}>
                  <div>
                    <span style={{ fontSize: "clamp(22px,3vw,28px)", fontWeight: 800, color: "#f0f6ff" }}>
                      {campaign.amount_raised.toLocaleString()}
                    </span>
                    <span style={{ color: "#8899aa", fontSize: 14, marginLeft: 6 }}>GMD raised</span>
                  </div>
                  {campaign.target_amount && (
                    <span style={{ fontSize: 20, fontWeight: 700, color: WAVE_BLUE }}>
                      {Math.round(progress)}%
                    </span>
                  )}
                </div>
                <AppProgress percent={progress} showInfo={false} strokeColor={WAVE_BLUE}
                  trailColor="rgba(255,255,255,0.08)" />
                {campaign.target_amount && (
                  <div style={{ fontSize: 13, color: "#4a5568", marginTop: 8 }}>
                    Goal: {campaign.target_amount.toLocaleString()} GMD
                  </div>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Link href={`/quick-pay/${campaign.slug}`}>
                  <button style={{
                    width: "100%", padding: "14px 20px", borderRadius: 12, border: "none",
                    background: "linear-gradient(135deg, #1dc5ff, #079bd4)",
                    color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
                    boxShadow: "0 6px 24px rgba(29,197,255,0.35)",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}>
                    Donate with Wave <ArrowRightOutlined />
                  </button>
                </Link>
                {reviewSummary.count > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                    <StarFilled style={{ color: "#fbbf24", fontSize: 14 }} />
                    <span style={{ color: "#8899aa", fontSize: 13 }}>
                      {reviewSummary.average.toFixed(1)} · {reviewSummary.count} review{reviewSummary.count !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr min(340px, 35%)", gap: 24, alignItems: "start" }}>
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>

          {/* Gallery — visible to all */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 16, padding: "24px 24px 28px",
            }}>
              <SectionHeader icon={<PictureOutlined />} title="Campaign Gallery" />
              {imagesLoading ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px,1fr))", gap: 10 }}>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} style={{ aspectRatio: "4/3", borderRadius: 10,
                      background: "rgba(255,255,255,0.04)", animation: "pulse 2s infinite" }} />
                  ))}
                </div>
              ) : images.length > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px,1fr))", gap: 10 }}>
                  {images.map((img: PublicCampaignImage, i) => (
                    <a key={i} href={img.url} target="_blank" rel="noreferrer" style={{ display: "block" }}>
                      <div style={{ position: "relative", aspectRatio: "4/3", borderRadius: 10, overflow: "hidden",
                        border: "1px solid rgba(255,255,255,0.08)", cursor: "zoom-in" }}>
                        <Image src={img.url} alt={img.original_name ?? img.file_name} fill unoptimized
                          sizes="200px" style={{ objectFit: "cover", transition: "transform 0.3s" }} />
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "32px 16px", color: "#4a5568" }}>
                  <PictureOutlined style={{ fontSize: 32, marginBottom: 10, display: "block" }} />
                  <p style={{ fontSize: 14 }}>No photos uploaded yet</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Proof — visible to all */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 16, padding: "24px 24px 28px",
            }}>
              <SectionHeader icon={<FileTextOutlined />} title="Proof of Expenditure" />
              {proofsLoading ? (
                <p style={{ color: "#8899aa" }}>Loading...</p>
              ) : proofs.length > 0 ? (
                <ProofList proofs={proofs} />
              ) : (
                <div style={{ textAlign: "center", padding: "32px 16px", color: "#4a5568" }}>
                  <SafetyOutlined style={{ fontSize: 32, marginBottom: 10, display: "block" }} />
                  <p style={{ fontSize: 14 }}>No proof documents uploaded yet</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Goals */}
          {goals.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <div style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 16, padding: "24px 24px 28px",
              }}>
                <SectionHeader icon="🎯" title="Campaign Goals" />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px,1fr))", gap: 14 }}>
                  {goals.map((goal: CampaignGoal) => {
                    const pct = Math.min((goal.amount_raised / goal.target_amount) * 100, 100);
                    return (
                      <div key={goal.id} style={{
                        padding: 18, borderRadius: 12,
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.07)",
                      }}>
                        <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#fbbf24",
                            background: "rgba(251,191,36,0.1)", padding: "3px 8px", borderRadius: 6 }}>
                            {goal.status}
                          </span>
                          {goal.due_date && (
                            <span style={{ fontSize: 11, color: "#8899aa" }}>
                              Due {new Date(goal.due_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "#f0f6ff", marginBottom: 6 }}>{goal.title}</div>
                        {goal.description && <p style={{ fontSize: 13, color: "#8899aa", marginBottom: 10 }}>{goal.description}</p>}
                        <AppProgress percent={Math.round(pct)} showInfo={false} strokeColor={WAVE_BLUE} trailColor="rgba(255,255,255,0.08)" size="small" />
                        <div style={{ fontSize: 12, color: "#8899aa", marginTop: 6 }}>
                          {goal.amount_raised.toLocaleString()} / {goal.target_amount.toLocaleString()} GMD
                        </div>
                        {goal.status === "ACTIVE" && (
                          <Link href={`/quick-pay/${campaign.slug}?goalId=${goal.id}`}>
                            <button style={{
                              width: "100%", marginTop: 12, padding: "8px 12px", borderRadius: 8,
                              border: "none", background: "linear-gradient(135deg, #1dc5ff, #079bd4)",
                              color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
                            }}>Fund this goal</button>
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* Reviews */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 16, padding: "24px 24px 28px",
            }}>
              <SectionHeader icon={<StarFilled />} title="Donor Reviews" />
              {reviewsLoading ? (
                <p style={{ color: "#8899aa" }}>Loading reviews...</p>
              ) : reviews.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {reviews.map((r: CampaignReview) => (
                    <div key={r.id} style={{
                      padding: 18, borderRadius: 12,
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.07)",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 32, height: 32, borderRadius: "50%",
                            background: "linear-gradient(135deg, #1dc5ff, #079bd4)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 13, fontWeight: 700, color: "#fff" }}>
                            {(r.donor_name ?? "A")[0].toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 600, color: "#f0f6ff", fontSize: 14 }}>
                            {r.donor_name ?? "Anonymous"}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 2 }}>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <StarFilled key={i} style={{ color: i < r.rating ? "#fbbf24" : "rgba(255,255,255,0.1)", fontSize: 13 }} />
                          ))}
                        </div>
                      </div>
                      <p style={{ color: "#8899aa", fontSize: 14, lineHeight: 1.6 }}>{r.comment}</p>
                      <p style={{ color: "#4a5568", fontSize: 12, marginTop: 8 }}>
                        {new Date(r.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "24px 16px", color: "#4a5568" }}>
                  <StarFilled style={{ fontSize: 28, marginBottom: 8, display: "block" }} />
                  <p style={{ fontSize: 14 }}>No reviews yet — be the first!</p>
                </div>
              )}

              {isLoggedIn && slug ? (
                <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontWeight: 600, color: "#f0f6ff", marginBottom: 14 }}>Leave a Review</div>
                  <ReviewForm slug={slug} />
                </div>
              ) : (
                <div style={{
                  marginTop: 20, padding: 18, borderRadius: 12,
                  background: "rgba(29,197,255,0.05)", border: "1px solid rgba(29,197,255,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
                }}>
                  <p style={{ color: "#8899aa", fontSize: 14 }}>Login to leave a review</p>
                  <Link href="/auth/login">
                    <button style={{
                      padding: "8px 16px", borderRadius: 8, border: "none",
                      background: "linear-gradient(135deg, #1dc5ff, #079bd4)",
                      color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
                    }}>Login</button>
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Right sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20, position: "sticky", top: 88 }}>
          {/* Donate CTA */}
          <div style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16, padding: 24,
          }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#f0f6ff", marginBottom: 16 }}>
              Support this campaign
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: "clamp(22px,2.5vw,28px)", fontWeight: 800, color: "#f0f6ff" }}>
                {campaign.amount_raised.toLocaleString()} GMD
              </div>
              <div style={{ fontSize: 13, color: "#8899aa" }}>raised so far</div>
            </div>
            <AppProgress percent={Math.round(progress)} showInfo={false}
              strokeColor={WAVE_BLUE} trailColor="rgba(255,255,255,0.08)" />
            {campaign.target_amount && (
              <div style={{ fontSize: 12, color: "#4a5568", marginTop: 8, marginBottom: 20 }}>
                {Math.round(progress)}% of {campaign.target_amount.toLocaleString()} GMD goal
              </div>
            )}
            <Link href={`/quick-pay/${campaign.slug}`}>
              <button style={{
                width: "100%", padding: "14px 20px", borderRadius: 12, border: "none",
                background: "linear-gradient(135deg, #1dc5ff, #079bd4)",
                color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
                boxShadow: "0 6px 24px rgba(29,197,255,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
                Donate with Wave <ArrowRightOutlined />
              </button>
            </Link>
          </div>

          {/* Trust signals */}
          <div style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 16, padding: 20,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#8899aa", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Trust & Safety
            </div>
            {[
              { icon: "✅", label: "Payments via Wave (secure)" },
              { icon: "🔐", label: "KYC-verified campaigner" },
              { icon: "📄", label: `${proofs.length} proof document${proofs.length !== 1 ? "s" : ""} uploaded` },
              { icon: "⭐", label: `${reviewSummary.count} donor review${reviewSummary.count !== 1 ? "s" : ""}` },
            ].map(({ icon, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 16 }}>{icon}</span>
                <span style={{ fontSize: 13, color: "#8899aa" }}>{label}</span>
              </div>
            ))}
          </div>

          {!isLoggedIn && (
            <div style={{
              background: "rgba(29,197,255,0.05)",
              border: "1px solid rgba(29,197,255,0.15)",
              borderRadius: 16, padding: 20, textAlign: "center",
            }}>
              <p style={{ color: "#8899aa", fontSize: 13, marginBottom: 14, lineHeight: 1.6 }}>
                Create a free account to track your donations and receive updates
              </p>
              <Link href="/auth/signup">
                <button style={{
                  width: "100%", padding: "10px 16px", borderRadius: 10, border: "none",
                  background: "linear-gradient(135deg, #1dc5ff, #079bd4)",
                  color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}>Create Free Account</button>
              </Link>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        @media (max-width: 768px) {
          div[style*="grid-template-columns: 1fr min(340px"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
