"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { useSessionProfile, useMyCampaigns, useKYCStatus } from "@/hooks/use-frontend-data";

const BLUE = "#1dc5ff";
const GREEN = "#1bbf88";

function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.38, delay, ease: "easeOut" as const },
  };
}

function Avatar({ name, size = 52 }: { name: string; size?: number }) {
  const initials = name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: "linear-gradient(135deg, #0d2340, #0a3d5c)",
      border: `2px solid rgba(29,197,255,0.35)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.36, fontWeight: 800, color: BLUE,
      flexShrink: 0, letterSpacing: "-0.02em",
      boxShadow: `0 0 0 4px rgba(29,197,255,0.07), 0 4px 16px rgba(0,0,0,0.4)`,
    }}>
      {initials}
    </div>
  );
}

function CampaignStatusChip({ status }: { status: string }) {
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
      padding: "2px 7px", borderRadius: 20, color: s.color, background: s.bg,
    }}>
      {status}
    </span>
  );
}

function Shimmer({ w = "100%", h = 16, r = 6 }: { w?: string | number; h?: number; r?: number }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: "rgba(255,255,255,0.06)", flexShrink: 0 }} />;
}

function KYCStatusChip({ status }: { status: string }) {
  const normalized = status.toUpperCase();
  const map: Record<string, { label: string; color: string; bg: string }> = {
    APPROVED: { label: "Approved", color: GREEN, bg: "rgba(27,191,136,0.12)" },
    SUBMITTED: { label: "Submitted", color: BLUE, bg: "rgba(29,197,255,0.12)" },
    REVIEWING: { label: "In review", color: BLUE, bg: "rgba(29,197,255,0.12)" },
    REJECTED: { label: "Rejected", color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
    NOT_SUBMITTED: { label: "Not submitted", color: "#f97316", bg: "rgba(249,115,22,0.12)" },
  };
  const chip = map[normalized] ?? map.NOT_SUBMITTED;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, color: chip.color, letterSpacing: "0.08em",
      background: chip.bg, border: `1px solid ${chip.color}33`,
      padding: "2px 8px", borderRadius: 20, textTransform: "uppercase" as const,
    }}>{chip.label}</span>
  );
}

export default function DashboardPage() {
  const { data: me, isLoading: meLoading } = useSessionProfile(true);
  const { data: campaigns, isLoading: campaignsLoading } = useMyCampaigns(true);
  const { data: kycStatus, isLoading: kycLoading } = useKYCStatus(me?.id);

  const fullName      = me?.full_name ?? "—";
  const email         = me?.email ?? "—";
  const wave          = me?.wave_number ?? "—";
  const role          = me?.role ?? "USER";
  const emailVerified = me?.is_email_verified ?? false;
  const kycState      = me?.kyc_status ?? kycStatus?.status ?? "NOT_SUBMITTED";
  const kycApproved   = kycState === "APPROVED";
  const kycPending    = kycState === "SUBMITTED" || kycState === "REVIEWING";
  const kycRejected   = kycState === "REJECTED";

  const totalRaised = (campaigns ?? []).reduce((s, c) => s + c.amount_raised, 0);
  const activeCnt   = (campaigns ?? []).filter((c) => c.status === "ACTIVE").length;
  const campaignCnt = (campaigns ?? []).length;

  const fmt = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000   ? `${(n / 1_000).toFixed(1)}K`
    : n.toLocaleString();

  return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh" }}>

      {/* ── Top profile bar ── */}
      <div style={{
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "24px clamp(16px, 4vw, 48px)",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {meLoading
              ? <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
              : <Avatar name={fullName} />
            }
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 5 }}>
                {meLoading ? <Shimmer w={160} h={18} /> : `Welcome back, ${fullName.split(" ")[0]}`}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: BLUE, letterSpacing: "0.1em",
                  background: "rgba(29,197,255,0.1)", border: "1px solid rgba(29,197,255,0.2)",
                  padding: "2px 8px", borderRadius: 20, textTransform: "uppercase" as const,
                }}>{role}</span>
                {!meLoading && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    fontSize: 11, fontWeight: 600,
                    color: emailVerified ? GREEN : "#f97316",
                  }}>
                    <span style={{
                      width: 5, height: 5, borderRadius: "50%", display: "inline-block",
                      background: emailVerified ? GREEN : "#f97316",
                      boxShadow: `0 0 5px ${emailVerified ? GREEN : "#f97316"}`,
                    }} />
                    {emailVerified ? "Verified account" : "Email not verified"}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <Link href="/campaigns">
              <button style={{
                padding: "9px 18px", borderRadius: 9,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.04)",
                color: "#8899aa", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>
                Browse
              </button>
            </Link>
            <Link href="/dashboard/my-campaigns">
              <button style={{
                padding: "9px 18px", borderRadius: 9, border: "none",
                background: `linear-gradient(135deg, ${BLUE}, #079bd4)`,
                color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
                boxShadow: "0 4px 16px rgba(29,197,255,0.3)",
              }}>
                + New Campaign
              </button>
            </Link>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px clamp(16px, 4vw, 48px)", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── KPI cards ── */}
        <motion.div {...fadeUp(0)} className="kpi-grid" style={{ display: "grid", gap: 12 }}>
          {/* Total raised — hero card */}
          <div style={{
            gridColumn: "span 1",
            padding: "22px 24px",
            background: "linear-gradient(135deg, rgba(27,191,136,0.12), rgba(27,191,136,0.04))",
            border: "1px solid rgba(27,191,136,0.2)",
            borderRadius: 16, position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", right: -20, top: -20, width: 100, height: 100, borderRadius: "50%", background: "rgba(27,191,136,0.08)" }} />
            <div style={{ fontSize: 11, color: GREEN, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 10 }}>Total raised</div>
            {campaignsLoading
              ? <Shimmer h={28} w="60%" />
              : <div style={{ fontSize: 26, fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.04em", lineHeight: 1 }}>
                  {fmt(totalRaised)}
                  <span style={{ fontSize: 13, fontWeight: 600, color: GREEN, marginLeft: 6 }}>GMD</span>
                </div>
            }
            <div style={{ fontSize: 12, color: "rgba(27,191,136,0.6)", marginTop: 6 }}>across {campaignCnt} campaign{campaignCnt !== 1 ? "s" : ""}</div>
          </div>

          <div style={{
            padding: "22px 24px",
            background: "#0d1120",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 16,
          }}>
            <div style={{ fontSize: 11, color: "#4a5568", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 10 }}>Active campaigns</div>
            {campaignsLoading
              ? <Shimmer h={28} w="40%" />
              : <div style={{ fontSize: 26, fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.04em", lineHeight: 1 }}>
                  {activeCnt}
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#4a5568", marginLeft: 6 }}>live</span>
                </div>
            }
            <div style={{ fontSize: 12, color: "#4a5568", marginTop: 6 }}>{campaignCnt - activeCnt} others not live</div>
          </div>

          <div style={{
            padding: "22px 24px",
            background: "#0d1120",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 16,
          }}>
            <div style={{ fontSize: 11, color: "#4a5568", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 10 }}>KYC status</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: kycApproved ? GREEN : kycPending ? BLUE : kycRejected ? "#ef4444" : "#f97316", letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 6 }}>
              {kycLoading ? <Shimmer h={22} w="50%" /> : kycApproved ? "Approved" : kycPending ? "Under review" : kycRejected ? "Rejected" : "Start verification"}
            </div>
            {!kycLoading && <KYCStatusChip status={kycState} />}
            <Link href="/dashboard/kyc">
              <span style={{ fontSize: 11, color: BLUE, fontWeight: 600, cursor: "pointer" }}>
                {kycApproved ? "View approval →" : kycPending ? "View progress →" : "Complete KYC →"}
              </span>
            </Link>
          </div>

          <div style={{
            padding: "22px 24px",
            background: "#0d1120",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 16,
          }}>
            <div style={{ fontSize: 11, color: "#4a5568", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 10 }}>Wave number</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Image src="/wave.png" alt="Wave" width={20} height={20} style={{ objectFit: "contain", borderRadius: 4 }} />
              {meLoading
                ? <Shimmer h={18} w="70%" />
                : <div style={{ fontSize: 14, fontWeight: 700, color: "#f0f6ff", letterSpacing: "-0.01em" }}>{wave}</div>
              }
            </div>
            <div style={{ fontSize: 12, color: "#4a5568" }}>Linked wallet</div>
          </div>
        </motion.div>

        {/* ── Main content: campaigns list + sidebar ── */}
        <div className="dash-grid" style={{ display: "grid", gap: 16, alignItems: "start" }}>

          {/* Campaigns list */}
          <motion.div {...fadeUp(0.08)}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f0f6ff" }}>My campaigns</div>
              <Link href="/dashboard/my-campaigns" style={{ fontSize: 12, color: BLUE, fontWeight: 600 }}>Manage all →</Link>
            </div>

            {campaignsLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[1,2,3].map((i) => <div key={i} style={{ height: 76, borderRadius: 12, background: "rgba(255,255,255,0.04)" }} />)}
              </div>
            ) : !campaigns || campaigns.length === 0 ? (
              /* Empty state — action-oriented, not sad */
              <div style={{
                padding: "36px 28px",
                background: "linear-gradient(135deg, rgba(29,197,255,0.04), rgba(7,155,212,0.02))",
                border: "1px dashed rgba(29,197,255,0.2)",
                borderRadius: 16, textAlign: "center",
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 14,
                  background: "rgba(29,197,255,0.08)", border: "1px solid rgba(29,197,255,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 16px",
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M12 5v14M5 12h14" stroke={BLUE} strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#f0f6ff", marginBottom: 6 }}>Launch your first campaign</div>
                <div style={{ fontSize: 13, color: "#6b7a8d", lineHeight: 1.7, marginBottom: 20, maxWidth: 320, margin: "0 auto 20px" }}>
                  Create a campaign, share your Wave QR code, and start collecting donations directly to your wallet.
                </div>
                <Link href="/dashboard/my-campaigns">
                  <button style={{
                    padding: "11px 24px", borderRadius: 10, border: "none",
                    background: `linear-gradient(135deg, ${BLUE}, #079bd4)`,
                    color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
                    boxShadow: "0 4px 16px rgba(29,197,255,0.3)",
                  }}>
                    Create campaign
                  </button>
                </Link>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {campaigns.map((c, idx) => {
                  const pct = c.target_amount && c.target_amount > 0
                    ? Math.min(100, Math.round((c.amount_raised / c.target_amount) * 100))
                    : null;
                  return (
                    <motion.div key={c.id} {...fadeUp(0.04 * idx)}>
                      <Link href={`/dashboard/my-campaigns/${c.id}/images`} style={{ textDecoration: "none" }}>
                        <div style={{
                          display: "flex", alignItems: "center", gap: 14,
                          padding: "14px 16px",
                          background: "#0d1120",
                          border: "1px solid rgba(255,255,255,0.07)",
                          borderRadius: 12, cursor: "pointer",
                          transition: "border-color 0.2s, background 0.2s",
                        }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(29,197,255,0.22)";
                            (e.currentTarget as HTMLDivElement).style.background = "rgba(29,197,255,0.04)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.07)";
                            (e.currentTarget as HTMLDivElement).style.background = "#0d1120";
                          }}
                        >
                          {/* Thumbnail */}
                          <div style={{ width: 48, height: 48, borderRadius: 10, overflow: "hidden", flexShrink: 0, position: "relative", background: "#1a2333" }}>
                            {c.cover_image_url ? (
                              <Image src={c.cover_image_url} alt={c.title} fill unoptimized sizes="48px" style={{ objectFit: "cover" }} />
                            ) : (
                              <div style={{
                                width: "100%", height: "100%",
                                background: "linear-gradient(135deg, #0d2340, #0a3d5c)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 18, fontWeight: 800, color: BLUE,
                              }}>
                                {c.title.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                              <span style={{ fontSize: 14, fontWeight: 700, color: "#f0f6ff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {c.title}
                              </span>
                              <CampaignStatusChip status={c.status} />
                            </div>
                            <div style={{ height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 99, overflow: "hidden" }}>
                              <div style={{
                                height: "100%", width: `${pct ?? 0}%`,
                                background: `linear-gradient(90deg, ${BLUE}, #079bd4)`,
                                borderRadius: 99, transition: "width 0.8s ease",
                              }} />
                            </div>
                          </div>

                          {/* Amount */}
                          <div style={{ textAlign: "right", flexShrink: 0, minWidth: 90 }}>
                            <div style={{ fontSize: 15, fontWeight: 800, color: GREEN, letterSpacing: "-0.02em" }}>
                              {fmt(c.amount_raised)} GMD
                            </div>
                            <div style={{ fontSize: 11, color: "#4a5568", marginTop: 2 }}>
                              {pct !== null ? `${pct}% funded` : "No target"}
                            </div>
                          </div>

                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                            <path d="M9 18l6-6-6-6" stroke="#4a5568" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* ── Sidebar ── */}
          <motion.div {...fadeUp(0.12)} style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Account card */}
            <div style={{
              background: "#0d1120",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 14, overflow: "hidden",
            }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#4a5568", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>Account</span>
              </div>
              {[
                { label: "Name", value: fullName },
                { label: "Email", value: email },
                { label: "User ID", value: `#${me?.id ?? "—"}` },
              ].map(({ label, value }, i, arr) => (
                <div key={label} style={{
                  padding: "11px 18px",
                  borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
                }}>
                  <span style={{ fontSize: 11, color: "#4a5568", flexShrink: 0 }}>{label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#c0ccd8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140, textAlign: "right" }}>
                    {meLoading ? "—" : value}
                  </span>
                </div>
              ))}
            </div>

            {/* Quick actions */}
            <div style={{
              background: "#0d1120",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 14, overflow: "hidden",
            }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#4a5568", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>Actions</span>
              </div>
              {[
                { label: "Manage campaigns", href: "/dashboard/my-campaigns", color: BLUE },
                { label: "Upload KYC docs", href: "/dashboard/kyc", color: GREEN },
                { label: "Upload proofs", href: "/dashboard/my-campaigns", color: "#a855f7" },
                { label: "Browse campaigns", href: "/campaigns", color: "#6b7a8d" },
              ].map(({ label, href, color }, i, arr) => (
                <Link key={label} href={href} style={{ textDecoration: "none" }}>
                  <div style={{
                    padding: "11px 18px",
                    borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    cursor: "pointer", transition: "background 0.15s",
                  }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 600, color }}>{label}</span>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                      <path d="M9 18l6-6-6-6" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </Link>
              ))}
            </div>

            {/* Email warning */}
            {!meLoading && !emailVerified && (
              <div style={{
                padding: "14px 16px",
                background: "rgba(249,115,22,0.07)",
                border: "1px solid rgba(249,115,22,0.2)",
                borderRadius: 12,
                display: "flex", gap: 10, alignItems: "flex-start",
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                  <path d="M12 9v4M12 17h.01" stroke="#f97316" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#f97316" strokeWidth="1.8"/>
                </svg>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#fb923c", marginBottom: 3 }}>Email not verified</div>
                  <div style={{ fontSize: 11, color: "#6b7a8d", lineHeight: 1.6 }}>Some features are locked. Check your inbox to verify.</div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      <style>{`
        .kpi-grid {
          grid-template-columns: repeat(2, 1fr);
        }
        .dash-grid {
          grid-template-columns: 1fr;
        }
        @media (min-width: 768px) {
          .kpi-grid {
            grid-template-columns: repeat(4, 1fr);
          }
          .dash-grid {
            grid-template-columns: 1fr 280px;
          }
        }
      `}</style>
    </div>
  );
}
