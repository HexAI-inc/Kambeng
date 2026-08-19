"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { isAxiosError } from "axios";

import { api } from "@/lib/api";

const BLUE = "#1dc5ff";
const GREEN = "#1bbf88";
const RED = "#ef4444";
const AMBER = "#f59e0b";

function getServerErrorMessage(error: unknown) {
  if (!isAxiosError(error)) return "Server error";
  const detail = (error.response?.data as { detail?: string } | undefined)?.detail;
  return typeof detail === "string" && detail.trim() ? detail : "Server error";
}

function fadeUp(delay = 0) {
  return { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35, delay, ease: "easeOut" as const } };
}

const inputStyle: React.CSSProperties = {
  padding: "10px 13px", borderRadius: 9, boxSizing: "border-box",
  border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)",
  color: "#f0f6ff", fontSize: 13, outline: "none",
};

const cardStyle: React.CSSProperties = {
  background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "18px 20px",
};

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = { PENDING: AMBER, SUCCEEDED: GREEN, FAILED: RED };
  const color = map[status] ?? "#8899aa";
  return (
    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 20, color, background: `${color}18`, border: `1px solid ${color}35` }}>
      {status}
    </span>
  );
}

type Balance = {
  available_balance?: string; total_collected?: string; platform_commissions?: string;
  net_collections?: string; total_paid_out?: string; successful_collections?: number; total_payouts?: number;
};

type Stats = {
  total_volume?: string; total_commissions_paid?: string; total_net_earnings?: string;
  today_earnings?: string; pending_transactions_count?: number; pending_volume?: string;
  by_provider?: { provider: string; volume: string; count: number }[];
};

// Shape of HPG's own GET /collections response — snake_case, confirmed
// against a live call. Distinct from GET /client/transactions (camelCase),
// which this admin view does not use.
type GatewayTransaction = {
  transaction_id?: string; client_reference?: string; provider?: string; status?: string;
  amount?: string; currency?: string; created_at?: string;
};

type Discrepancy = {
  donation_id: number; client_reference: string; campaign_title: string | null;
  local_status: string; gateway_status: string; amount: number; created_at: string | null;
};

