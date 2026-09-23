"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

import { useAdminUsers, useUpdateAdminUserStatus } from "@/hooks/use-frontend-data";
import { AdminUserOverview } from "@/types/frontend";

const BLUE = "#14784a";
const GREEN = "#1f9960";
const RED = "#d42f2f";

function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, delay, ease: "easeOut" as const },
  };
}

function Chip({ label, color, bg, border }: { label: string; color: string; bg: string; border: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase",
      padding: "3px 9px", borderRadius: 20, color, background: bg, border: `1px solid ${border}`,
    }}>{label}</span>
  );
}

const PAGE_SIZE = 10;

export default function AdminUsersPage() {
  const router = useRouter();
  const { data, isLoading } = useAdminUsers(true);
  const updateStatus = useUpdateAdminUserStatus();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const rows = (data ?? []).filter((u) =>
    !search ||
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.wave_number ?? "").includes(search)
  );
  const total = rows.length;
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div style={{ minHeight: "100vh", padding: "28px clamp(16px,4vw,48px)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {toast && (
          <div style={{
            position: "fixed", top: 24, right: 24, zIndex: 999,
            padding: "12px 20px", borderRadius: 10,
            background: toast.ok ? "rgba(31,153,96,0.15)" : "rgba(239,68,68,0.15)",
            border: `1px solid ${toast.ok ? "rgba(31,153,96,0.3)" : "rgba(239,68,68,0.3)"}`,
            color: toast.ok ? GREEN : RED, fontSize: 13, fontWeight: 600,
            boxShadow: "0 8px 32px rgba(21,32,26,0.12)",
          }}>{toast.msg}</div>
        )}

        <motion.div {...fadeUp(0)} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#15201a", letterSpacing: "-0.03em" }}>Users</div>
            <div style={{ fontSize: 13, color: "#626d66", marginTop: 4 }}>{total} total accounts</div>
          </div>
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name, email, or Wave…"
            style={{
              padding: "9px 14px", borderRadius: 9, border: "1px solid rgba(21,32,26,0.1)",
              background: "#fff", color: "#15201a", fontSize: 13, outline: "none", width: 260,
            }}
          />
        </motion.div>

        <motion.div {...fadeUp(0.06)}>
          <div style={{ background: "#ffffff", border: "1px solid rgba(21,32,26,0.07)", borderRadius: 16, overflowX: "auto" }}>
            <div className="admin-table-wrap" style={{ minWidth: 740 }}>
            <div className="admin-table-header" style={{
              display: "grid", gridTemplateColumns: "1fr 100px 110px 140px 60px 160px",
              padding: "10px 18px", borderBottom: "1px solid rgba(21,32,26,0.06)",
              fontSize: 10, fontWeight: 700, color: "#6e7872", textTransform: "uppercase", letterSpacing: "0.07em",
            }}>
              <div>User</div><div>Role</div><div>Status</div><div>KYC</div><div>Camps</div><div>Actions</div>
            </div>

            {isLoading ? (
              <div style={{ padding: 40, textAlign: "center" }}>
                <div style={{ width: 32, height: 32, border: `2px solid ${BLUE}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
                <div style={{ color: "#6e7872", fontSize: 13 }}>Loading users…</div>
              </div>
            ) : pageRows.length === 0 ? (
              <div style={{ padding: "48px 24px", textAlign: "center", color: "#6e7872", fontSize: 14 }}>No users found</div>
            ) : pageRows.map((u: AdminUserOverview, i) => (
              <motion.div
                key={u.id}
                {...fadeUp(0.03 * i)}
                className="admin-table-row"
                style={{
                  display: "grid", gridTemplateColumns: "1fr 100px 110px 140px 60px 160px",
                  padding: "13px 18px", alignItems: "center",
                  borderBottom: "1px solid rgba(21,32,26,0.04)",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(21,32,26,0.02)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = ""; }}
              >
                <div data-label="User">
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#15201a" }}>{u.full_name}</div>
                  <div style={{ fontSize: 11, color: "#6e7872" }}>{u.email}</div>
                  {u.wave_number && <div style={{ fontSize: 11, color: "#6e7872", fontFamily: "monospace" }}>{u.wave_number}</div>}
                </div>
                <div data-label="Role">
                  <Chip
                    label={String(u.role)}
                    color={u.role === "ADMIN" ? "#e8650f" : BLUE}
                    bg={u.role === "ADMIN" ? "rgba(232,101,15,0.1)" : "rgba(20,120,74,0.1)"}
                    border={u.role === "ADMIN" ? "rgba(232,101,15,0.25)" : "rgba(20,120,74,0.2)"}
                  />
                </div>
                <div data-label="Status">
                  <Chip
                    label={u.is_active ? "Active" : "Suspended"}
                    color={u.is_active ? GREEN : RED}
                    bg={u.is_active ? "rgba(31,153,96,0.1)" : "rgba(239,68,68,0.1)"}
                    border={u.is_active ? "rgba(31,153,96,0.25)" : "rgba(239,68,68,0.25)"}
                  />
                </div>
                <div data-label="KYC">
                  {u.kyc_status && (
                    <Chip
                      label={String(u.kyc_status)}
                      color={u.kyc_status === "APPROVED" ? GREEN : u.kyc_status === "REJECTED" ? RED : "#e8650f"}
                      bg={u.kyc_status === "APPROVED" ? "rgba(31,153,96,0.1)" : u.kyc_status === "REJECTED" ? "rgba(239,68,68,0.1)" : "rgba(232,101,15,0.1)"}
                      border={u.kyc_status === "APPROVED" ? "rgba(31,153,96,0.25)" : u.kyc_status === "REJECTED" ? "rgba(239,68,68,0.25)" : "rgba(232,101,15,0.25)"}
                    />
                  )}
                </div>
                <div data-label="Campaigns" style={{ fontSize: 13, color: "#56625b", fontWeight: 600 }}>{u.campaign_count ?? 0}</div>
                <div data-label="Actions">
                  <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => router.push(`/admin/users/${u.id}/view`)} style={btnStyle("default")}>View</button>
                  <button
                    onClick={() =>
                      updateStatus.mutate(
                        { userId: u.id, status: u.is_active ? "SUSPENDED" : "ACTIVE" },
                        {
                          onSuccess: () => showToast(u.is_active ? "User suspended" : "User activated", true),
                          onError: () => showToast("Failed to update user", false),
                        },
                      )
                    }
                    disabled={updateStatus.isPending}
                    style={btnStyle(u.is_active ? "red" : "green")}
                  >
                    {u.is_active ? "Suspend" : "Activate"}
                  </button>
                  </div>
                </div>
              </motion.div>
            ))}
            </div>
          </div>
        </motion.div>

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

function btnStyle(variant: "default" | "green" | "red"): React.CSSProperties {
  const map = {
    default: { color: "#56625b", border: "rgba(21,32,26,0.1)", bg: "rgba(21,32,26,0.04)" },
    green:   { color: "#1f9960", border: "rgba(31,153,96,0.25)", bg: "#edf7f2" },
    red:     { color: "#d42f2f", border: "rgba(239,68,68,0.25)", bg: "#fef0f0" },
  }[variant];
  return { padding: "5px 11px", borderRadius: 7, fontSize: 11, fontWeight: 700, border: `1px solid ${map.border}`, background: map.bg, color: map.color, cursor: "pointer" };
}

function pageBtnStyle(active: boolean): React.CSSProperties {
  return { width: 32, height: 32, borderRadius: 8, fontSize: 13, fontWeight: 700, border: `1px solid ${active ? "rgba(20,120,74,0.4)" : "rgba(21,32,26,0.1)"}`, background: active ? "rgba(20,120,74,0.12)" : "rgba(21,32,26,0.03)", color: active ? "#14784a" : "#56625b", cursor: "pointer" };
}
