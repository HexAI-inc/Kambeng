"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAdminModerationQueue, useAdminGlobalSearch } from "@/hooks/use-frontend-data";
import { AdminModerationReport } from "@/types/frontend";
import type { AdminSearchResultItem } from "@/types/frontend";
import { api } from "@/lib/api";

const BLUE = "#1dc5ff";
const GREEN = "#1bbf88";

function fadeUp(delay = 0) {
  return { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35, delay, ease: "easeOut" as const } };
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string; border: string }> = {
    OPEN:     { color: "#ef4444", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.25)" },
    RESOLVED: { color: GREEN,    bg: "rgba(27,191,136,0.1)", border: "rgba(27,191,136,0.25)" },
    REVIEWING:{ color: BLUE,     bg: "rgba(29,197,255,0.1)", border: "rgba(29,197,255,0.2)" },
  };
  const s = map[status] ?? map.OPEN;
  return <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 20, color: s.color, background: s.bg, border: `1px solid ${s.border}` }}>{status}</span>;
}

const MODELS = ["campaigns","users","donations","reviews","payouts","kyc","moderation"];
const PAGE_SIZE = 8;

export default function AdminModerationPage() {
  const queryClient = useQueryClient();
  const { data: reports } = useAdminModerationQueue(true);

  const [searchQ, setSearchQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [selectedModels, setSelectedModels] = useState<string[]>(MODELS);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    try { const v = localStorage.getItem("admin_search_models"); if (v) setSelectedModels(JSON.parse(v) as string[]); } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem("admin_search_models", JSON.stringify(selectedModels)); } catch { /* ignore */ }
  }, [selectedModels]);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchQ.trim()), 400);
    return () => clearTimeout(t);
  }, [searchQ]);
  useEffect(() => { setPage(1); }, [debouncedQ]);

  const modelsParam = selectedModels.length > 0 ? selectedModels.join(",") : undefined;
  const search = useAdminGlobalSearch(debouncedQ || undefined, modelsParam, page, PAGE_SIZE, true);

  const resolveReport = useMutation({
    mutationFn: async ({ id, actionTaken }: { id: number; actionTaken: string }) => {
      await api.post(`/moderation/reports/${id}/resolve`, { status: "RESOLVED", action_taken: actionTaken, moderation_note: "Resolved via admin panel" });
    },
    onSuccess: async () => {
      showToast("Report resolved", true);
      await queryClient.invalidateQueries({ queryKey: ["admin-moderation-queue"] });
    },
    onError: () => showToast("Failed to resolve report", false),
  });

  const queueRows = reports ?? [];
  const queuePages = Math.max(1, Math.ceil(queueRows.length / PAGE_SIZE));
  const queuePageRows = queueRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const searchTotalPages = search.data ? Math.max(1, Math.ceil(search.data.total / PAGE_SIZE)) : 1;

  const isSearching = debouncedQ.length > 0;

  const MODEL_URL_MAP: Record<string, (id: number | string) => string> = {
    campaign:   (id) => `/admin/campaigns/${id}/view`,
    user:       (id) => `/admin/users/${id}/view`,
    kyc:        (id) => `/admin/kyc-queue/${id}/view`,
    moderation: ()   => `/admin/moderation-reports`,
  };

  return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", padding: "28px clamp(16px,4vw,48px)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

        {toast && (
          <div style={{ position: "fixed", top: 24, right: 24, zIndex: 999, padding: "12px 20px", borderRadius: 10, background: toast.ok ? "rgba(27,191,136,0.15)" : "rgba(239,68,68,0.15)", border: `1px solid ${toast.ok ? "rgba(27,191,136,0.3)" : "rgba(239,68,68,0.3)"}`, color: toast.ok ? GREEN : "#ef4444", fontSize: 13, fontWeight: 600, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>{toast.msg}</div>
        )}

        <motion.div {...fadeUp(0)}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.03em" }}>Moderation</div>
          <div style={{ fontSize: 13, color: "#6b7a8d", marginTop: 4 }}>Global search and moderation queue</div>
        </motion.div>

        {/* Search bar */}
        <motion.div {...fadeUp(0.06)}>
          <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "18px 20px" }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              <input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Search campaigns, users, donations, reviews, KYC…"
                style={{ flex: 1, padding: "10px 14px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f0f6ff", fontSize: 13, outline: "none" }}
              />
              {searchQ && (
                <button
                  onClick={() => { setSearchQ(""); setDebouncedQ(""); }}
                  style={{ padding: "10px 16px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#8899aa", fontSize: 13, cursor: "pointer" }}
                >Clear</button>
              )}
            </div>
            {/* Model filter chips */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <span style={{ fontSize: 11, color: "#4a5568", fontWeight: 700, alignSelf: "center", marginRight: 4 }}>FILTER:</span>
              {MODELS.map((m) => {
                const active = selectedModels.includes(m);
                return (
                  <button
                    key={m}
                    onClick={() => setSelectedModels((prev) => active ? prev.filter((x) => x !== m) : [...prev, m])}
                    style={{
                      padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: "pointer",
                      border: `1px solid ${active ? "rgba(29,197,255,0.3)" : "rgba(255,255,255,0.08)"}`,
                      background: active ? "rgba(29,197,255,0.1)" : "rgba(255,255,255,0.03)",
                      color: active ? BLUE : "#4a5568",
                      textTransform: "capitalize",
                    }}
                  >{m}</button>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* Search results */}
        {isSearching ? (
          <motion.div {...fadeUp(0.1)}>
            <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 13, fontWeight: 700, color: "#f0f6ff" }}>
                Search Results {search.data ? `(${search.data.total})` : ""}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 1fr 100px 80px 80px 80px", padding: "10px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 10, fontWeight: 700, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                <div>Model</div><div>Title</div><div>Subtitle</div><div>Status</div><div>ID</div><div>Date</div><div>Action</div>
              </div>
              {search.isLoading ? (
                <div style={{ padding: 32, textAlign: "center" }}>
                  <div style={{ width: 28, height: 28, border: `2px solid ${BLUE}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 10px" }} />
                  <div style={{ color: "#4a5568", fontSize: 13 }}>Searching…</div>
                </div>
              ) : (search.data?.items ?? []).length === 0 ? (
                <div style={{ padding: "40px 24px", textAlign: "center", color: "#4a5568", fontSize: 14 }}>No results found</div>
              ) : (search.data?.items ?? []).map((item: AdminSearchResultItem, i: number) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "100px 1fr 1fr 100px 80px 80px 80px", padding: "12px 18px", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.04)", transition: "background 0.15s" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.02)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = ""; }}
                >
                  <span style={{ fontSize: 10, fontWeight: 700, color: BLUE, background: "rgba(29,197,255,0.08)", border: "1px solid rgba(29,197,255,0.15)", borderRadius: 6, padding: "3px 8px", textTransform: "capitalize" }}>{item.model}</span>
                  <div style={{ fontSize: 13, color: "#f0f6ff", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: "#4a5568", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.subtitle}</div>
                  <div style={{ fontSize: 12, color: "#8899aa" }}>{item.status}</div>
                  <div style={{ fontSize: 12, color: "#4a5568" }}>#{item.entity_id}</div>
                  <div style={{ fontSize: 11, color: "#4a5568" }}>{new Date(item.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div>
                  <button
                    onClick={() => {
                      const url = MODEL_URL_MAP[item.model]?.(item.entity_id) ?? `/admin/${item.model}/${item.entity_id}`;
                      window.open(url, "_blank");
                    }}
                    style={{ padding: "5px 11px", borderRadius: 7, fontSize: 11, fontWeight: 700, border: "1px solid rgba(29,197,255,0.25)", background: "rgba(29,197,255,0.08)", color: BLUE, cursor: "pointer" }}
                  >Open</button>
                </div>
              ))}
            </div>
            {searchTotalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12 }}>
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={pageBtnStyle(false)}>←</button>
                {Array.from({ length: searchTotalPages }, (_, i) => i + 1).map((p) => <button key={p} onClick={() => setPage(p)} style={pageBtnStyle(p === page)}>{p}</button>)}
                <button onClick={() => setPage((p) => Math.min(searchTotalPages, p + 1))} disabled={page === searchTotalPages} style={pageBtnStyle(false)}>→</button>
              </div>
            )}
          </motion.div>
        ) : (
          /* Moderation queue */
          <motion.div {...fadeUp(0.1)}>
            <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 13, fontWeight: 700, color: "#f0f6ff" }}>
                Moderation Queue ({queueRows.filter((r: AdminModerationReport) => String(r.status) === "OPEN").length} open)
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "52px 120px 120px 100px 1fr 180px 100px", padding: "10px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 10, fontWeight: 700, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                <div>ID</div><div>Entity</div><div>Type</div><div>Status</div><div>Reason</div><div>Actions</div><div>Date</div>
              </div>
              {queueRows.length === 0 ? (
                <div style={{ padding: "48px 24px", textAlign: "center", color: "#4a5568", fontSize: 14 }}>No open moderation reports</div>
              ) : queuePageRows.map((r: AdminModerationReport, i: number) => {
                const isOpen = String(r.status) === "OPEN";
                return (
                  <div key={r.id} style={{ display: "grid", gridTemplateColumns: "52px 120px 120px 100px 1fr 180px 100px", padding: "13px 18px", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.04)", borderLeft: isOpen ? "3px solid #ef4444" : "3px solid transparent", transition: "background 0.15s" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.02)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = ""; }}
                  >
                    <div style={{ fontSize: 12, color: "#4a5568", fontWeight: 600 }}>#{r.id}</div>
                    <div style={{ fontSize: 12, color: "#8899aa" }}>{r.reported_entity_type}</div>
                    <div style={{ fontSize: 12, color: "#8899aa" }}>#{r.reported_entity_id}</div>
                    <div><StatusChip status={String(r.status)} /></div>
                    <div style={{ fontSize: 12, color: "#6b7a8d", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.reason}</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {isOpen && (
                        <>
                          <button onClick={() => resolveReport.mutate({ id: r.id, actionTaken: "dismissed" })} disabled={resolveReport.isPending} style={btnStyle("default")}>Dismiss</button>
                          <button onClick={() => resolveReport.mutate({ id: r.id, actionTaken: "campaign_suspended" })} disabled={resolveReport.isPending} style={btnStyle("red")}>Suspend</button>
                        </>
                      )}
                      {!isOpen && <span style={{ fontSize: 11, color: "#4a5568" }}>Resolved</span>}
                    </div>
                    <div style={{ fontSize: 11, color: "#4a5568" }}>{new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div>
                  </div>
                );
              })}
            </div>
            {queuePages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12 }}>
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={pageBtnStyle(false)}>←</button>
                {Array.from({ length: queuePages }, (_, i) => i + 1).map((p) => <button key={p} onClick={() => setPage(p)} style={pageBtnStyle(p === page)}>{p}</button>)}
                <button onClick={() => setPage((p) => Math.min(queuePages, p + 1))} disabled={page === queuePages} style={pageBtnStyle(false)}>→</button>
              </div>
            )}
          </motion.div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function btnStyle(v: "default" | "red"): React.CSSProperties {
  const m = { default: { c: "#8899aa", b: "rgba(255,255,255,0.1)", bg: "rgba(255,255,255,0.04)" }, red: { c: "#ef4444", b: "rgba(239,68,68,0.25)", bg: "rgba(239,68,68,0.08)" } }[v];
  return { padding: "5px 11px", borderRadius: 7, fontSize: 11, fontWeight: 700, border: `1px solid ${m.b}`, background: m.bg, color: m.c, cursor: "pointer" };
}
function pageBtnStyle(active: boolean): React.CSSProperties {
  return { width: 32, height: 32, borderRadius: 8, fontSize: 13, fontWeight: 700, border: `1px solid ${active ? "rgba(29,197,255,0.4)" : "rgba(255,255,255,0.1)"}`, background: active ? "rgba(29,197,255,0.12)" : "rgba(255,255,255,0.03)", color: active ? "#1dc5ff" : "#8899aa", cursor: "pointer" };
}