export default function AdminGatewayPage() {
  const [balance, setBalance] = useState<Balance | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [transactions, setTransactions] = useState<GatewayTransaction[]>([]);
  const [txStatus, setTxStatus] = useState("");
  const [txLoading, setTxLoading] = useState(false);

  const [webhookResult, setWebhookResult] = useState<string | null>(null);
  const [webhookBusy, setWebhookBusy] = useState(false);

  const [recipientMobile, setRecipientMobile] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientResult, setRecipientResult] = useState<string | null>(null);
  const [recipientBusy, setRecipientBusy] = useState(false);

  const [reconLoading, setReconLoading] = useState(false);
  const [reconResult, setReconResult] = useState<{ checked: number; discrepancies: Discrepancy[] } | null>(null);

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    setError(null);
    try {
      const [balanceRes, statsRes] = await Promise.all([
        api.get<{ data: Balance }>("/admin/gateway/balance").then((r) => r.data.data ?? r.data),
        api.get<Stats>("/admin/gateway/stats").then((r) => r.data),
      ]);
      setBalance(balanceRes as Balance);
      setStats(statsRes);
    } catch (err) {
      setError(getServerErrorMessage(err));
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  const loadTransactions = useCallback(async () => {
    setTxLoading(true);
    try {
      const params: Record<string, string> = { limit: "25" };
      if (txStatus) params.status = txStatus;
      const response = await api.get<{ data?: GatewayTransaction[] } | GatewayTransaction[]>("/admin/gateway/transactions", { params });
      const data = response.data;
      setTransactions(Array.isArray(data) ? data : data.data ?? []);
    } catch (err) {
      setError(getServerErrorMessage(err));
    } finally {
      setTxLoading(false);
    }
  }, [txStatus]);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  const testWebhook = async () => {
    setWebhookBusy(true);
    setWebhookResult(null);
    try {
      const response = await api.post<{ data?: { delivered?: boolean; result?: { status_code?: number } } }>("/admin/gateway/webhooks/test");
      const data = response.data.data ?? {};
      setWebhookResult(data.delivered ? `Delivered — HTTP ${data.result?.status_code ?? "?"}` : "Not delivered");
    } catch (err) {
      setWebhookResult(`Error: ${getServerErrorMessage(err)}`);
    } finally {
      setWebhookBusy(false);
    }
  };

  const verifyRecipient = async () => {
    if (!recipientMobile.trim()) return;
    setRecipientBusy(true);
    setRecipientResult(null);
    try {
      const response = await api.post<{ data?: { name?: string; name_match?: boolean; receive_limit_reached?: boolean } }>(
        "/admin/gateway/verify-recipient",
        { mobile: recipientMobile.trim(), name: recipientName.trim() || undefined },
      );
      const data = response.data.data ?? {};
      setRecipientResult(
        `${data.name ?? "Unknown name"} · name match: ${data.name_match === null ? "n/a" : String(data.name_match)} · limit reached: ${String(data.receive_limit_reached)}`,
      );
    } catch (err) {
      setRecipientResult(`Error: ${getServerErrorMessage(err)}`);
    } finally {
      setRecipientBusy(false);
    }
  };

  const runReconciliation = async () => {
    setReconLoading(true);
    setReconResult(null);
    try {
      const response = await api.get<{ checked: number; discrepancies: Discrepancy[] }>("/admin/gateway/reconciliation");
      setReconResult(response.data);
    } catch (err) {
      setError(getServerErrorMessage(err));
    } finally {
      setReconLoading(false);
    }
  };

  const balanceCards = balance ? [
    { label: "Available balance", value: balance.available_balance, color: GREEN },
    { label: "Total collected", value: balance.total_collected, color: BLUE },
    { label: "Platform commissions", value: balance.platform_commissions, color: AMBER },
    { label: "Total paid out", value: balance.total_paid_out, color: "#f0f6ff" },
  ] : [];

  return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", padding: "28px clamp(16px,4vw,48px)" }}>
    <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
      <motion.div {...fadeUp(0)}>
        <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.03em" }}>Gateway</h1>
        <p style={{ margin: 0, fontSize: 13, color: "#8899aa" }}>
          Live data straight from HexAI Payment Gateway — wallet balance, transaction ledger, and reconciliation against our own records.
        </p>
      </motion.div>

      {error && (
        <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: RED, fontSize: 13 }}>{error}</div>
      )}

      {/* Balance */}
      <motion.div {...fadeUp(0.05)} className="gw-cards" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {loadingSummary ? (
          <div style={{ gridColumn: "1 / -1", padding: "24px 0", textAlign: "center", color: "#4a5568", fontSize: 13 }}>Loading…</div>
        ) : balanceCards.map((card) => (
          <div key={card.label} style={cardStyle}>
            <div style={{ fontSize: 11, color: "#8899aa", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 8 }}>{card.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: card.color, letterSpacing: "-0.03em" }}>{card.value ?? "—"} <span style={{ fontSize: 12, color: "#4a5568", fontWeight: 600 }}>GMD</span></div>
          </div>
        ))}
      </motion.div>

      {/* Stats by provider */}
      {stats && (
        <motion.div {...fadeUp(0.1)} style={cardStyle}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 20, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: "#8899aa", marginBottom: 4 }}>Today&apos;s earnings</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: GREEN }}>{stats.today_earnings ?? "—"} GMD</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#8899aa", marginBottom: 4 }}>Pending transactions</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: AMBER }}>{stats.pending_transactions_count ?? 0} <span style={{ fontSize: 12, color: "#4a5568" }}>({stats.pending_volume ?? "0"} GMD)</span></div>
            </div>
          </div>
          {stats.by_provider && stats.by_provider.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#f0f6ff" }}>By provider</div>
              {stats.by_provider.map((p) => (
                <div key={p.provider} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#c0ccd8" }}>
                  <span>{p.provider}</span>
                  <span>{p.volume} GMD · {p.count} txns</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Reconciliation */}
      <motion.div {...fadeUp(0.15)} style={cardStyle}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#f0f6ff" }}>Reconciliation</div>
          <button
            onClick={runReconciliation}
            disabled={reconLoading}
            style={{ padding: "8px 16px", borderRadius: 9, border: "none", background: `linear-gradient(135deg, ${BLUE}, #079bd4)`, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: reconLoading ? 0.6 : 1, whiteSpace: "nowrap" }}
          >
            {reconLoading ? "Checking…" : "Check stale PENDING donations"}
          </button>
        </div>
        <p style={{ margin: "8px 0 12px", fontSize: 12, color: "#8899aa", lineHeight: 1.6 }}>
          Cross-checks donations we still show as PENDING against the gateway&apos;s own record — catches donations stuck locally after a webhook delivery failure.
        </p>
        {reconResult && (
          <div>
            <div style={{ fontSize: 12, color: "#8899aa", marginBottom: 10 }}>Checked {reconResult.checked} stale donation(s).</div>
            {reconResult.discrepancies.length === 0 ? (
              <div style={{ fontSize: 13, color: GREEN }}>No discrepancies found.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {reconResult.discrepancies.map((d) => (
                  <div key={d.donation_id} style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, padding: "10px 12px", borderRadius: 8, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", fontSize: 12 }}>
                    <span style={{ color: "#f0f6ff" }}>{d.client_reference} — {d.campaign_title ?? "unknown campaign"}</span>
                    <span style={{ color: RED }}>local: {d.local_status} → gateway: {d.gateway_status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Webhook test + Verify recipient */}
      <motion.div {...fadeUp(0.2)} className="gw-tools-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={cardStyle}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#f0f6ff", marginBottom: 8 }}>Webhook health</div>
          <p style={{ margin: "0 0 12px", fontSize: 12, color: "#8899aa", lineHeight: 1.6 }}>Sends a signed test ping to our configured webhook URL.</p>
          <button
            onClick={testWebhook}
            disabled={webhookBusy}
            style={{ padding: "9px 16px", borderRadius: 9, border: "1px solid rgba(29,197,255,0.25)", background: "rgba(29,197,255,0.08)", color: BLUE, fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: webhookBusy ? 0.6 : 1 }}
          >
            {webhookBusy ? "Sending…" : "Send test ping"}
          </button>
          {webhookResult && <div style={{ marginTop: 10, fontSize: 12, color: webhookResult.startsWith("Error") ? RED : GREEN }}>{webhookResult}</div>}
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#f0f6ff", marginBottom: 8 }}>Verify a Wave recipient</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <input type="tel" inputMode="tel" autoComplete="tel" value={recipientMobile} onChange={(e) => setRecipientMobile(e.target.value)} placeholder="+2207123456" style={{ ...inputStyle, flex: "1 1 140px" }} />
            <input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Name (optional)" style={{ ...inputStyle, flex: "1 1 140px" }} />
          </div>
          <button
            onClick={verifyRecipient}
            disabled={recipientBusy || !recipientMobile.trim()}
            style={{ padding: "9px 16px", borderRadius: 9, border: "1px solid rgba(29,197,255,0.25)", background: "rgba(29,197,255,0.08)", color: BLUE, fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: recipientBusy || !recipientMobile.trim() ? 0.6 : 1 }}
          >
            {recipientBusy ? "Checking…" : "Verify"}
          </button>
          {recipientResult && <div style={{ marginTop: 10, fontSize: 12, color: recipientResult.startsWith("Error") ? RED : "#c0ccd8" }}>{recipientResult}</div>}
        </div>
      </motion.div>

      {/* Transactions */}
      <motion.div {...fadeUp(0.25)} style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#f0f6ff" }}>Gateway transactions</div>
          <select value={txStatus} onChange={(e) => setTxStatus(e.target.value)} style={{ ...inputStyle, appearance: "auto" }}>
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="SUCCEEDED">Succeeded</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
        {txLoading ? (
          <div style={{ padding: "24px 0", textAlign: "center", color: "#4a5568", fontSize: 13 }}>Loading…</div>
        ) : transactions.length === 0 ? (
          <div style={{ padding: "24px 0", textAlign: "center", color: "#4a5568", fontSize: 13 }}>No transactions.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {transactions.map((tx, i) => (
              <div key={tx.transaction_id ?? i} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ flex: "1 1 160px", fontSize: 12, color: "#f0f6ff", fontFamily: "monospace" }}>{tx.client_reference ?? tx.transaction_id}</span>
                {tx.provider && <span style={{ fontSize: 11, color: "#8899aa" }}>{tx.provider}</span>}
                <span style={{ fontSize: 12, fontWeight: 700, color: GREEN }}>{tx.amount} {tx.currency ?? "GMD"}</span>
                {tx.status && <StatusChip status={tx.status} />}
                {tx.created_at && <span style={{ fontSize: 11, color: "#4a5568" }}>{new Date(tx.created_at).toLocaleString()}</span>}
              </div>
            ))}
          </div>
        )}
      </motion.div>

      <style>{`
        @media (max-width: 900px) {
          .gw-cards { grid-template-columns: repeat(2, 1fr) !important; }
          .gw-tools-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
    </div>
  );
}
