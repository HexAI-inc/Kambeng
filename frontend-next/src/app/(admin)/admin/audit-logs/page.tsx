"use client";

import React from "react";
import { useAdminAuditLogs } from "@/hooks/use-frontend-data";

export default function AuditLogsPage() {
  const { data: logs } = useAdminAuditLogs(true);

  return (
    <div style={{ padding: "28px clamp(16px,4vw,48px)", minHeight: "100vh", background: "#0a0f1a" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: "#f0f6ff" }}>Audit Logs</h1>
        <div style={{ marginTop: 12 }}>
          <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 13, fontWeight: 700, color: "#f0f6ff" }}>Recent activity</div>
            <div style={{ display: "grid", gridTemplateColumns: "52px 140px 120px 1fr 100px", padding: "10px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 10, fontWeight: 700, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.07em" }}>
              {["ID", "Action", "Entity", "Description", "When"].map((h) => <div key={h}>{h}</div>)}
            </div>
            {(logs ?? []).length === 0 ? (
              <div style={{ padding: "36px 24px", textAlign: "center", color: "#4a5568", fontSize: 14 }}>No audit logs</div>
            ) : (logs ?? []).map((a, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "52px 140px 120px 1fr 100px", padding: "12px 18px", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.04)", transition: "background 0.15s" }}>
                <div style={{ fontSize: 12, color: "#4a5568" }}>#{a.id}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#1dc5ff" }}>{a.action_type}</div>
                <div style={{ fontSize: 12, color: "#8899aa" }}>{a.target_entity_type}</div>
                <div style={{ fontSize: 12, color: "#6b7a8d", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.description}</div>
                <div style={{ fontSize: 11, color: "#4a5568" }}>{new Date(a.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
