"use client";

import Link from "next/link";
import { motion } from "framer-motion";

import {
  useMyDonations,
  useMySubscriptions,
  useToggleCampaignSubscription,
  useSessionProfile,
} from "@/hooks/use-frontend-data";

const BLUE = "#14784a";
const GREEN = "#1f9960";
const RED = "#d42f2f";

function fade(delay = 0) {
  return { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.32, delay, ease: "easeOut" as const } };
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string; border: string; label: string }> = {
    SUCCEEDED: { color: GREEN,     bg: "rgba(31,153,96,0.1)", border: "rgba(31,153,96,0.25)", label: "Completed" },
    PENDING:   { color: "#e8650f", bg: "rgba(232,101,15,0.1)", border: "rgba(232,101,15,0.25)", label: "Pending" },
    FAILED:    { color: RED,       bg: "rgba(239,68,68,0.1)",  border: "rgba(239,68,68,0.25)",  label: "Failed" },
  };
  const s = map[status] ?? map.PENDING;
  return <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 20, color: s.color, background: s.bg, border: `1px solid ${s.border}`, whiteSpace: "nowrap" }}>{s.label}</span>;
}

export default function MyDonationsPage() {
  const { data: me } = useSessionProfile(true);
  const { data: donations, isLoading: donationsLoading } = useMyDonations(Boolean(me));
  const { data: subscriptions, isLoading: subsLoading } = useMySubscriptions(Boolean(me));
  const toggleSubscription = useToggleCampaignSubscription();

  const totalGiven = (donations ?? [])
    .filter((d) => d.status === "SUCCEEDED")
    .reduce((sum, d) => sum + d.amount, 0);

  return (
    <div style={{ background: "#f6f4ef", minHeight: "100vh", padding: "28px clamp(16px,4vw,48px)" }}>
      <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

        <motion.div {...fade(0)}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#15201a", letterSpacing: "-0.03em" }}>My Giving</div>
          <div style={{ fontSize: 13, color: "#626d66", marginTop: 4 }}>Your donation history and the campaigns you follow</div>
        </motion.div>

        {/* Summary strip */}
        <motion.div {...fade(0.04)}>
          <div className="giving-kpis" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2, background: "rgba(21,32,26,0.04)", border: "1px solid rgba(21,32,26,0.07)", borderRadius: 12, overflow: "hidden" }}>
            {[
              { label: "Total given", value: `${totalGiven.toLocaleString()} GMD`, color: GREEN },
              { label: "Donations", value: String((donations ?? []).length), color: "#15201a" },
              { label: "Following", value: String((subscriptions ?? []).length), color: BLUE },
            ].map(({ label, value, color }, i, arr) => (
              <div key={label} style={{ padding: "14px 20px", borderRight: i < arr.length - 1 ? "1px solid rgba(21,32,26,0.05)" : "none" }}>
                <div style={{ fontSize: 10, color: "#6e7872", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Donation history */}
        <motion.div {...fade(0.08)}>
          <div style={{ background: "#ffffff", border: "1px solid rgba(21,32,26,0.07)", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(21,32,26,0.06)", fontSize: 13, fontWeight: 700, color: "#15201a" }}>Donation history</div>
            {donationsLoading ? (
              <div style={{ padding: "36px 24px", textAlign: "center", color: "#6e7872", fontSize: 13 }}>Loading…</div>
            ) : (donations ?? []).length === 0 ? (
              <div style={{ padding: "40px 24px", textAlign: "center" }}>
                <div style={{ color: "#56625b", fontSize: 14, marginBottom: 12 }}>No donations yet — sign in before giving and your history collects here.</div>
                <Link href="/campaigns" style={{ display: "inline-block", padding: "9px 20px", borderRadius: 9, background: `${BLUE}`, color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                  Browse campaigns
                </Link>
              </div>
            ) : (donations ?? []).map((donation) => (
              <div key={donation.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", borderBottom: "1px solid rgba(21,32,26,0.04)", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <Link href={`/campaigns/${donation.campaign_slug}`} style={{ fontSize: 13, fontWeight: 700, color: "#15201a", textDecoration: "none" }}>
                    {donation.campaign_title}
                  </Link>
                  <div style={{ fontSize: 11, color: "#6e7872", marginTop: 2 }}>
                    {donation.created_at ? new Date(donation.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                    {donation.message ? <span style={{ color: "#626d66" }}> · “{donation.message}”</span> : null}
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: donation.status === "SUCCEEDED" ? GREEN : "#56625b" }}>
                  {donation.amount.toLocaleString()} <span style={{ fontSize: 10, color: "#6e7872" }}>GMD</span>
                </div>
                <StatusChip status={donation.status} />
              </div>
            ))}
          </div>
        </motion.div>

        {/* Following */}
        <motion.div {...fade(0.12)}>
          <div style={{ background: "#ffffff", border: "1px solid rgba(21,32,26,0.07)", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(21,32,26,0.06)", fontSize: 13, fontWeight: 700, color: "#15201a" }}>
              Following <span style={{ color: "#6e7872", fontWeight: 600 }}>— you get an email when these campaigns post updates</span>
            </div>
            {subsLoading ? (
              <div style={{ padding: "36px 24px", textAlign: "center", color: "#6e7872", fontSize: 13 }}>Loading…</div>
            ) : (subscriptions ?? []).length === 0 ? (
              <div style={{ padding: "36px 24px", textAlign: "center", color: "#56625b", fontSize: 13 }}>
                Not following any campaigns yet. Use “Get updates” on a campaign page to follow it.
              </div>
            ) : (subscriptions ?? []).map((subscription) => (
              <div key={subscription.campaign_id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", borderBottom: "1px solid rgba(21,32,26,0.04)", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <Link href={`/campaigns/${subscription.campaign_slug}`} style={{ fontSize: 13, fontWeight: 700, color: "#15201a", textDecoration: "none" }}>
                    {subscription.campaign_title}
                  </Link>
                  <div style={{ fontSize: 11, color: "#6e7872", marginTop: 2 }}>
                    {subscription.campaign_status} · following since {subscription.subscribed_at ? new Date(subscription.subscribed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                  </div>
                </div>
                <button
                  onClick={() => toggleSubscription.mutate({ slug: subscription.campaign_slug, subscribe: false })}
                  disabled={toggleSubscription.isPending}
                  style={{ padding: "5px 12px", borderRadius: 7, fontSize: 11, fontWeight: 700, border: "1px solid rgba(21,32,26,0.1)", background: "rgba(21,32,26,0.04)", color: "#56625b", cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  Unfollow
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
      <style>{`
        @media (max-width: 480px) {
          .giving-kpis { grid-template-columns: 1fr !important; }
          .giving-kpis > div { border-right: none !important; border-bottom: 1px solid rgba(21,32,26,0.05); }
        }
      `}</style>
    </div>
  );
}
