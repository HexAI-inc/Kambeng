"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { useAdminCampaignFinancialReport, useAdminCampaigns, useAdminTransactions } from "@/hooks/use-frontend-data";
import { AdminTransaction } from "@/types/frontend";

const BLUE = "#1dc5ff";
const GREEN = "#1bbf88";

function fadeUp(delay = 0) {
  return { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35, delay, ease: "easeOut" as const } };
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    SUCCEEDED: { color: GREEN, bg: "rgba(27,191,136,0.12)" },
    FAILED:    { color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
    PENDING:   { color: "#f97316", bg: "rgba(249,115,22,0.12)" },
  };
  const s = map[status] ?? map.PENDING;
  return <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20, color: s.color, background: s.bg, textTransform: "uppercase", letterSpacing: "0.07em" }}>{status}</span>;
}

const PAGE_SIZE = 10;

export default function CampaignReportDetailPage() {
  const params = useParams<{ campaignId: string }>();
  const campaignId = Number(params?.campaignId ?? 0);
  const [page, setPage] = useState(1);

  const { data: campaigns } = useAdminCampaigns(true);
  const { data: summary, isLoading, isError } = useAdminCampaignFinancialReport(campaignId, true);
  const { data: transactions } = useAdminTransactions(true);

  const campaign = useMemo(() => (campaigns ?? []).find((c) => c.id === campaignId), [campaigns, campaignId]);
  const campaignTx = useMemo(() => (transactions ?? []).filter((t) => t.campaign_id === campaignId), [transactions, campaignId]);

  const totalPages = Math.max(1, Math.ceil(campaignTx.length / PAGE_SIZE));
  const pageRows = campaignTx.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (!campaignId) {
    return (
      <div style={{ background: "#0a0f1a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "#ef4444" }}>Invalid campaign ID</div>
      </div>
    );
  }

  return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", padding: "28px clamp(16px,4vw,48px)" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Header */}
        <motion.div {...fadeUp(0)}>
          <Link href="/admin/reports" style={{ fontSize: 12, color: BLUE, textDecoration: "none", fontWeight: 600 }}>← Back to Reports</Link>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.03em", marginTop: 8 }}>Campaign Report #{campaignId}</div>
          {campaign && <div style={{ fontSize: 13, color: "#6b7a8d", marginTop: 4 }}>{campaign.title}</div>}
        </motion.div>

        {isError && (
          <div style={{ padding: "14px 18px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#fca5a5", fontSize: 13 }}>
            Unable to load campaign report. This campaign may not exist or your session lacks access.
          </div>
        )}

        {/* KPIs */}
        <motion.div {...fadeUp(0.06)}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden" }}>
            {[
              { label: "Transactions",    value: isLoading ? "—" : String(summary?.transaction_count ?? 0),                color: "#f0f6ff" },
              { label: "Total Donations", value: isLoading ? "—" : `${(summary?.total_donations ?? 0).toFixed(2)} GMD`,    color: GREEN },
              { label: "Withdrawals",     value: isLoading ? "—" : `${(summary?.total_withdrawals ?? 0).toFixed(2)} GMD`,  color: BLUE },
              { label: "Net Total",       value: isLoading ? "—" : `${(summary?.net_total ?? 0).toFixed(2)} GMD`,          color: "#f97316" },
            ].map(({ label, value, color }, i, arr) => (
              <div key={label} style={{ padding: "16px 20px", borderRight: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                <div style={{ fontSize: 10, color: "#4a5568", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Transactions */}
        <motion.div {...fadeUp(0.1)}>
          <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 13, fontWeight: 700, color: "#f0f6ff" }}>
              Campaign Transactions ({campaignTx.length})
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "52px 120px 110px 100px 100px 1fr 90px", padding: "10px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 10, fontWeight: 700, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.07em" }}>
              <div>ID</div><div>Type</div><div>Status</div><div>Gross</div><div>Net</div><div>Reference</div><div>Date</div>
            </div>
            {pageRows.length === 0 ? (
              <div style={{ padding: "40px 24px", textAlign: "center", color: "#4a5568", fontSize: 14 }}>No transactions for this campaign</div>
            ) : pageRows.map((t: AdminTransaction, i) => (
              <div key={t.id} style={{ display: "grid", gridTemplateColumns: "52px 120px 110px 100px 100px 1fr 90px", padding: "12px 18px", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.04)", transition: "background 0.15s" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.02)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = ""; }}
              >
                <div style={{ fontSize: 12, color: "#4a5568" }}>#{t.id}</div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20, color: BLUE, background: "rgba(29,197,255,0.1)", textTransform: "uppercase" }}>{String(t.transaction_type)}</span>
                <StatusChip status={String(t.status)} />
                <div style={{ fontSize: 13, color: "#f0f6ff" }}>{t.gross_amount}</div>
                <div style={{ fontSize: 13, color: GREEN }}>{t.net_amount}</div>
                <div style={{ fontSize: 11, color: "#4a5568", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.external_reference || "—"}</div>
                <div style={{ fontSize: 11, color: "#4a5568" }}>{new Date(t.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 10 }}>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={pageBtnStyle(false)}>←</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => <button key={p} onClick={() => setPage(p)} style={pageBtnStyle(p === page)}>{p}</button>)}
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={pageBtnStyle(false)}>→</button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function pageBtnStyle(active: boolean): React.CSSProperties {
  return { width: 32, height: 32, borderRadius: 8, fontSize: 13, fontWeight: 700, border: `1px solid ${active ? "rgba(29,197,255,0.4)" : "rgba(255,255,255,0.1)"}`, background: active ? "rgba(29,197,255,0.12)" : "rgba(255,255,255,0.03)", color: active ? "#1dc5ff" : "#8899aa", cursor: "pointer" };
}
