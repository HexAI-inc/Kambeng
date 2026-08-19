"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { isAxiosError } from "axios";

import { api } from "@/lib/api";
import { StyledSelect } from "@/components/ui/styled-select";

const BLUE = "#1dc5ff";
const GREEN = "#1bbf88";
const RED = "#ef4444";
const AMBER = "#f59e0b";

const SOURCE_LABELS: Record<string, string> = {
  homepage: "Homepage",
  campaign_follow: "Campaign follow",
  post_donation: "Post-donation",
  waitlist: "Waitlist",
  guide: "Guide",
};

type Stats = {
  total: number;
  confirmed: number;
  unsubscribed: number;
  last_7_days: number;
  by_source: Record<string, number>;
  last_7_days_by_source: Record<string, number>;
};

type SubscriberRow = {
  id: number;
  email: string;
  source: string;
  campaign_id: number | null;
  campaign_title: string | null;
  name: string | null;
  phone: string | null;
  fundraising_goal: string | null;
  confirmed: boolean;
  unsubscribed: boolean;
  sequence_stage: number;
  created_at: string;
};

type SubscriberList = { total: number; items: SubscriberRow[] };

function getServerErrorMessage(error: unknown) {
  if (!isAxiosError(error)) return "Server error";
  const detail = (error.response?.data as { detail?: string } | undefined)?.detail;
  return typeof detail === "string" && detail.trim() ? detail : "Server error";
}

function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, delay, ease: "easeOut" as const },
  };
}

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase",
      padding: "3px 9px", borderRadius: 20, color,
      background: `${color}15`, border: `1px solid ${color}35`, whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px", borderRadius: 10, boxSizing: "border-box",
  border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)",
  color: "#f0f6ff", fontSize: 13, outline: "none",
};

const PAGE_SIZE = 20;

