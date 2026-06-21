"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import axios from "axios";
import { useAdminModerationQueue, useAdminGlobalSearch, useResolveModerationReport } from "@/hooks/use-frontend-data";
import type { AdminModerationReport, AdminSearchResultItem } from "@/types/frontend";

const BLUE = "#1dc5ff";
const GREEN = "#1bbf88";
const RED = "#ef4444";
const ORANGE = "#f97316";

type ResolutionAction = "content_removed" | "content_reinstated" | "user_warned" | "user_suspended" | "campaign_suspended";

const RESOLUTION_ACTIONS: Record<ResolutionAction, { label: string; description: string; color: string; bg: string; border: string }> = {
  content_removed:    { label: "Remove Content",    description: "Delete the reported update or review",       color: RED,    bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.25)" },
  content_reinstated: { label: "Reinstate Content", description: "Dismiss — content is valid, keep it live",   color: GREEN,  bg: "rgba(27,191,136,0.1)",  border: "rgba(27,191,136,0.25)" },
  user_warned:        { label: "Warn User",          description: "Log a formal warning on the content owner",  color: ORANGE, bg: "rgba(249,115,22,0.1)",  border: "rgba(249,115,22,0.25)" },
  user_suspended:     { label: "Suspend User",       description: "Disable the content owner's account",        color: RED,    bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.25)" },
  campaign_suspended: { label: "Suspend Campaign",   description: "Suspend the associated campaign",            color: RED,    bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.25)" },
};

const STATUS_TABS = [
  { key: "OPEN",      label: "Open",      color: RED },
  { key: "RESOLVED",  label: "Resolved",  color: GREEN },
  { key: "DISMISSED", label: "Dismissed", color: "#8899aa" },
  { key: "ALL",       label: "All",       color: BLUE },
] as const;
type StatusTab = typeof STATUS_TABS[number]["key"];

function fadeUp(delay = 0) {
  return { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35, delay, ease: "easeOut" as const } };
}

function EntityBadge({ type }: { type: string }) {
  const colors: Record<string, string> = { CAMPAIGN: BLUE, USER: ORANGE, UPDATE: GREEN, REVIEW: "#a78bfa" };
  const c = colors[type] ?? "#8899aa";
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, color: c, background: `${c}18`, border: `1px solid ${c}30` }}>{type}</span>
  );
}

const MODELS = ["campaigns","users","donations","reviews","payouts","kyc","moderation"];
const PAGE_SIZE = 8;

