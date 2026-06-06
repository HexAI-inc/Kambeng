"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { humanize } from "@/lib/fmt";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  useAdminSystemStats,
  useAdminTransactions,
  useAdminCampaigns,
  useAdminUsers,
  useAdminCommissionsSummary,
  useAdminKYCQueue,
  useAdminModerationQueue,
  useAdminAuditLogs,
} from "@/hooks/use-frontend-data";
import { AdminTransaction, AdminAuditLog } from "@/types/frontend";

const BLUE = "#1dc5ff";
const GREEN = "#1bbf88";
const ORANGE = "#f97316";
const RED = "#ef4444";
const PURPLE = "#a855f7";

function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.38, delay, ease: "easeOut" as const },
  };
}

// ── KPI Card ────────────────────────────────────────────────────────────────
function KPI({
  label, value, sub, color, href,
}: {
  label: string; value: string | number; sub?: string; color?: string; href?: string;
}) {
  const content = (
    <div className="kpi-card" style={{
      background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14,
      padding: "20px 22px", display: "flex", flexDirection: "column", gap: 6,
      cursor: href ? "pointer" : "default", transition: "border-color 0.2s, transform 0.2s",
    }}
      onMouseEnter={(e) => { if (href) { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(29,197,255,0.3)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; } }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLDivElement).style.transform = ""; }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color: color ?? "#f0f6ff", letterSpacing: "-0.03em", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#6b7a8d" }}>{sub}</div>}
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: "none" }}>{content}</Link> : content;
}

// ── Chart tooltip ───────────────────────────────────────────────────────────
type TooltipPayloadItem = { dataKey: string; name: string; value: number | string; color: string };
type DarkTooltipProps = { active?: boolean; payload?: TooltipPayloadItem[]; label?: string; prefix?: string; suffix?: string };
function DarkTooltip({ active, payload, label, prefix = "", suffix = "" }: DarkTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px", fontSize: 12 }}>
      {label && <div style={{ color: "#8899aa", marginBottom: 6, fontWeight: 600 }}>{label}</div>}
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color, fontWeight: 700 }}>{p.name}: {prefix}{typeof p.value === "number" ? p.value.toFixed(2) : p.value}{suffix}</div>
      ))}
    </div>
  );
}

