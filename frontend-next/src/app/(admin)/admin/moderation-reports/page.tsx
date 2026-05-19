"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAdminModerationQueue, useResolveModerationReport } from "@/hooks/use-frontend-data";

const BLUE = "#1dc5ff";
const GREEN = "#1bbf88";
const RED = "#ef4444";

type ResolutionAction = "content_removed" | "content_reinstated" | "user_warned" | "user_suspended";

const RESOLUTION_ACTIONS: Record<ResolutionAction, { label: string; color: string; bg: string; border: string }> = {
  content_removed:    { label: "Remove Content",     color: RED,      bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.25)" },
  content_reinstated: { label: "Reinstate Content",  color: GREEN,    bg: "rgba(27,191,136,0.1)",  border: "rgba(27,191,136,0.25)" },
  user_warned:        { label: "Warn User",           color: "#f97316", bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.25)" },
  user_suspended:     { label: "Suspend User",        color: RED,      bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.25)" },
};

function StatusChip({ status }: { status: string }) {
  const s = status.toLowerCase();
  const map: Record<string, { color: string; bg: string; border: string }> = {
    open:        { color: RED,      bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.25)" },
    in_progress: { color: BLUE,    bg: "rgba(29,197,255,0.1)", border: "rgba(29,197,255,0.2)" },
    resolved:    { color: GREEN,   bg: "rgba(27,191,136,0.1)", border: "rgba(27,191,136,0.25)" },
  };
  const cfg = map[s] ?? map.open;
  return <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 20, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>{status}</span>;
}

const PAGE_SIZE = 8;

