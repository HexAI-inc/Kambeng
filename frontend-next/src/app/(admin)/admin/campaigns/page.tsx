"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";

import { api } from "@/lib/api";
import { useAdminCampaigns } from "@/hooks/use-frontend-data";
import { AdminCampaign } from "@/types/frontend";

const BLUE = "#1dc5ff";
const GREEN = "#1bbf88";
const RED = "#ef4444";

function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, delay, ease: "easeOut" as const },
  };
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string; border: string }> = {
    ACTIVE:    { color: GREEN, bg: "rgba(27,191,136,0.12)", border: "rgba(27,191,136,0.25)" },
    SUSPENDED: { color: "#f97316", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.25)" },
    CLOSED:    { color: "#8899aa", bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.1)" },
  };
  const s = map[status] ?? map.CLOSED;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase",
      padding: "3px 9px", borderRadius: 20, color: s.color, background: s.bg, border: `1px solid ${s.border}`,
    }}>{status}</span>
  );
}

const PAGE_SIZE = 10;

export default function AdminCampaignsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data, isLoading } = useAdminCampaigns(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const updateStatus = useMutation({
    mutationFn: async ({ slug, status }: { slug: string; status: string }) => {
      await api.patch(`/admin/campaigns/${slug}/status`, null, { params: { status } });
    },
    onSuccess: async () => {
      showToast("Campaign status updated", true);
      await queryClient.invalidateQueries({ queryKey: ["admin-campaigns"] });
    },
    onError: () => showToast("Failed to update status", false),
  });

  const rows = (data ?? []).filter((c) =>
    !search || c.title.toLowerCase().includes(search.toLowerCase()) || c.slug.includes(search.toLowerCase())
  );
  const total = rows.length;
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", padding: "28px clamp(16px,4vw,48px)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Toast */}
        {toast && (
          <div style={{
            position: "fixed", top: 24, right: 24, zIndex: 999,
            padding: "12px 20px", borderRadius: 10,
            background: toast.ok ? "rgba(27,191,136,0.15)" : "rgba(239,68,68,0.15)",
            border: `1px solid ${toast.ok ? "rgba(27,191,136,0.3)" : "rgba(239,68,68,0.3)"}`,
            color: toast.ok ? GREEN : RED, fontSize: 13, fontWeight: 600,
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}>{toast.msg}</div>
        )}

        {/* Header */}
        <motion.div {...fadeUp(0)} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.03em" }}>Campaigns</div>
            <div style={{ fontSize: 13, color: "#6b7a8d", marginTop: 4 }}>{total} total · admin view</div>
          </div>
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by title or slug…"
            style={{
              padding: "9px 14px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.05)", color: "#f0f6ff", fontSize: 13,
              outline: "none", width: 240,
            }}
          />
        </motion.div>

        {/* Table card */}
        <motion.div {...fadeUp(0.06)}>
          <div style={{
            background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 16, overflow: "hidden",
          }}>
            {/* Table header */}
            <div style={{
              display: "grid", gridTemplateColumns: "60px 1fr 160px 120px 120px 200px",
              padding: "10px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)",
              fontSize: 10, fontWeight: 700, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.07em",
            }}>
              <div>ID</div><div>Campaign</div><div>Status</div><div>Raised</div><div>Target</div><div>Actions</div>
            </div>

            {isLoading ? (
              <div style={{ padding: 40, textAlign: "center" }}>
                <div style={{ width: 32, height: 32, border: `2px solid ${BLUE}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
                <div style={{ color: "#4a5568", fontSize: 13 }}>Loading campaigns…</div>
              </div>
            ) : pageRows.length === 0 ? (
              <div style={{ padding: "48px 24px", textAlign: "center", color: "#4a5568", fontSize: 14 }}>No campaigns found</div>
            ) : pageRows.map((c: AdminCampaign, i) => (
              <motion.div
                key={c.id}
                {...fadeUp(0.03 * i)}
                style={{
                  display: "grid", gridTemplateColumns: "60px 1fr 160px 120px 120px 200px",
                  padding: "14px 18px", alignItems: "center",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.02)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = ""; }}
              >
                <div style={{ fontSize: 12, color: "#4a5568", fontWeight: 600 }}>#{c.id}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#f0f6ff", marginBottom: 2 }}>{c.title}</div>
                  <div style={{ fontSize: 11, color: "#4a5568", fontFamily: "monospace" }}>{c.slug}</div>
                </div>
                <div><StatusChip status={String(c.status)} /></div>
                <div style={{ fontSize: 13, fontWeight: 700, color: GREEN }}>{Number(c.amount_raised ?? 0).toLocaleString()} <span style={{ fontSize: 10, color: "#4a5568" }}>GMD</span></div>
                <div style={{ fontSize: 13, color: "#8899aa" }}>{c.target_amount ? `${Number(c.target_amount).toLocaleString()} GMD` : "—"}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button onClick={() => router.push(`/admin/campaigns/${c.id}/view`)} style={btnStyle("default")}>View</button>
                  {String(c.status) !== "ACTIVE" && (
                    <button onClick={() => updateStatus.mutate({ slug: c.slug, status: "ACTIVE" })} disabled={updateStatus.isPending} style={btnStyle("green")}>Activate</button>
                  )}
                  {String(c.status) !== "SUSPENDED" && (
                    <button onClick={() => updateStatus.mutate({ slug: c.slug, status: "SUSPENDED" })} disabled={updateStatus.isPending} style={btnStyle("orange")}>Suspend</button>
                  )}
                  {String(c.status) !== "CLOSED" && (
                    <button onClick={() => updateStatus.mutate({ slug: c.slug, status: "CLOSED" })} disabled={updateStatus.isPending} style={btnStyle("red")}>Close</button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 20 }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={pageBtnStyle(false)}>←</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button key={p} onClick={() => setPage(p)} style={pageBtnStyle(p === page)}>{p}</button>
            ))}
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={pageBtnStyle(false)}>→</button>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function btnStyle(variant: "default" | "green" | "orange" | "red"): React.CSSProperties {
  const map = {
    default: { color: "#8899aa", border: "rgba(255,255,255,0.1)", bg: "rgba(255,255,255,0.04)" },
    green:   { color: "#1bbf88", border: "rgba(27,191,136,0.25)", bg: "rgba(27,191,136,0.08)" },
    orange:  { color: "#f97316", border: "rgba(249,115,22,0.25)", bg: "rgba(249,115,22,0.08)" },
    red:     { color: "#ef4444", border: "rgba(239,68,68,0.25)", bg: "rgba(239,68,68,0.08)" },
  }[variant];
  return {
    padding: "5px 11px", borderRadius: 7, fontSize: 11, fontWeight: 700,
    border: `1px solid ${map.border}`, background: map.bg, color: map.color,
    cursor: "pointer",
  };
}

function pageBtnStyle(active: boolean): React.CSSProperties {
  return {
    width: 32, height: 32, borderRadius: 8, fontSize: 13, fontWeight: 700,
    border: `1px solid ${active ? "rgba(29,197,255,0.4)" : "rgba(255,255,255,0.1)"}`,
    background: active ? "rgba(29,197,255,0.12)" : "rgba(255,255,255,0.03)",
    color: active ? "#1dc5ff" : "#8899aa", cursor: "pointer",
  };
}
