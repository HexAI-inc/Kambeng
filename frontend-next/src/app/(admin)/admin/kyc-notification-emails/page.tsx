"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { isAxiosError } from "axios";

import { api } from "@/lib/api";

type ValidationErrorItem = {
  loc?: Array<string | number>;
  msg?: string;
};

function getServerErrorMessage(error: unknown) {
  if (!isAxiosError(error)) return "Server error";
  const data = error.response?.data as { detail?: string | ValidationErrorItem[] } | undefined;
  const detail = data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((it) => {
        const field = it.loc?.[it.loc.length - 1];
        const msg = it.msg?.trim();
        if (!msg) return null;
        return typeof field === "string" ? `${field}: ${msg}` : msg;
      })
      .filter((s): s is string => Boolean(s));
    if (msgs.length) return msgs.join(" ");
  }
  return "Server error";
}

const BLUE = "#1dc5ff";
const GREEN = "#1bbf88";
const RED = "#ef4444";

type NotificationEmail = {
  id: number;
  email: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, delay, ease: "easeOut" as const },
  };
}

function Chip({ label, color, bg, border }: { label: string; color: string; bg: string; border: string }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.07em",
        textTransform: "uppercase",
        padding: "3px 9px",
        borderRadius: 20,
        color,
        background: bg,
        border: `1px solid ${border}`,
      }}
    >
      {label}
    </span>
  );
}

const PAGE_SIZE = 8;