export default function ModerationReportsPage() {
  const router = useRouter();
  const { data: reports, isLoading } = useAdminModerationQueue();
  const resolveReport = useResolveModerationReport();

  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [selectedAction, setSelectedAction] = useState<ResolutionAction | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  const handleResolve = async () => {
    if (!resolvingId || !selectedAction) { showToast("Please select an action", false); return; }
    try {
      await resolveReport.mutateAsync({ reportId: resolvingId, action: selectedAction, note: resolutionNote });
      showToast("Report resolved", true);
      setResolvingId(null);
      setSelectedAction(null);
      setResolutionNote("");
    } catch { showToast("Failed to resolve report", false); }
  };

  const rows = reports ?? [];
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const openCount = rows.filter((r: any) => r.status?.toLowerCase() === "open").length;

  return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", padding: "28px clamp(16px,4vw,48px)" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

        {toast && (
          <div style={{ position: "fixed", top: 24, right: 24, zIndex: 999, padding: "12px 20px", borderRadius: 10, background: toast.ok ? "rgba(27,191,136,0.15)" : "rgba(239,68,68,0.15)", border: `1px solid ${toast.ok ? "rgba(27,191,136,0.3)" : "rgba(239,68,68,0.3)"}`, color: toast.ok ? GREEN : RED, fontSize: 13, fontWeight: 600, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>{toast.msg}</div>
        )}

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.03em" }}>Moderation Reports</div>
          <div style={{ fontSize: 13, color: "#6b7a8d", marginTop: 4 }}>
            {rows.length} total · <span style={{ color: openCount > 0 ? RED : "#4a5568" }}>{openCount} open</span>
          </div>
        </motion.div>

        {/* Resolution panel */}
        {resolvingId && (
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "24px" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#f0f6ff", marginBottom: 4 }}>Resolve Report #{resolvingId}</div>
            <div style={{ fontSize: 13, color: "#6b7a8d", marginBottom: 20 }}>Choose an action and add optional notes about your decision.</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
              {(Object.entries(RESOLUTION_ACTIONS) as [ResolutionAction, typeof RESOLUTION_ACTIONS[ResolutionAction]][]).map(([key, { label, color, bg, border }]) => (
                <button
                  key={key}
                  onClick={() => setSelectedAction(key)}
                  style={{
                    padding: "12px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
                    border: `1px solid ${selectedAction === key ? border : "rgba(255,255,255,0.08)"}`,
                    background: selectedAction === key ? bg : "rgba(255,255,255,0.03)",
                    color: selectedAction === key ? color : "#8899aa",
                    textAlign: "left",
                  }}
                >{label}</button>
              ))}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#8899aa", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 8 }}>Resolution Notes (Optional)</label>
              <textarea
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="Document your reasoning for this action…"
                rows={3}
                style={{ width: "100%", padding: "11px 14px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#f0f6ff", fontSize: 13, resize: "vertical", outline: "none", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => void handleResolve()} disabled={!selectedAction || resolveReport.isPending} style={{ padding: "10px 22px", borderRadius: 9, border: "none", background: `linear-gradient(135deg, ${BLUE}, #079bd4)`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: !selectedAction ? 0.5 : 1 }}>
                {resolveReport.isPending ? "Resolving…" : "Confirm Resolution"}
              </button>
              <button onClick={() => { setResolvingId(null); setSelectedAction(null); setResolutionNote(""); }} style={{ padding: "10px 20px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#8899aa", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            </div>
          </motion.div>
        )}

        {/* Table */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.06 }}>
          <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "52px 140px 120px 100px 1fr 160px 100px", padding: "10px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 10, fontWeight: 700, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.07em" }}>
              <div>ID</div><div>Reason</div><div>Entity</div><div>Status</div><div>Description</div><div>Actions</div><div>Date</div>
            </div>

            {isLoading ? (
              <div style={{ padding: 40, textAlign: "center" }}>
                <div style={{ width: 32, height: 32, border: `2px solid ${BLUE}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
                <div style={{ color: "#4a5568", fontSize: 13 }}>Loading reports…</div>
              </div>
            ) : rows.length === 0 ? (
              <div style={{ padding: "48px 24px", textAlign: "center", color: "#4a5568", fontSize: 14 }}>No moderation reports</div>
            ) : pageRows.map((r: any, i: number) => {
              const isOpen = r.status?.toLowerCase() === "open";
              return (
                <div key={r.id} style={{ display: "grid", gridTemplateColumns: "52px 140px 120px 100px 1fr 160px 100px", padding: "13px 18px", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.04)", borderLeft: isOpen ? `3px solid ${RED}` : "3px solid transparent", transition: "background 0.15s" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.02)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = ""; }}
                >
                  <div style={{ fontSize: 12, color: "#4a5568", fontWeight: 600 }}>#{r.id}</div>
                  <div style={{ fontSize: 12, color: "#8899aa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.reason}</div>
                  <div style={{ fontSize: 12, color: "#4a5568" }}>{r.reported_entity_type}</div>
                  <div><StatusChip status={r.status} /></div>
                  <div style={{ fontSize: 12, color: "#6b7a8d", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.description || "—"}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {isOpen && (
                      <button onClick={() => setResolvingId(r.id)} style={{ padding: "5px 11px", borderRadius: 7, fontSize: 11, fontWeight: 700, border: `1px solid rgba(29,197,255,0.25)`, background: "rgba(29,197,255,0.08)", color: BLUE, cursor: "pointer" }}>Review</button>
                    )}
                    {(r.campaign_id || r.reported_by_user_id) && (
                      <button
                        onClick={() => {
                          if (r.campaign_id) router.push(`/admin/campaigns/${r.campaign_id}/view`);
                          else if (r.reported_by_user_id) router.push(`/admin/users/${r.reported_by_user_id}/view`);
                        }}
                        style={{ padding: "5px 11px", borderRadius: 7, fontSize: 11, fontWeight: 700, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#8899aa", cursor: "pointer" }}
                      >View</button>
                    )}
                    {!isOpen && <span style={{ fontSize: 11, color: "#4a5568" }}>Resolved</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "#4a5568" }}>{new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
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

function pageBtnStyle(active: boolean): React.CSSProperties {
  return { width: 32, height: 32, borderRadius: 8, fontSize: 13, fontWeight: 700, border: `1px solid ${active ? "rgba(29,197,255,0.4)" : "rgba(255,255,255,0.1)"}`, background: active ? "rgba(29,197,255,0.12)" : "rgba(255,255,255,0.03)", color: active ? "#1dc5ff" : "#8899aa", cursor: "pointer" };
}
