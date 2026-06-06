"use client";

import React from "react";
import { motion } from "framer-motion";
import { useAdminPayoutsOverview } from "@/hooks/use-frontend-data";
import type { AdminPayoutOverview } from "@/types/frontend";

const BLUE = "#1dc5ff";
const GREEN = "#1bbf88";

function fadeUp(delay = 0) {
  return { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35, delay, ease: "easeOut" as const } };
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string; border: string }> = {
    PENDING:   { color: "#f97316", bg: "rgba(249,115,22,0.1)",  border: "rgba(249,115,22,0.25)" },
    SUCCEEDED: { color: GREEN,     bg: "rgba(27,191,136,0.1)",  border: "rgba(27,191,136,0.25)" },
    FAILED:    { color: "#ef4444", bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.25)" },
  };
  const s = map[status] ?? map.PENDING;
  return <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 20, color: s.color, background: s.bg, border: `1px solid ${s.border}` }}>{status}</span>;
}

export default function PayoutsPage() {
  const { data: payouts } = useAdminPayoutsOverview(true);
  const rows = payouts ?? [];

  const totalGross = rows.reduce((s, p) => s + (p.gross_amount || 0), 0);
  const totalNet   = rows.reduce((s, p) => s + (p.net_amount || 0), 0);
  const pending    = rows.filter((p) => p.status === "PENDING").length;

  return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", padding: "28px clamp(16px,4vw,48px)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

        <motion.div {...fadeUp(0)}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.03em" }}>Payouts</div>
          <div style={{ fontSize: 13, color: "#6b7a8d", marginTop: 4 }}>Campaign withdrawal history</div>
        </motion.div>

        <motion.div {...fadeUp(0.06)}>
          <div className="admin-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, overflow: "hidden" }}>
            {[
              { label: "Total paid out (gross)", value: `${totalGross.toFixed(2)} GMD`, color: "#f0f6ff" },
              { label: "Net received",           value: `${totalNet.toFixed(2)} GMD`,   color: GREEN },
              { label: "Pending payouts",        value: String(pending),                color: pending > 0 ? "#f97316" : "#4a5568" },
            ].map(({ label, value, color }, i, arr) => (
              <div key={label} style={{ padding: "14px 20px", borderRight: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                <div style={{ fontSize: 10, color: "#4a5568", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div {...fadeUp(0.1)}>
          <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflowX: "auto" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 13, fontWeight: 700, color: "#f0f6ff" }}>All payouts</div>
            <div className="admin-table-wrap" style={{ minWidth: 680 }}>
              <div className="admin-table-header" style={{ display: "grid", gridTemplateColumns: "160px 1fr 160px 110px 110px 110px 90px", padding: "10px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 10, fontWeight: 700, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                {["Reference", "Campaign", "Recipient", "Gross", "Net", "Status", "Date"].map((h) => <div key={h}>{h}</div>)}
              </div>
              {rows.length === 0 ? (
                <div style={{ padding: "36px 24px", textAlign: "center", color: "#4a5568", fontSize: 14 }}>No payouts yet</div>
              ) : rows.map((p: AdminPayoutOverview, i) => (
                <div key={i} className="admin-table-row" style={{ display: "grid", gridTemplateColumns: "160px 1fr 160px 110px 110px 110px 90px", padding: "12px 18px", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.04)", transition: "background 0.15s" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.02)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = ""; }}
                >
                  <div data-label="Reference" style={{ fontSize: 11, fontFamily: "monospace", color: "#8899aa" }}>{(p as unknown as { client_reference?: string }).client_reference ?? `OUT-${p.payout_id}`}</div>
                  <div data-label="Campaign" style={{ fontSize: 13, color: "#f0f6ff", fontWeight: 600 }}>{p.campaign_title}</div>
                  <div data-label="Recipient" style={{ fontSize: 12, color: "#8899aa" }}>{p.user_name}</div>
                  <div data-label="Gross" style={{ fontSize: 13, color: "#f0f6ff" }}>{Number(p.gross_amount).toFixed(2)} <span style={{ fontSize: 10, color: "#4a5568" }}>GMD</span></div>
                  <div data-label="Net" style={{ fontSize: 13, color: GREEN, fontWeight: 700 }}>{Number(p.net_amount).toFixed(2)} <span style={{ fontSize: 10, color: "#4a5568" }}>GMD</span></div>
                  <div data-label="Status"><StatusChip status={p.status} /></div>
                  <div data-label="Date" style={{ fontSize: 11, color: "#4a5568" }}>{new Date(p.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
