"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  useAdminAuditLogs,
  useAdminCampaigns,
  useAdminFinancialSummary,
  useAdminPayoutsOverview,
  useAdminSystemStats,
  useAdminTransactions,
} from "@/hooks/use-frontend-data";
import { AdminAuditLog, AdminPayoutOverview, AdminTransaction } from "@/types/frontend";

const BLUE = "#1dc5ff";
const GREEN = "#1bbf88";

function fadeUp(delay = 0) {
  return { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35, delay, ease: "easeOut" as const } };
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    SUCCEEDED: { color: GREEN,     bg: "rgba(27,191,136,0.12)" },
    FAILED:    { color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
    PENDING:   { color: "#f97316", bg: "rgba(249,115,22,0.12)" },
  };
  const s = map[status] ?? map.PENDING;
  return <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20, color: s.color, background: s.bg, textTransform: "uppercase", letterSpacing: "0.07em" }}>{status}</span>;
}

function TypeChip({ type }: { type: string }) {
  return <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20, color: BLUE, background: "rgba(29,197,255,0.1)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{type}</span>;
}

const PAGE_SIZE = 8;

export default function AdminReportsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { data: summary } = useAdminFinancialSummary(true);
  const { data: systemStats } = useAdminSystemStats(true);
  const { data: transactions } = useAdminTransactions(true);
  const { data: campaigns } = useAdminCampaigns(true);
  const { data: payouts } = useAdminPayoutsOverview(true);
  const { data: auditLogs } = useAdminAuditLogs(true);

  const [txPage, setTxPage] = useState(1);
  const [payPage, setPayPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);

  const statusFilter   = searchParams.get("status") ?? "ALL";
  const typeFilter     = searchParams.get("type") ?? "ALL";
  const campaignFilter = searchParams.get("campaign") ?? "ALL";

  const updateParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => { if (!v || v === "ALL") params.delete(k); else params.set(k, v); });
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  const filteredTx = useMemo(() => (transactions ?? []).filter((t) => {
    if (statusFilter !== "ALL" && String(t.status) !== statusFilter) return false;
    if (typeFilter !== "ALL" && String(t.transaction_type) !== typeFilter) return false;
    if (campaignFilter !== "ALL" && String(t.campaign_id) !== campaignFilter) return false;
    return true;
  }), [transactions, statusFilter, typeFilter, campaignFilter]);

  const txPages    = Math.max(1, Math.ceil(filteredTx.length / PAGE_SIZE));
  const payPages   = Math.max(1, Math.ceil((payouts ?? []).length / PAGE_SIZE));
  const auditPages = Math.max(1, Math.ceil((auditLogs ?? []).length / PAGE_SIZE));

  const txRows    = filteredTx.slice((txPage - 1) * PAGE_SIZE, txPage * PAGE_SIZE);
  const payRows   = (payouts ?? []).slice((payPage - 1) * PAGE_SIZE, payPage * PAGE_SIZE);
  const auditRows = (auditLogs ?? []).slice((auditPage - 1) * PAGE_SIZE, auditPage * PAGE_SIZE);

  const statusOptions   = useMemo(() => ["ALL", ...Array.from(new Set((transactions ?? []).map((t) => String(t.status ?? ""))))].filter(Boolean), [transactions]);
  const typeOptions     = useMemo(() => ["ALL", ...Array.from(new Set((transactions ?? []).map((t) => String(t.transaction_type ?? ""))))].filter(Boolean), [transactions]);
  const campaignOptions = useMemo(() => [{ id: "ALL", label: "All campaigns" }, ...((campaigns ?? []).map((c) => ({ id: String(c.id), label: c.title })))], [campaigns]);

  const selectStyle: React.CSSProperties = { padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f0f6ff", fontSize: 12, outline: "none", cursor: "pointer" };

  return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", padding: "28px clamp(16px,4vw,48px)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 22 }}>

        {/* Header */}
        <motion.div {...fadeUp(0)}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.03em" }}>Reports</div>
          <div style={{ fontSize: 13, color: "#6b7a8d", marginTop: 4 }}>Financial summary, transactions, payouts, and audit logs</div>
        </motion.div>

        {/* KPI grid */}
        <motion.div {...fadeUp(0.06)}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden", marginBottom: 2 }}>
            {[
              { label: "Transactions",      value: String(summary?.transaction_count ?? 0),                              color: "#f0f6ff" },
              { label: "Total Donations",   value: `${(summary?.total_donations ?? 0).toFixed(2)} GMD`,                  color: GREEN },
              { label: "Total Withdrawals", value: `${(summary?.total_withdrawals ?? 0).toFixed(2)} GMD`,                color: BLUE },
              { label: "Platform Revenue",  value: `${(systemStats?.total_platform_revenue ?? 0).toFixed(2)} GMD`,       color: "#f97316" },
            ].map(({ label, value, color }, i, arr) => (
              <div key={label} style={{ padding: "14px 18px", borderRight: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                <div style={{ fontSize: 10, color: "#4a5568", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden" }}>
            {[
              { label: "Users",          value: String(systemStats?.total_users ?? 0),          color: "#f0f6ff" },
              { label: "Active Campaigns",value: String(systemStats?.active_campaigns ?? 0),    color: GREEN },
              { label: "KYC Pending",    value: String(systemStats?.kyc_pending_count ?? 0),    color: "#f97316" },
              { label: "KYC Approved",   value: String(systemStats?.kyc_approved_count ?? 0),   color: GREEN },
            ].map(({ label, value, color }, i, arr) => (
              <div key={label} style={{ padding: "14px 18px", borderRight: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                <div style={{ fontSize: 10, color: "#4a5568", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div {...fadeUp(0.1)}>
          <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "16px 18px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <select value={statusFilter} onChange={(e) => updateParams({ status: e.target.value })} style={selectStyle}>
              {statusOptions.map((s) => <option key={s} value={s}>{s === "ALL" ? "All statuses" : s}</option>)}
            </select>
            <select value={typeFilter} onChange={(e) => updateParams({ type: e.target.value })} style={selectStyle}>
              {typeOptions.map((t) => <option key={t} value={t}>{t === "ALL" ? "All types" : t}</option>)}
            </select>
            <select value={campaignFilter} onChange={(e) => updateParams({ campaign: e.target.value })} style={{ ...selectStyle, minWidth: 200 }}>
              {campaignOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <button onClick={() => updateParams({ status: null, type: null, campaign: null })} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#8899aa", fontSize: 12, cursor: "pointer" }}>Reset</button>
            <span style={{ fontSize: 12, color: "#4a5568" }}>{filteredTx.length} transaction{filteredTx.length !== 1 ? "s" : ""}</span>
            {campaignFilter !== "ALL" && (
              <Link href={`/admin/reports/campaign/${campaignFilter}`} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: `linear-gradient(135deg, ${BLUE}, #079bd4)`, color: "#fff", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
                Campaign Report
              </Link>
            )}
          </div>
        </motion.div>

        {/* Transactions table */}
        <AdminTable
          title="Transactions"
          headers={["ID", "Campaign", "Type", "Status", "Gross", "Net", "Reference", "Date"]}
          cols="52px 80px 120px 110px 100px 100px 140px 90px"
          rows={txRows}
          renderRow={(t: AdminTransaction) => [
            <span style={{ fontSize: 12, color: "#4a5568" }}>#{t.id}</span>,
            <Link href={`/admin/reports/campaign/${t.campaign_id}`} style={{ color: BLUE, fontSize: 12, fontWeight: 600, textDecoration: "none" }}>#{t.campaign_id}</Link>,
            <TypeChip type={String(t.transaction_type)} />,
            <StatusChip status={String(t.status)} />,
            <span style={{ fontSize: 13, color: "#f0f6ff" }}>{t.gross_amount}</span>,
            <span style={{ fontSize: 13, color: GREEN }}>{t.net_amount}</span>,
            <span style={{ fontSize: 11, color: "#4a5568", fontFamily: "monospace" }}>{t.external_reference || "—"}</span>,
            <span style={{ fontSize: 11, color: "#4a5568" }}>{new Date(t.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>,
          ]}
          page={txPage}
          totalPages={txPages}
          onPageChange={setTxPage}
          emptyText="No transactions match these filters"
        />

        {/* Payouts table */}
        <AdminTable
          title="Payouts"
          headers={["Payout", "Campaign", "User", "Gross", "Net", "Status", "Date"]}
          cols="80px 1fr 140px 110px 110px 110px 90px"
          rows={payRows}
          renderRow={(p: AdminPayoutOverview) => [
            <span style={{ fontSize: 12, color: "#4a5568" }}>#{p.payout_id}</span>,
            <span style={{ fontSize: 13, color: "#f0f6ff", fontWeight: 600 }}>{p.campaign_title}</span>,
            <span style={{ fontSize: 12, color: "#8899aa" }}>{p.user_name}</span>,
            <span style={{ fontSize: 13, color: "#f0f6ff" }}>{p.gross_amount}</span>,
            <span style={{ fontSize: 13, color: GREEN }}>{p.net_amount}</span>,
            <StatusChip status={String(p.status)} />,
            <span style={{ fontSize: 11, color: "#4a5568" }}>{new Date(p.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>,
          ]}
          page={payPage}
          totalPages={payPages}
          onPageChange={setPayPage}
          emptyText="No payouts yet"
        />

        {/* Audit logs table */}
        <AdminTable
          title="Audit Logs"
          headers={["ID", "Action", "Entity", "Description", "When"]}
          cols="52px 140px 120px 1fr 100px"
          rows={auditRows}
          renderRow={(a: AdminAuditLog) => [
            <span style={{ fontSize: 12, color: "#4a5568" }}>#{a.id}</span>,
            <span style={{ fontSize: 12, fontWeight: 700, color: BLUE }}>{a.action_type}</span>,
            <span style={{ fontSize: 12, color: "#8899aa" }}>{a.target_entity_type}</span>,
            <span style={{ fontSize: 12, color: "#6b7a8d", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.description}</span>,
            <span style={{ fontSize: 11, color: "#4a5568" }}>{new Date(a.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>,
          ]}
          page={auditPage}
          totalPages={auditPages}
          onPageChange={setAuditPage}
          emptyText="No audit logs"
        />
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function AdminTable<T>({ title, headers, cols, rows, renderRow, page, totalPages, onPageChange, emptyText }: {
  title: string;
  headers: string[];
  cols: string;
  rows: T[];
  renderRow: (row: T) => React.ReactNode[];
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  emptyText: string;
}) {
  return (
    <div>
      <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 13, fontWeight: 700, color: "#f0f6ff" }}>{title}</div>
        <div style={{ display: "grid", gridTemplateColumns: cols, padding: "10px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 10, fontWeight: 700, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          {headers.map((h) => <div key={h}>{h}</div>)}
        </div>
        {rows.length === 0 ? (
          <div style={{ padding: "36px 24px", textAlign: "center", color: "#4a5568", fontSize: 14 }}>{emptyText}</div>
        ) : rows.map((row, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: cols, padding: "12px 18px", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.04)", transition: "background 0.15s", gap: 8 }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.02)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = ""; }}
          >
            {renderRow(row).map((cell, j) => <div key={j}>{cell}</div>)}
          </div>
        ))}
      </div>
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 10 }}>
          <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1} style={pageBtnStyle(false)}>←</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => <button key={p} onClick={() => onPageChange(p)} style={pageBtnStyle(p === page)}>{p}</button>)}
          <button onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages} style={pageBtnStyle(false)}>→</button>
        </div>
      )}
    </div>
  );
}

function pageBtnStyle(active: boolean): React.CSSProperties {
  return { width: 32, height: 32, borderRadius: 8, fontSize: 13, fontWeight: 700, border: `1px solid ${active ? "rgba(29,197,255,0.4)" : "rgba(255,255,255,0.1)"}`, background: active ? "rgba(29,197,255,0.12)" : "rgba(255,255,255,0.03)", color: active ? "#1dc5ff" : "#8899aa", cursor: "pointer" };
}
