"use client";

import React from "react";
import { useAdminAuditLogs } from "@/hooks/use-frontend-data";

export default function AuditLogsPage() {
  const { data: logs } = useAdminAuditLogs(true);

  return (
    <div style={{ padding: "28px clamp(16px,4vw,48px)", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: "#15201a" }}>Audit Logs</h1>
        <div style={{ marginTop: 12 }}>
          <div style={{ background: "#ffffff", border: "1px solid rgba(21,32,26,0.07)", borderRadius: 16, overflowX: "auto" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(21,32,26,0.06)", fontSize: 13, fontWeight: 700, color: "#15201a" }}>Recent activity</div>
            <div className="admin-table-wrap" style={{ minWidth: 520 }}>
              <div className="admin-table-header" style={{ display: "grid", gridTemplateColumns: "160px 100px 1fr 110px", padding: "10px 18px", borderBottom: "1px solid rgba(21,32,26,0.06)", fontSize: 10, fontWeight: 700, color: "#6e7872", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                {["Action", "Entity", "Description", "When"].map((h) => <div key={h}>{h}</div>)}
              </div>
              {(logs ?? []).length === 0 ? (
                <div style={{ padding: "36px 24px", textAlign: "center", color: "#6e7872", fontSize: 14 }}>No audit logs</div>
              ) : (logs ?? []).map((a, i) => (
                <div key={i} className="admin-table-row" style={{ display: "grid", gridTemplateColumns: "160px 100px 1fr 110px", padding: "12px 18px", alignItems: "center", borderBottom: "1px solid rgba(21,32,26,0.04)", transition: "background 0.15s" }}>
                  <div data-label="Action" style={{ fontSize: 12, fontWeight: 700, color: "#14784a" }}>{a.action_type.replace(/_/g, " ")}</div>
                  <div data-label="Entity" style={{ fontSize: 12, color: "#56625b" }}>{a.target_entity_type}</div>
                  <div data-label="Description" style={{ fontSize: 12, color: "#626d66", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.description}</div>
                  <div data-label="When" style={{ fontSize: 11, color: "#6e7872" }}>{new Date(a.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