export default function KycNotificationEmailsPage() {
  const [rows, setRows] = useState<NotificationEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [includeInactive, setIncludeInactive] = useState(true);
  const [search, setSearch] = useState("");
  const [draftEmail, setDraftEmail] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const loadEmails = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("skip", "0");
      params.set("limit", "500");
      params.set("include_inactive", String(includeInactive));
      const response = await api.get(`/admin/kyc-notification-emails?${params.toString()}`);
      setRows(Array.isArray(response.data) ? response.data : []);
    } catch {
      showToast("Failed to load notification emails", false);
    } finally {
      setLoading(false);
    }
  }, [includeInactive]);

  useEffect(() => {
    void loadEmails();
  }, [loadEmails]);

  useEffect(() => {
    const timer = setTimeout(() => setPage(1), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (!includeInactive && !row.is_active) return false;
      if (!q) return true;
      return row.email.toLowerCase().includes(q);
    });
  }, [rows, includeInactive, search]);

  const activeCount = useMemo(() => filteredRows.filter((row) => row.is_active).length, [filteredRows]);

  const createEmail = async () => {
    if (!draftEmail.trim()) {
      showToast("Enter an email address", false);
      return;
    }
    setSaving(true);
    try {
      await api.post("/admin/kyc-notification-emails", { email: draftEmail.trim(), is_active: true });
      setDraftEmail("");
      showToast("Notification email added", true);
      await loadEmails();
    } catch (error: unknown) {
      showToast(getServerErrorMessage(error) ?? "Failed to add email", false);
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!editId) return;
    setSaving(true);
    try {
      await api.patch(`/admin/kyc-notification-emails/${editId}`, { email: editEmail.trim() });
      setEditId(null);
      setEditEmail("");
      showToast("Notification email updated", true);
      await loadEmails();
    } catch (error: unknown) {
      showToast(getServerErrorMessage(error) ?? "Failed to update email", false);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row: NotificationEmail) => {
    setSaving(true);
    try {
      await api.patch(`/admin/kyc-notification-emails/${row.id}`, { is_active: !row.is_active });
      showToast(row.is_active ? "Email disabled" : "Email enabled", true);
      await loadEmails();
    } catch {
      showToast("Failed to update status", false);
    } finally {
      setSaving(false);
    }
  };

  const removeEmail = async (row: NotificationEmail) => {
    if (!window.confirm(`Delete ${row.email}?`)) return;
    setSaving(true);
    try {
      await api.delete(`/admin/kyc-notification-emails/${row.id}`);
      showToast("Notification email deleted", true);
      await loadEmails();
    } catch {
      showToast("Failed to delete email", false);
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pageRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", padding: "28px clamp(16px,4vw,48px)", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at top left, rgba(29,197,255,0.13), transparent 28%), radial-gradient(circle at 85% 10%, rgba(27,191,136,0.11), transparent 22%), linear-gradient(180deg, rgba(255,255,255,0.02), transparent 28%)", pointerEvents: "none" }} />

      <div style={{ maxWidth: 1100, margin: "0 auto", position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
        {toast && (
          <div
            style={{
              position: "fixed",
              top: 24,
              right: 24,
              zIndex: 999,
              padding: "12px 20px",
              borderRadius: 10,
              background: toast.ok ? "rgba(27,191,136,0.15)" : "rgba(239,68,68,0.15)",
              border: `1px solid ${toast.ok ? "rgba(27,191,136,0.3)" : "rgba(239,68,68,0.3)"}`,
              color: toast.ok ? GREEN : RED,
              fontSize: 13,
              fontWeight: 600,
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}
          >
            {toast.msg}
          </div>
        )}

        <motion.div {...fadeUp(0)} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.03em" }}>KYC Alert Emails</div>
            <div style={{ fontSize: 13, color: "#6b7a8d", marginTop: 4 }}>
              {rows.length} total · <span style={{ color: activeCount > 0 ? GREEN : "#4a5568" }}>{activeCount} active</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search emails…"
              style={{
                padding: "9px 14px",
                borderRadius: 9,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.05)",
                color: "#f0f6ff",
                fontSize: 13,
                outline: "none",
                minWidth: 240,
              }}
            />
            <button
              onClick={() => setIncludeInactive((value) => !value)}
              style={{
                padding: "9px 14px",
                borderRadius: 9,
                border: `1px solid ${includeInactive ? "rgba(29,197,255,0.25)" : "rgba(255,255,255,0.1)"}`,
                background: includeInactive ? "rgba(29,197,255,0.08)" : "rgba(255,255,255,0.04)",
                color: includeInactive ? BLUE : "#8899aa",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {includeInactive ? "Showing inactive" : "Active only"}
            </button>
          </div>
        </motion.div>

        <motion.div {...fadeUp(0.05)}>
          <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#8899aa", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Add recipient</label>
                <input
                  value={draftEmail}
                  onChange={(e) => setDraftEmail(e.target.value)}
                  placeholder="admin@example.com"
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.04)",
                    color: "#f0f6ff",
                    fontSize: 14,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <div style={{ fontSize: 12, color: "#6b7a8d", marginTop: 8 }}>
                  These addresses get an email whenever a user submits KYC, plus a daily 08:00 GMT reminder while any submission is still awaiting review.
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <button
                  onClick={() => void createEmail()}
                  disabled={saving}
                  style={{
                    padding: "11px 18px",
                    borderRadius: 10,
                    border: "none",
                    background: `linear-gradient(135deg, ${BLUE}, #079bd4)`,
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    minWidth: 120,
                    opacity: saving ? 0.75 : 1,
                  }}
                >
                  Add email
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {editId && (
          <motion.div {...fadeUp(0.06)}>
            <div style={{ background: "#0d1120", border: "1px solid rgba(29,197,255,0.12)", borderRadius: 16, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#f0f6ff", marginBottom: 10 }}>Edit recipient</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12 }}>
                <input
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="admin@example.com"
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.04)",
                    color: "#f0f6ff",
                    fontSize: 14,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => void saveEdit()}
                    disabled={saving}
                    style={{
                      padding: "11px 18px",
                      borderRadius: 10,
                      border: "none",
                      background: `linear-gradient(135deg, ${GREEN}, #0f8f66)`,
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setEditId(null); setEditEmail(""); }}
                    style={{
                      padding: "11px 16px",
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(255,255,255,0.04)",
                      color: "#8899aa",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <motion.div {...fadeUp(0.08)}>
          <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>
            <div className="kne-head">
              <div>ID</div>
              <div>Email</div>
              <div>Status</div>
              <div>Updated</div>
              <div>Actions</div>
            </div>

            {loading ? (
              <div style={{ padding: 40, textAlign: "center" }}>
                <div style={{ width: 32, height: 32, border: `2px solid ${BLUE}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
                <div style={{ color: "#4a5568", fontSize: 13 }}>Loading recipients…</div>
              </div>
            ) : pageRows.length === 0 ? (
              <div style={{ padding: "48px 24px", textAlign: "center", color: "#4a5568", fontSize: 14 }}>
                No notification emails configured — pending KYCs will go unnoticed until one is added
              </div>
            ) : pageRows.map((row, index) => (
              <motion.div
                key={row.id}
                {...fadeUp(0.03 * index)}
                className="kne-row"
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.02)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = ""; }}
              >
                <div className="kne-id" style={{ fontSize: 12, color: "#4a5568", fontWeight: 600 }}>#{row.id}</div>
                <div className="kne-email" style={{ fontSize: 13, fontWeight: 700, color: "#f0f6ff", overflowWrap: "anywhere" }}>{row.email}</div>
                <div className="kne-status">
                  <Chip
                    label={row.is_active ? "Active" : "Disabled"}
                    color={row.is_active ? GREEN : RED}
                    bg={row.is_active ? "rgba(27,191,136,0.1)" : "rgba(239,68,68,0.1)"}
                    border={row.is_active ? "rgba(27,191,136,0.25)" : "rgba(239,68,68,0.25)"}
                  />
                </div>
                <div className="kne-updated" style={{ fontSize: 12, color: "#8899aa" }}>{new Date(row.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</div>
                <div className="kne-actions" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button
                    onClick={() => { setEditId(row.id); setEditEmail(row.email); }}
                    style={actionBtnStyle("default")}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => void toggleActive(row)}
                    disabled={saving}
                    style={actionBtnStyle(row.is_active ? "amber" : "green")}
                  >
                    {row.is_active ? "Disable" : "Enable"}
                  </button>
                  <button
                    onClick={() => void removeEmail(row)}
                    disabled={saving}
                    style={actionBtnStyle("red")}
                  >
                    Delete
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={pageBtnStyle(false)}>←</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button key={p} onClick={() => setPage(p)} style={pageBtnStyle(p === page)}>{p}</button>
            ))}
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={pageBtnStyle(false)}>→</button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .kne-head {
          display: grid;
          grid-template-columns: 52px 1fr 120px 120px 200px;
          padding: 10px 18px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          font-size: 10px;
          font-weight: 700;
          color: #4a5568;
          text-transform: uppercase;
          letter-spacing: 0.07em;
        }
        .kne-row {
          display: grid;
          grid-template-columns: 52px 1fr 120px 120px 200px;
          padding: 13px 18px;
          align-items: center;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          transition: background 0.15s;
        }
        @media (max-width: 720px) {
          .kne-head { display: none; }
          .kne-row {
            display: flex;
            flex-wrap: wrap;
            gap: 8px 12px;
            align-items: center;
          }
          .kne-email { width: 100%; order: -1; font-size: 14px !important; }
          .kne-actions { width: 100%; }
        }
      `}</style>
    </div>
  );
}

function actionBtnStyle(variant: "default" | "green" | "amber" | "red"): React.CSSProperties {
  const map = {
    default: { color: "#8899aa", border: "rgba(255,255,255,0.1)", bg: "rgba(255,255,255,0.04)" },
    green: { color: "#1bbf88", border: "rgba(27,191,136,0.25)", bg: "rgba(27,191,136,0.08)" },
    amber: { color: "#f97316", border: "rgba(249,115,22,0.25)", bg: "rgba(249,115,22,0.08)" },
    red: { color: "#ef4444", border: "rgba(239,68,68,0.25)", bg: "rgba(239,68,68,0.08)" },
  }[variant];

  return {
    padding: "5px 11px",
    borderRadius: 7,
    fontSize: 11,
    fontWeight: 700,
    border: `1px solid ${map.border}`,
    background: map.bg,
    color: map.color,
    cursor: "pointer",
  };
}

function pageBtnStyle(active: boolean): React.CSSProperties {
  return {
    width: 32,
    height: 32,
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    border: `1px solid ${active ? "rgba(29,197,255,0.4)" : "rgba(255,255,255,0.1)"}`,
    background: active ? "rgba(29,197,255,0.12)" : "rgba(255,255,255,0.03)",
    color: active ? "#1dc5ff" : "#8899aa",
    cursor: "pointer",
  };
}