export default function AdminMarketingPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [list, setList] = useState<SubscriberList>({ total: 0, items: [] });
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Broadcast composer state
  const [subject, setSubject] = useState("");
  const [heading, setHeading] = useState("");
  const [body, setBody] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [testRecipient, setTestRecipient] = useState("");
  const [sending, setSending] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const response = await api.get<Stats>("/admin/marketing/stats");
      setStats(response.data);
    } catch (err) {
      setError(getServerErrorMessage(err));
    }
  }, []);

  const loadSubscribers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE };
      if (sourceFilter) params.source = sourceFilter;
      if (search.trim()) params.q = search.trim();
      const response = await api.get<SubscriberList>("/admin/marketing/subscribers", { params });
      setList(response.data);
      setError(null);
    } catch (err) {
      setError(getServerErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, sourceFilter, search]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadSubscribers(); }, [loadSubscribers]);

  const sendBroadcast = async (test: boolean) => {
    if (sending) return;
    setSending(true);
    setBroadcastResult(null);
    try {
      const payload: Record<string, unknown> = {
        subject: subject.trim(),
        heading: heading.trim(),
        body: body.trim(),
        cta_label: ctaLabel.trim() || null,
        cta_url: ctaUrl.trim() || null,
      };
      if (test) payload.test_recipient = testRecipient.trim();
      const response = await api.post("/admin/marketing/broadcast", payload);
      const data = response.data as { recipients: number; sent: number; failed: number; test: boolean };
      setBroadcastResult(
        data.test
          ? `Test email sent to ${testRecipient.trim()}.`
          : `Broadcast sent to ${data.sent} of ${data.recipients} subscribers${data.failed ? ` (${data.failed} failed)` : ""}.`,
      );
    } catch (err) {
      setBroadcastResult(`Error: ${getServerErrorMessage(err)}`);
    } finally {
      setSending(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(list.total / PAGE_SIZE));
  const canSend = subject.trim().length >= 3 && heading.trim().length >= 3 && body.trim().length >= 10;

  const statCards = stats ? [
    { label: "Total subscribers", value: stats.total, color: BLUE },
    { label: "Confirmed", value: stats.confirmed, color: GREEN },
    { label: "New (7 days)", value: stats.last_7_days, color: AMBER },
    { label: "Unsubscribed", value: stats.unsubscribed, color: RED },
  ] : [];

  return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", padding: "28px clamp(16px,4vw,48px)" }}>
    <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
      <motion.div {...fadeUp(0)}>
        <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.03em" }}>Marketing</h1>
        <p style={{ margin: 0, fontSize: 13, color: "#8899aa" }}>
          Email list growth by capture point, subscriber management, and the weekly broadcast.
        </p>
      </motion.div>

      {error && (
        <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: RED, fontSize: 13 }}>{error}</div>
      )}

      {/* Stat cards */}
      <motion.div {...fadeUp(0.05)} className="mkt-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {statCards.map((card) => (
          <div key={card.label} style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "16px 18px" }}>
            <div style={{ fontSize: 11, color: "#8899aa", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 8 }}>{card.label}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: card.color, letterSpacing: "-0.03em" }}>{card.value.toLocaleString()}</div>
          </div>
        ))}
      </motion.div>

      {/* By-source breakdown */}
      {stats && (
        <motion.div {...fadeUp(0.1)} style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "18px 20px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#f0f6ff", marginBottom: 14 }}>Subscribers by capture point</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Object.entries(SOURCE_LABELS).map(([key, label]) => {
              const count = stats.by_source[key] ?? 0;
              const recent = stats.last_7_days_by_source[key] ?? 0;
              const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
              return (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 130, fontSize: 12, color: "#8899aa", flexShrink: 0 }}>{label}</div>
                  <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${BLUE}, #079bd4)`, borderRadius: 3 }} />
                  </div>
                  <div style={{ width: 110, textAlign: "right", fontSize: 12, color: "#f0f6ff", fontWeight: 700, flexShrink: 0 }}>
                    {count.toLocaleString()}
                    {recent > 0 && <span style={{ color: GREEN, fontWeight: 600 }}> (+{recent})</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Broadcast composer */}
      <motion.div {...fadeUp(0.15)} style={{ background: "#0d1120", border: "1px solid rgba(29,197,255,0.18)", borderRadius: 14, padding: "20px" }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#f0f6ff", marginBottom: 4 }}>Weekly broadcast</div>
        <p style={{ margin: "0 0 16px", fontSize: 12, color: "#8899aa", lineHeight: 1.6 }}>
          Goes to every confirmed subscriber with their personal unsubscribe link. Rotate formats: success story · campaign digest · organiser tip · community spotlight. Keep it under 150 words.
        </p>
        <div className="mkt-broadcast-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#8899aa", marginBottom: 5 }}>Subject line</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. A library got its books this week" style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#8899aa", marginBottom: 5 }}>Email heading</label>
            <input value={heading} onChange={(e) => setHeading(e.target.value)} placeholder="e.g. One community, fully funded" style={inputStyle} />
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#8899aa", marginBottom: 5 }}>Body (one paragraph per line)</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder={"This week the Library Renovation Drive hit 99% of its target…\nEvery dalasi is tracked — see the receipts on the campaign page."} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
        </div>
        <div className="mkt-broadcast-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#8899aa", marginBottom: 5 }}>Button label (optional)</label>
            <input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="See the campaign" style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#8899aa", marginBottom: 5 }}>Button link (optional)</label>
            <input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://kambeng.hexai.gm/campaigns/…" style={inputStyle} />
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <input value={testRecipient} onChange={(e) => setTestRecipient(e.target.value)} placeholder="test@example.com" style={{ ...inputStyle, width: 220 }} />
          <button
            onClick={() => sendBroadcast(true)}
            disabled={sending || !canSend || !testRecipient.trim()}
            style={{ padding: "11px 18px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "#f0f6ff", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: sending || !canSend || !testRecipient.trim() ? 0.5 : 1 }}
          >
            Send test
          </button>
          <button
            onClick={() => {
              if (window.confirm("Send this broadcast to the entire confirmed list?")) sendBroadcast(false);
            }}
            disabled={sending || !canSend}
            style={{ padding: "11px 22px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${BLUE}, #079bd4)`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: sending || !canSend ? 0.5 : 1, boxShadow: "0 4px 16px rgba(29,197,255,0.25)" }}
          >
            {sending ? "Sending…" : "Send to full list"}
          </button>
          {broadcastResult && (
            <span style={{ fontSize: 12, color: broadcastResult.startsWith("Error") ? RED : GREEN, fontWeight: 600 }}>{broadcastResult}</span>
          )}
        </div>
      </motion.div>

      {/* Subscribers table */}
      <motion.div {...fadeUp(0.2)} style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "18px 20px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#f0f6ff", marginRight: "auto" }}>
            Subscribers <span style={{ color: "#4a5568", fontWeight: 600 }}>({list.total.toLocaleString()})</span>
          </div>
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search email…"
            style={{ ...inputStyle, width: 190 }}
          />
          <StyledSelect
            value={sourceFilter}
            onChange={(v) => { setSourceFilter(v); setPage(1); }}
            options={[
              { value: "", label: "All sources" },
              ...Object.entries(SOURCE_LABELS).map(([key, label]) => ({ value: key, label })),
            ]}
            style={{ width: 180 }}
          />
        </div>

        {loading ? (
          <div style={{ padding: "32px 0", textAlign: "center", color: "#4a5568", fontSize: 13 }}>Loading…</div>
        ) : list.items.length === 0 ? (
          <div style={{ padding: "32px 0", textAlign: "center", color: "#4a5568", fontSize: 13 }}>No subscribers yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {list.items.map((row) => (
              <div key={row.id} className="mkt-sub-row" style={{
                display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10,
                padding: "12px 14px", borderRadius: 10,
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
              }}>
                <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#f0f6ff", overflow: "hidden", textOverflow: "ellipsis" }}>{row.email}</div>
                  <div style={{ fontSize: 11, color: "#4a5568", marginTop: 2 }}>
                    {row.name ? `${row.name} · ` : ""}
                    {new Date(row.created_at).toLocaleDateString()}
                    {row.campaign_title ? ` · follows: ${row.campaign_title}` : ""}
                    {row.fundraising_goal ? ` · wants to fund: ${row.fundraising_goal}` : ""}
                  </div>
                </div>
                <Chip label={SOURCE_LABELS[row.source] ?? row.source} color={BLUE} />
                {row.unsubscribed
                  ? <Chip label="Unsubscribed" color={RED} />
                  : row.confirmed
                    ? <Chip label="Confirmed" color={GREEN} />
                    : <Chip label="Pending" color={AMBER} />}
                <span style={{ fontSize: 11, color: "#4a5568", whiteSpace: "nowrap" }}>seq {row.sequence_stage}</span>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
              style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#8899aa", fontSize: 12, cursor: "pointer", opacity: page <= 1 ? 0.4 : 1 }}>
              ← Prev
            </button>
            <span style={{ fontSize: 12, color: "#8899aa", alignSelf: "center" }}>{page} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#8899aa", fontSize: 12, cursor: "pointer", opacity: page >= totalPages ? 0.4 : 1 }}>
              Next →
            </button>
          </div>
        )}
      </motion.div>

      <style>{`
        @media (max-width: 900px) {
          .mkt-stats { grid-template-columns: repeat(2, 1fr) !important; }
          .mkt-broadcast-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
    </div>
  );
}