export default function AdminModerationPage() {
  const [statusTab, setStatusTab] = useState<StatusTab>("OPEN");
  const { data: reports, isLoading: reportsLoading } = useAdminModerationQueue(true, statusTab);
  const resolveReport = useResolveModerationReport();

  const [searchQ, setSearchQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [reportPage, setReportPage] = useState(1);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [selectedAction, setSelectedAction] = useState<ResolutionAction | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [dismissConfirmId, setDismissConfirmId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [selectedModels, setSelectedModels] = useState<string[]>(() => {
    try {
      if (typeof window === "undefined") return MODELS;
      const v = localStorage.getItem("admin_search_models");
      return v ? (JSON.parse(v) as string[]) : MODELS;
    } catch {
      return MODELS;
    }
  });

  useEffect(() => {
    try { localStorage.setItem("admin_search_models", JSON.stringify(selectedModels)); } catch { /* ignore */ }
  }, [selectedModels]);
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(searchQ.trim()); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchQ]);
  useEffect(() => { setReportPage(1); setResolvingId(null); setDismissConfirmId(null); }, [statusTab]);

  const modelsParam = selectedModels.length > 0 ? selectedModels.join(",") : undefined;
  const search = useAdminGlobalSearch(debouncedQ || undefined, modelsParam, page, PAGE_SIZE, true);

  const searchTotalPages = search.data ? Math.max(1, Math.ceil(search.data.total / PAGE_SIZE)) : 1;
  const reportRows = (reports ?? []) as AdminModerationReport[];
  const reportTotalPages = Math.max(1, Math.ceil(reportRows.length / PAGE_SIZE));
  const reportPageRows = reportRows.slice((reportPage - 1) * PAGE_SIZE, reportPage * PAGE_SIZE);
  const openCount = (reports ?? []).filter((r) => r.status?.toUpperCase() === "OPEN").length;

  const isSearching = debouncedQ.length > 0;
  const resolvingReport = resolvingId ? reportRows.find((x) => x.id === resolvingId) ?? null : null;

  const showToast = (msg: string, ok: boolean) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500); };

  const handleResolve = async () => {
    if (!resolvingId || !selectedAction) { showToast("Please select an action", false); return; }
    try {
      await resolveReport.mutateAsync({ reportId: resolvingId, action: selectedAction, note: resolutionNote, status: "RESOLVED" });
      showToast("Report resolved", true);
      setResolvingId(null);
      setSelectedAction(null);
      setResolutionNote("");
    } catch (error) {
      const message = axios.isAxiosError(error) && typeof error.response?.data?.detail === "string"
        ? error.response.data.detail : "Failed to resolve report";
      showToast(message, false);
    }
  };

  const handleDismiss = async (reportId: number) => {
    try {
      await resolveReport.mutateAsync({ reportId, status: "DISMISSED" });
      showToast("Report dismissed", true);
      setDismissConfirmId(null);
    } catch (error) {
      const message = axios.isAxiosError(error) && typeof error.response?.data?.detail === "string"
        ? error.response.data.detail : "Failed to dismiss report";
      showToast(message, false);
    }
  };

  const MODEL_URL_MAP: Record<string, (id: number | string) => string> = {
    campaign:   (id) => `/admin/campaigns/${id}/view`,
    user:       (id) => `/admin/users/${id}/view`,
    kyc:        (id) => `/admin/kyc-queue/${id}/view`,
    moderation: ()   => `/admin/moderation`,
  };

  return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", padding: "28px clamp(16px,4vw,48px)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

        {toast && (
          <div style={{ position: "fixed", top: 24, right: 24, zIndex: 999, padding: "12px 20px", borderRadius: 10, background: toast.ok ? "rgba(27,191,136,0.15)" : "rgba(239,68,68,0.15)", border: `1px solid ${toast.ok ? "rgba(27,191,136,0.3)" : "rgba(239,68,68,0.3)"}`, color: toast.ok ? GREEN : RED, fontSize: 13, fontWeight: 600, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>{toast.msg}</div>
        )}

        <motion.div {...fadeUp(0)}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.03em" }}>Moderation</div>
          <div style={{ fontSize: 13, color: "#6b7a8d", marginTop: 4 }}>Global search and content moderation queue</div>
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <Link href="#moderation-queue" style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(29,197,255,0.25)", background: "rgba(29,197,255,0.08)", color: BLUE, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
              Open moderation queue{openCount > 0 ? ` (${openCount})` : ""}
            </Link>
          </div>
        </motion.div>

        {/* Search bar */}
        <motion.div {...fadeUp(0.06)}>
          <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "18px 20px" }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Search campaigns, users, donations, reviews, KYC…"
                style={{ flex: 1, padding: "10px 14px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f0f6ff", fontSize: 13, outline: "none" }}
              />
              {searchQ && (
                <button onClick={() => { setSearchQ(""); setDebouncedQ(""); }}
                  style={{ padding: "10px 16px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#8899aa", fontSize: 13, cursor: "pointer" }}>Clear</button>
              )}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <span style={{ fontSize: 11, color: "#4a5568", fontWeight: 700, alignSelf: "center", marginRight: 4 }}>FILTER:</span>
              {MODELS.map((m) => {
                const active = selectedModels.includes(m);
                return (
                  <button key={m} onClick={() => setSelectedModels((prev) => active ? prev.filter((x) => x !== m) : [...prev, m])}
                    style={{ padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: "pointer", border: `1px solid ${active ? "rgba(29,197,255,0.3)" : "rgba(255,255,255,0.08)"}`, background: active ? "rgba(29,197,255,0.1)" : "rgba(255,255,255,0.03)", color: active ? BLUE : "#4a5568", textTransform: "capitalize" }}>
                    {m}
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* Search results */}
        {isSearching && (
          <motion.div {...fadeUp(0.1)}>
            <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflowX: "auto" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 13, fontWeight: 700, color: "#f0f6ff" }}>
                Search Results {search.data ? `(${search.data.total})` : ""}
              </div>
              <div className="admin-table-wrap" style={{ minWidth: 660 }}>
                <div className="admin-table-header" style={{ display: "grid", gridTemplateColumns: "100px 1fr 1fr 100px 80px 80px", padding: "10px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 10, fontWeight: 700, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  <div>Model</div><div>Title</div><div>Subtitle</div><div>Status</div><div>Date</div><div>Action</div>
                </div>
                {search.isLoading ? (
                  <div style={{ padding: 32, textAlign: "center" }}>
                    <div style={{ width: 28, height: 28, border: `2px solid ${BLUE}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 10px" }} />
                    <div style={{ color: "#4a5568", fontSize: 13 }}>Searching…</div>
                  </div>
                ) : (search.data?.items ?? []).length === 0 ? (
                  <div style={{ padding: "40px 24px", textAlign: "center", color: "#4a5568", fontSize: 14 }}>No results found</div>
                ) : (search.data?.items ?? []).map((item: AdminSearchResultItem, i: number) => (
                  <div key={i} className="admin-table-row" style={{ display: "grid", gridTemplateColumns: "100px 1fr 1fr 100px 80px 80px", padding: "12px 18px", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.04)", transition: "background 0.15s" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.02)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = ""; }}
                  >
                    <div data-label="Model"><span style={{ fontSize: 10, fontWeight: 700, color: BLUE, background: "rgba(29,197,255,0.08)", border: "1px solid rgba(29,197,255,0.15)", borderRadius: 6, padding: "3px 8px", textTransform: "capitalize" }}>{item.model}</span></div>
                    <div data-label="Title" style={{ fontSize: 13, color: "#f0f6ff", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
                    <div data-label="Subtitle" style={{ fontSize: 12, color: "#4a5568", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.subtitle}</div>
                    <div data-label="Status" style={{ fontSize: 12, color: "#8899aa" }}>{item.status}</div>
                    <div data-label="Date" style={{ fontSize: 11, color: "#4a5568" }}>{new Date(item.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div>
                    <div data-label="Action">
                      <button onClick={() => { const url = MODEL_URL_MAP[item.model]?.(item.entity_id) ?? `/admin/${item.model}/${item.entity_id}`; window.open(url, "_blank"); }}
                        style={{ padding: "5px 11px", borderRadius: 7, fontSize: 11, fontWeight: 700, border: "1px solid rgba(29,197,255,0.25)", background: "rgba(29,197,255,0.08)", color: BLUE, cursor: "pointer" }}>Open</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {searchTotalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12 }}>
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={pageBtnStyle(false)}>←</button>
                {Array.from({ length: searchTotalPages }, (_, i) => i + 1).map((p) => <button key={p} onClick={() => setPage(p)} style={pageBtnStyle(p === page)}>{p}</button>)}
                <button onClick={() => setPage((p) => Math.min(searchTotalPages, p + 1))} disabled={page === searchTotalPages} style={pageBtnStyle(false)}>→</button>
              </div>
            )}
          </motion.div>
        )}

        {/* Moderation Queue */}
        <motion.div id="moderation-queue" {...fadeUp(0.12)}>
          <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "22px 22px 26px" }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#f0f6ff" }}>Moderation Queue</div>
              <div style={{ fontSize: 12, color: "#6b7a8d", marginTop: 4 }}>{reportRows.length} report{reportRows.length !== 1 ? "s" : ""} in view</div>
            </div>

            {/* Status filter tabs */}
            <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
              {STATUS_TABS.map(({ key, label, color }) => {
                const active = statusTab === key;
                return (
                  <button key={key} onClick={() => setStatusTab(key)}
                    style={{ padding: "6px 16px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer", border: `1px solid ${active ? `${color}50` : "rgba(255,255,255,0.08)"}`, background: active ? `${color}15` : "rgba(255,255,255,0.03)", color: active ? color : "#4a5568", transition: "all 0.15s" }}>
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Resolution panel */}
            {resolvingId && resolvingReport && (
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 20, marginBottom: 18 }}>
                {/* Report context header */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <EntityBadge type={resolvingReport.reported_entity_type} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#f0f6ff" }}>
                    {resolvingReport.reason?.replace(/_/g, " ")}
                  </span>
                  <span style={{ fontSize: 11, color: "#4a5568", marginLeft: "auto" }}>Report #{resolvingReport.id}</span>
                </div>

                {resolvingReport.description && (
                  <div style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 9, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#a0aec0", lineHeight: 1.6, fontStyle: "italic" }}>
                    &ldquo;{resolvingReport.description}&rdquo;
                  </div>
                )}

                <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
                  {resolvingReport.campaign_id && (
                    <button onClick={() => window.open(`/admin/campaigns/${resolvingReport.campaign_id}/view`, "_blank")}
                      style={{ padding: "4px 12px", borderRadius: 7, border: "1px solid rgba(29,197,255,0.2)", background: "rgba(29,197,255,0.06)", color: BLUE, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                      View Campaign →
                    </button>
                  )}
                  {resolvingReport.reported_by_user_id && (
                    <span style={{ fontSize: 12, color: "#4a5568" }}>Reporter UID: {resolvingReport.reported_by_user_id}</span>
                  )}
                  <span style={{ fontSize: 12, color: "#4a5568" }}>Entity ID: {resolvingReport.reported_entity_id}</span>
                </div>

                <div style={{ fontSize: 12, color: "#6b7a8d", fontWeight: 600, marginBottom: 10 }}>Select an action:</div>
                {(() => {
                  const availableActions = (Object.entries(RESOLUTION_ACTIONS) as [ResolutionAction, typeof RESOLUTION_ACTIONS[ResolutionAction]][])
                    .filter(([key]) => {
                      if (key === "campaign_suspended") return !!resolvingReport.campaign_id;
                      if (key === "content_removed") return ["UPDATE", "REVIEW"].includes(resolvingReport.reported_entity_type);
                      return true;
                    });
                  return (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 8, marginBottom: 16 }}>
                      {availableActions.map(([key, { label, description, color, bg, border }]) => (
                        <button key={key} onClick={() => setSelectedAction(key)}
                          style={{ padding: "11px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", border: `1px solid ${selectedAction === key ? border : "rgba(255,255,255,0.08)"}`, background: selectedAction === key ? bg : "rgba(255,255,255,0.03)", color: selectedAction === key ? color : "#8899aa", textAlign: "left" }}>
                          <div>{label}</div>
                          <div style={{ fontSize: 11, fontWeight: 400, marginTop: 3, opacity: 0.75 }}>{description}</div>
                        </button>
                      ))}
                    </div>
                  );
                })()}

                <textarea value={resolutionNote} onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Document your reasoning (optional)…" rows={3}
                  style={{ width: "100%", padding: "11px 14px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#f0f6ff", fontSize: 13, resize: "vertical", outline: "none", boxSizing: "border-box", marginBottom: 14 }}
                />
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => void handleResolve()} disabled={!selectedAction || resolveReport.isPending}
                    style={{ padding: "10px 22px", borderRadius: 9, border: "none", background: selectedAction ? `linear-gradient(135deg, ${BLUE}, #079bd4)` : "rgba(255,255,255,0.06)", color: selectedAction ? "#fff" : "#4a5568", fontSize: 13, fontWeight: 700, cursor: selectedAction ? "pointer" : "not-allowed" }}>
                    {resolveReport.isPending ? "Resolving…" : "Confirm Resolution"}
                  </button>
                  <button onClick={() => { setResolvingId(null); setSelectedAction(null); setResolutionNote(""); }}
                    style={{ padding: "10px 20px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#8899aa", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                </div>
              </div>
            )}

            {/* Reports table */}
            <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflowX: "auto" }}>
              <div className="admin-table-wrap" style={{ minWidth: 700 }}>
                <div className="admin-table-header" style={{ display: "grid", gridTemplateColumns: "140px 100px 90px 1fr 180px 80px", padding: "10px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 10, fontWeight: 700, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  <div>Reason</div><div>Entity</div><div>Status</div><div>Description</div><div>Actions</div><div>Date</div>
                </div>

                {reportsLoading ? (
                  <div style={{ padding: 40, textAlign: "center" }}>
                    <div style={{ width: 32, height: 32, border: `2px solid ${BLUE}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
                    <div style={{ color: "#4a5568", fontSize: 13 }}>Loading reports…</div>
                  </div>
                ) : reportRows.length === 0 ? (
                  <div style={{ padding: "48px 24px", textAlign: "center", color: "#4a5568", fontSize: 14 }}>
                    {statusTab === "OPEN" ? "Queue is clear — no open reports" : `No ${statusTab.toLowerCase()} reports`}
                  </div>
                ) : reportPageRows.map((r: AdminModerationReport) => {
                  const isOpen = r.status?.toUpperCase() === "OPEN";
                  const isResolved = r.status?.toUpperCase() === "RESOLVED";
                  const statusColor = isOpen ? RED : isResolved ? GREEN : "#6b7a8d";
                  const isDismissConfirm = dismissConfirmId === r.id;
                  return (
                    <div key={r.id} className="admin-table-row"
                      style={{ display: "grid", gridTemplateColumns: "140px 100px 90px 1fr 180px 80px", padding: "13px 18px", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.04)", borderLeft: isOpen ? `3px solid ${RED}` : "3px solid transparent", transition: "background 0.15s" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.02)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = ""; }}
                    >
                      <div data-label="Reason" style={{ fontSize: 12, color: "#8899aa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.reason?.replace(/_/g, " ")}</div>
                      <div data-label="Entity"><EntityBadge type={r.reported_entity_type} /></div>
                      <div data-label="Status">
                        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 20, color: statusColor, background: `${statusColor}18`, border: `1px solid ${statusColor}30` }}>{r.status}</span>
                      </div>
                      <div data-label="Description" style={{ overflow: "hidden" }}>
                        <div style={{ fontSize: 12, color: "#6b7a8d", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.description || "—"}</div>
                        {!isOpen && r.action_taken && (
                          <div style={{ fontSize: 11, color: "#4a5568", marginTop: 2 }}>Action: {r.action_taken.replace(/_/g, " ")}</div>
                        )}
                      </div>
                      <div data-label="Actions">
                        {isOpen ? (
                          isDismissConfirm ? (
                            <div style={{ display: "flex", gap: 5 }}>
                              <button onClick={() => void handleDismiss(r.id)} disabled={resolveReport.isPending}
                                style={{ padding: "5px 10px", borderRadius: 7, fontSize: 11, fontWeight: 700, border: "none", background: "#4a5568", color: "#fff", cursor: "pointer" }}>Confirm dismiss</button>
                              <button onClick={() => setDismissConfirmId(null)}
                                style={{ padding: "5px 8px", borderRadius: 7, fontSize: 11, fontWeight: 600, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", color: "#6b7a8d", cursor: "pointer" }}>Cancel</button>
                            </div>
                          ) : (
                            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                              <button
                                onClick={() => { setResolvingId(r.id); setSelectedAction(null); setResolutionNote(""); setDismissConfirmId(null); }}
                                style={{ padding: "5px 11px", borderRadius: 7, fontSize: 11, fontWeight: 700, border: "1px solid rgba(29,197,255,0.25)", background: "rgba(29,197,255,0.08)", color: BLUE, cursor: "pointer" }}>Review</button>
                              <button onClick={() => setDismissConfirmId(r.id)}
                                style={{ padding: "5px 11px", borderRadius: 7, fontSize: 11, fontWeight: 700, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", color: "#6b7a8d", cursor: "pointer" }}>Dismiss</button>
                              {r.campaign_id && (
                                <button onClick={() => window.open(`/admin/campaigns/${r.campaign_id}/view`, "_blank")}
                                  style={{ padding: "5px 11px", borderRadius: 7, fontSize: 11, fontWeight: 700, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "#8899aa", cursor: "pointer" }}>View</button>
                              )}
                            </div>
                          )
                        ) : (
                          r.campaign_id ? (
                            <button onClick={() => window.open(`/admin/campaigns/${r.campaign_id}/view`, "_blank")}
                              style={{ padding: "5px 11px", borderRadius: 7, fontSize: 11, fontWeight: 700, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "#8899aa", cursor: "pointer" }}>View</button>
                          ) : (
                            <span style={{ fontSize: 11, color: "#4a5568" }}>—</span>
                          )
                        )}
                      </div>
                      <div data-label="Date" style={{ fontSize: 11, color: "#4a5568" }}>{new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {reportTotalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12 }}>
                <button onClick={() => setReportPage((p) => Math.max(1, p - 1))} disabled={reportPage === 1} style={pageBtnStyle(false)}>←</button>
                {Array.from({ length: reportTotalPages }, (_, i) => i + 1).map((p) => <button key={p} onClick={() => setReportPage(p)} style={pageBtnStyle(p === reportPage)}>{p}</button>)}
                <button onClick={() => setReportPage((p) => Math.min(reportTotalPages, p + 1))} disabled={reportPage === reportTotalPages} style={pageBtnStyle(false)}>→</button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function pageBtnStyle(active: boolean): React.CSSProperties {
  return { width: 32, height: 32, borderRadius: 8, fontSize: 13, fontWeight: 700, border: `1px solid ${active ? "rgba(29,197,255,0.4)" : "rgba(255,255,255,0.1)"}`, background: active ? "rgba(29,197,255,0.12)" : "rgba(255,255,255,0.03)", color: active ? "#1dc5ff" : "#8899aa", cursor: "pointer" };
}