// ── Recent activity row ──────────────────────────────────────────────────────
function ActivityRow({ log }: { log: AdminAuditLog }) {
  const actionColor: Record<string, string> = {
    APPROVE: GREEN, REJECT: RED, SUSPEND: ORANGE, CREATE: BLUE, UPDATE: PURPLE, DELETE: RED,
  };
  const key = Object.keys(actionColor).find((k) => log.action_type?.toUpperCase().includes(k));
  const color = key ? actionColor[key] : "#8899aa";
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0, marginTop: 5 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: "#f0f6ff", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{humanize(log.action_type)}</div>
        <div style={{ fontSize: 11, color: "#6b7a8d", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.description}</div>
      </div>
      <div style={{ fontSize: 10, color: "#4a5568", flexShrink: 0 }}>{new Date(log.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div>
    </div>
  );
}

// ── Module-level timestamp (avoids calling Date.now() during render) ─────────
const MODULE_LOAD_TIME = Date.now();

// ── Main page ────────────────────────────────────────────────────────────────
export default function AdminOverviewPage() {
  const { data: stats, isLoading: statsLoading } = useAdminSystemStats();
  const { data: transactions } = useAdminTransactions();
  const { data: campaigns } = useAdminCampaigns();
  const { data: users } = useAdminUsers();
  const { data: commissions } = useAdminCommissionsSummary();
  const { data: kycQueue } = useAdminKYCQueue();
  const { data: modReports } = useAdminModerationQueue();
  const { data: auditLogs } = useAdminAuditLogs();

  const txList: AdminTransaction[] = transactions ?? [];

  // ── Donations over time (last 30 days, grouped by day) ───────────────────
  const donationTimeline = useMemo(() => {
    const donations = txList.filter((t) => t.transaction_type === "DONATION" && t.status === "SUCCEEDED");
    const byDay: Record<string, number> = {};
    const now = MODULE_LOAD_TIME;
    // seed last 14 days with 0
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now - i * 86400000);
      byDay[d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })] = 0;
    }
    donations.forEach((t) => {
      const day = new Date(t.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      if (day in byDay) byDay[day] = (byDay[day] ?? 0) + Number(t.gross_amount);
    });
    return Object.entries(byDay).map(([date, amount]) => ({ date, amount }));
  }, [txList]);

  // ── Transaction type breakdown (pie) ─────────────────────────────────────
  const txTypeBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    txList.forEach((t) => { counts[t.transaction_type] = (counts[t.transaction_type] ?? 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [txList]);

  const PIE_COLORS = [BLUE, GREEN, ORANGE, PURPLE, RED];

  // ── Campaign status breakdown (bar) ──────────────────────────────────────
  const campaignStatusData = useMemo(() => {
    const arr = campaigns ?? [];
    const active = arr.filter((c) => c.status === "ACTIVE").length;
    const suspended = arr.filter((c) => c.status === "SUSPENDED").length;
    const closed = arr.filter((c) => c.status === "CLOSED").length;
    return [
      { status: "Active", count: active, fill: GREEN },
      { status: "Suspended", count: suspended, fill: ORANGE },
      { status: "Closed", count: closed, fill: "#4a5568" },
    ];
  }, [campaigns]);

  // ── KYC breakdown ────────────────────────────────────────────────────────
  const kycBreakdown = useMemo(() => {
    const pending = (kycQueue ?? []).filter((k) => k.status === "SUBMITTED" || k.status === "REVIEWING").length;
    const approved = stats?.kyc_approved_count ?? 0;
    const rejected = stats?.kyc_rejected_count ?? 0;
    return [
      { name: "Approved", value: approved, color: GREEN },
      { name: "Pending", value: pending, color: ORANGE },
      { name: "Rejected", value: rejected, color: RED },
    ];
  }, [kycQueue, stats]);

  // ── Platform revenue bar per campaign ────────────────────────────────────
  const revenuePerCampaign = useMemo(() => {
    const map: Record<number, number> = {};
    txList.filter((t) => t.status === "SUCCEEDED").forEach((t) => {
      map[t.campaign_id] = (map[t.campaign_id] ?? 0) + Number(t.platform_commission ?? 0);
    });
    const arr = campaigns ?? [];
    return Object.entries(map)
      .map(([cid, rev]) => {
        const c = arr.find((x) => x.id === Number(cid));
        return { name: c ? (c.title.length > 22 ? c.title.slice(0, 22) + "…" : c.title) : `Campaign ${cid}`, revenue: rev };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  }, [txList, campaigns]);

  const totalRaised = txList.filter((t) => t.transaction_type === "DONATION" && t.status === "SUCCEEDED").reduce((s, t) => s + Number(t.gross_amount), 0);
  const openModReports = (modReports ?? []).filter((r) => r.status?.toLowerCase() === "open").length;
  const recentLogs: AdminAuditLog[] = ((auditLogs ?? []) as AdminAuditLog[]).slice(0, 12);

  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

  return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", padding: "28px clamp(16px,4vw,48px)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Header */}
        <motion.div {...fadeUp(0)}>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.03em" }}>Platform Overview</div>
          <div style={{ fontSize: 13, color: "#6b7a8d", marginTop: 4 }}>Real-time metrics across all Kambeng activity</div>
        </motion.div>

        {/* KPI row 1 */}
        <motion.div {...fadeUp(0.05)}>
          <div className="kpi-grid">
            <KPI label="Total Users" value={statsLoading ? "—" : fmt(stats?.total_users ?? 0)} sub="registered accounts" color="#f0f6ff" href="/admin/users" />
            <KPI label="Total Raised" value={statsLoading ? "—" : `${fmt(totalRaised)} GMD`} sub="all succeeded donations" color={GREEN} />
            <KPI label="Platform Revenue" value={statsLoading ? "—" : `${fmt(stats?.total_platform_revenue ?? 0)} GMD`} sub="commissions earned" color={BLUE} href="/admin/commissions" />
            <KPI label="Active Campaigns" value={statsLoading ? "—" : fmt(stats?.active_campaigns ?? 0)} sub={`of ${stats?.total_campaigns ?? 0} total`} color={ORANGE} href="/admin/campaigns" />
          </div>
        </motion.div>

        {/* KPI row 2 */}
        <motion.div {...fadeUp(0.09)}>
          <div className="kpi-grid">
            <KPI label="KYC Pending" value={statsLoading ? "—" : fmt(stats?.kyc_pending_count ?? 0)} sub="awaiting review" color={ORANGE} href="/admin/kyc-queue" />
            <KPI label="KYC Approved" value={statsLoading ? "—" : fmt(stats?.kyc_approved_count ?? 0)} sub="verified users" color={GREEN} href="/admin/kyc-queue" />
            <KPI label="Open Reports" value={openModReports} sub="moderation queue" color={RED} href="/admin/moderation" />
            <KPI label="Available Commission" value={commissions ? `${fmt(commissions.available_commissions)} GMD` : "—"} sub="ready to withdraw" color={PURPLE} href="/admin/commissions" />
          </div>
        </motion.div>

        {/* Charts row 1: Donations timeline + Transaction types */}
        <motion.div {...fadeUp(0.13)}>
        <div className="chart-row-1">
          {/* Area chart */}
          <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "20px 20px 12px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f0f6ff", marginBottom: 4 }}>Donations (Last 14 Days)</div>
            <div style={{ fontSize: 11, color: "#4a5568", marginBottom: 16 }}>Succeeded donation volume in GMD</div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={donationTimeline} margin={{ top: 0, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="donGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={BLUE} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={BLUE} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="4 4" />
                <XAxis dataKey="date" tick={{ fill: "#4a5568", fontSize: 10 }} axisLine={false} tickLine={false} interval={2} />
                <YAxis tick={{ fill: "#4a5568", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<DarkTooltip suffix=" GMD" />} />
                <Area type="monotone" dataKey="amount" name="Donations" stroke={BLUE} strokeWidth={2} fill="url(#donGrad)" dot={false} activeDot={{ r: 4, fill: BLUE }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Pie: tx types */}
          <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "20px 20px 12px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f0f6ff", marginBottom: 4 }}>Transaction Types</div>
            <div style={{ fontSize: 11, color: "#4a5568", marginBottom: 8 }}>Distribution by type</div>
            {txTypeBreakdown.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "#4a5568", fontSize: 13 }}>No transactions yet</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={txTypeBreakdown} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={3} dataKey="value">
                      {txTypeBreakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<DarkTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", justifyContent: "center" }}>
                  {txTypeBreakdown.map((item, i) => (
                    <div key={item.name} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#8899aa" }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      {item.name} ({item.value})
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        </motion.div>

        {/* Charts row 2: Revenue per campaign + KYC donut */}
        <motion.div {...fadeUp(0.17)}>
        <div className="chart-row-2">
          {/* Bar: revenue per campaign */}
          <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "20px 20px 12px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f0f6ff", marginBottom: 4 }}>Commission Revenue by Campaign</div>
            <div style={{ fontSize: 11, color: "#4a5568", marginBottom: 16 }}>Platform commission earned per campaign (GMD)</div>
            {revenuePerCampaign.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "#4a5568", fontSize: 13 }}>No commission data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={revenuePerCampaign} margin={{ top: 0, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "#4a5568", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#4a5568", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<DarkTooltip suffix=" GMD" />} />
                  <Bar dataKey="revenue" name="Revenue" radius={[6, 6, 0, 0]}>
                    {revenuePerCampaign.map((_, i) => <Cell key={i} fill={i === 0 ? BLUE : `rgba(29,197,255,${0.7 - i * 0.07})`} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* KYC status donut */}
          <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "20px 20px 12px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f0f6ff", marginBottom: 4 }}>KYC Status</div>
            <div style={{ fontSize: 11, color: "#4a5568", marginBottom: 8 }}>Verification breakdown</div>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={kycBreakdown} cx="50%" cy="50%" innerRadius={46} outerRadius={70} paddingAngle={3} dataKey="value">
                  {kycBreakdown.map((item, i) => <Cell key={i} fill={item.color} />)}
                </Pie>
                <Tooltip content={<DarkTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
              {kycBreakdown.map((item) => (
                <div key={item.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, color: "#8899aa" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: item.color }} />{item.name}
                  </div>
                  <span style={{ color: item.color, fontWeight: 700 }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        </motion.div>

        {/* Bottom row: Campaign status bar + Recent activity */}
        <motion.div {...fadeUp(0.21)}>
        <div className="chart-row-3">
          {/* Campaign status bar chart */}
          <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "20px 20px 12px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f0f6ff", marginBottom: 4 }}>Campaign Status Distribution</div>
            <div style={{ fontSize: 11, color: "#4a5568", marginBottom: 16 }}>Active vs suspended vs closed</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={campaignStatusData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="4 4" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#4a5568", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="status" tick={{ fill: "#8899aa", fontSize: 12 }} axisLine={false} tickLine={false} width={72} />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="count" name="Campaigns" radius={[0, 6, 6, 0]}>
                  {campaignStatusData.map((item, i) => <Cell key={i} fill={item.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Recent admin activity */}
          <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#f0f6ff" }}>Recent Activity</div>
                <div style={{ fontSize: 11, color: "#4a5568" }}>Latest admin actions</div>
              </div>
              <Link href="/admin/reports" style={{ fontSize: 11, color: BLUE, textDecoration: "none", fontWeight: 600 }}>View all →</Link>
            </div>
            <div style={{ overflowY: "auto", maxHeight: 240 }}>
              {recentLogs.length === 0 ? (
                <div style={{ color: "#4a5568", fontSize: 13, textAlign: "center", paddingTop: 40 }}>No activity yet</div>
              ) : recentLogs.map((log) => <ActivityRow key={log.id} log={log} />)}
            </div>
          </div>
        </div>
        </motion.div>

        {/* Quick links */}
        <motion.div {...fadeUp(0.25)}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Quick Actions</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {[
              { label: "Review KYC Queue", href: "/admin/kyc-queue", color: BLUE },
              { label: "Manage Campaigns", href: "/admin/campaigns", color: GREEN },
              { label: "Moderation", href: "/admin/moderation", color: RED },
              { label: "Financial Reports", href: "/admin/reports", color: ORANGE },
              { label: "User Management", href: "/admin/users", color: PURPLE },
              { label: "Commissions", href: "/admin/commissions", color: BLUE },
            ].map(({ label, href, color }) => (
              <Link key={href} href={href} style={{ textDecoration: "none" }}>
                <div style={{ padding: "9px 18px", borderRadius: 9, border: `1px solid ${color}30`, background: `${color}10`, color, fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.15s" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = `${color}20`; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = `${color}10`; }}
                >{label}</div>
              </Link>
            ))}
          </div>
        </motion.div>

      </div>

      <style>{`
        .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .chart-row-1, .chart-row-2, .chart-row-3 { display: grid; gap: 16px; }
        .chart-row-1 { grid-template-columns: 1fr 320px; }
        .chart-row-2 { grid-template-columns: 1fr 300px; }
        .chart-row-3 { grid-template-columns: 1fr 320px; }
        @media (max-width: 900px) {
          .kpi-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .chart-row-1, .chart-row-2, .chart-row-3 { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 540px) {
          .kpi-card { padding: 14px 12px !important; }
        }
      `}</style>
    </div>
  );
}
