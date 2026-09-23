"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAdminSuccessfulDonations } from "@/hooks/use-frontend-data";
import type { AdminDonation } from "@/types/frontend";

const BLUE = "#14784a";
const GREEN = "#1f9960";
const RED = "#d42f2f";

function fadeUp(delay = 0) {
  return { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35, delay, ease: "easeOut" as const } };
}

function StatusChip({ status }: { status: string }) {
  const s = status.toLowerCase();
  const map: Record<string, { color: string; bg: string; border: string }> = {
    pending:   { color: "#e8650f", bg: "#fdf0e7", border: "rgba(232,101,15,0.25)" },
    approved:  { color: GREEN,     bg: "#e9f5ef", border: "rgba(31,153,96,0.25)" },
    completed: { color: BLUE,      bg: "#e8f2ed", border: "rgba(20,120,74,0.2)" },
    rejected:  { color: RED,       bg: "#fdecec",  border: "rgba(239,68,68,0.25)" },
  };
  const cfg = map[s] ?? map.pending;
  return <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 20, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>{status}</span>;
}

const PAGE_SIZE = 10;

export default function DonationsPage() {
  const router = useRouter();
  const { data: donations, isLoading } = useAdminSuccessfulDonations();
  const [page, setPage] = useState(1);

  const rows = donations ?? [];
  const completedCount = rows.filter((d) => d.status.toLowerCase() === "succeeded").length;
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  return (
    <div style={{ minHeight: "100vh", padding: "28px clamp(16px,4vw,48px)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Header + stats */}
        <motion.div {...fadeUp(0)}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#15201a", letterSpacing: "-0.03em" }}>Donations Overview</div>
              <div style={{ fontSize: 13, color: "#626d66", marginTop: 4 }}>Snapshot of successful donations recorded on the platform.</div>
            </div>
            <button onClick={() => router.push("/admin/reconciliations")} style={{ padding: "9px 16px", borderRadius: 9, border: "1px solid rgba(20,120,74,0.2)", background: "#ecf4f1", color: "#14784a", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              Open reconciliation workspace
            </button>
          </div>
          <div className="admin-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2, background: "#fff", border: "1px solid rgba(21,32,26,0.07)", borderRadius: 12, overflow: "hidden" }}>
            {[
              { label: "Successful", value: String(completedCount), color: GREEN },
              { label: "Failed or pending", value: String(rows.length - completedCount), color: "#56625b" },
              { label: "Total loaded", value: String(rows.length), color: "#15201a" },
            ].map(({ label, value, color }, i, arr) => (
              <div key={label} style={{ padding: "12px 18px", borderRight: i < arr.length - 1 ? "1px solid rgba(21,32,26,0.05)" : "none" }}>
                <div style={{ fontSize: 10, color: "#6e7872", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Table */}
        <motion.div {...fadeUp(0.08)}>
          <div style={{ background: "#ffffff", border: "1px solid rgba(21,32,26,0.07)", borderRadius: 16, overflowX: "auto" }}>
            <div className="admin-table-wrap" style={{ minWidth: 780 }}>
            <div className="admin-table-header" style={{ display: "grid", gridTemplateColumns: "140px 1fr 120px 100px 100px 100px 180px", padding: "10px 18px", borderBottom: "1px solid rgba(21,32,26,0.06)", fontSize: 10, fontWeight: 700, color: "#6e7872", textTransform: "uppercase", letterSpacing: "0.07em" }}>
              <div>Reference</div><div>Campaign</div><div>Donor</div><div>Amount</div><div>Status</div><div>Source</div><div>Review</div>
            </div>

            {isLoading ? (
              <div style={{ padding: 40, textAlign: "center" }}>
                <div style={{ width: 32, height: 32, border: `2px solid ${BLUE}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
                <div style={{ color: "#6e7872", fontSize: 13 }}>Loading donations…</div>
              </div>
            ) : rows.length === 0 ? (
              <div style={{ padding: "48px 24px", textAlign: "center", color: "#6e7872", fontSize: 14 }}>No successful donations found</div>
            ) : pageRows.map((d: AdminDonation) => {
              return (
                <div key={d.client_reference} className="admin-table-row" style={{ display: "grid", gridTemplateColumns: "140px 1fr 120px 100px 100px 100px 180px", padding: "13px 18px", alignItems: "center", borderBottom: "1px solid rgba(21,32,26,0.04)", transition: "background 0.15s" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(21,32,26,0.02)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = ""; }}
                >
                  <div data-label="Reference" style={{ fontSize: 11, fontFamily: "monospace", color: "#56625b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.client_reference}</div>
                  <div data-label="Campaign" style={{ fontSize: 13, color: "#15201a", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.campaign_title}</div>
                  <div data-label="Donor" style={{ fontSize: 12, color: "#56625b" }}>{d.donor_name || "Anonymous"}</div>
                  <div data-label="Amount" style={{ fontSize: 13, fontWeight: 700, color: GREEN }}>{d.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span style={{ fontSize: 10, color: "#6e7872" }}>GMD</span></div>
                  <div data-label="Status"><StatusChip status={d.status} /></div>
                  <div data-label="Source" style={{ fontSize: 12, color: "#6e7872" }}>{d.reconciliation_source || "—"}</div>
                  <div data-label="Review">
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button onClick={() => router.push(`/admin/campaigns/${d.campaign_id}/view`)} style={btnStyle("default")}>Campaign</button>
                      <span style={{ fontSize: 11, color: "#6e7872", padding: "5px 0" }}>Successful</span>
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        </motion.div>

        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 4 }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={pageBtnStyle(false)}>←</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => <button key={p} onClick={() => setPage(p)} style={pageBtnStyle(p === page)}>{p}</button>)}
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={pageBtnStyle(false)}>→</button>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function btnStyle(v: "default" | "green" | "red"): React.CSSProperties {
  const m = { default: { c: "#56625b", b: "rgba(21,32,26,0.1)", bg: "rgba(21,32,26,0.04)" }, green: { c: "#1f9960", b: "rgba(31,153,96,0.25)", bg: "#edf7f2" }, red: { c: "#d42f2f", b: "rgba(239,68,68,0.25)", bg: "#fef0f0" } }[v];
  return { padding: "5px 11px", borderRadius: 7, fontSize: 11, fontWeight: 700, border: `1px solid ${m.b}`, background: m.bg, color: m.c, cursor: "pointer" };
}
function pageBtnStyle(active: boolean): React.CSSProperties {
  return { width: 32, height: 32, borderRadius: 8, fontSize: 13, fontWeight: 700, border: `1px solid ${active ? "rgba(20,120,74,0.4)" : "rgba(21,32,26,0.1)"}`, background: active ? "rgba(20,120,74,0.12)" : "rgba(21,32,26,0.03)", color: active ? "#14784a" : "#56625b", cursor: "pointer" };
}
