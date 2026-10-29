"use client";

import { useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useCampaignMoneyAudit, useCorrectCampaignTotal, useGatewayWalletBalance } from "@/hooks/use-frontend-data";
import type { CampaignAuditIssue, CampaignAuditRow } from "@/types/frontend";

const GREEN = "#14784a";
const RED = "#d42f2f";
const ORANGE = "#b9500b";

const ISSUE_LABELS: Record<CampaignAuditIssue, { label: string; color: string; help: string }> = {
  over_credited: { label: "Over-credited", color: RED, help: "Holds more than its donations and promotions explain. Withdrawals are paused." },
  under_credited: { label: "Under-credited", color: ORANGE, help: "Holds less than its donations and promotions explain." },
  overdrawn: { label: "Overdrawn", color: RED, help: "More has been withdrawn than it really raised." },
  goal_mismatch: { label: "Goal mismatch", color: ORANGE, help: "A goal's total doesn't match its donations." },
};

const COLUMNS = "1fr 90px 90px 90px 90px 100px 150px 110px";

function gmd(value: number) {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} GMD`;
}

function errorMessage(error: unknown) {
  if (axios.isAxiosError(error) && typeof error.response?.data?.detail === "string") return error.response.data.detail;
  return "Correction failed";
}

export function CampaignMoneyAudit() {
  const router = useRouter();
  const { data: report, isLoading, isError, refetch, isFetching } = useCampaignMoneyAudit();
  const { data: walletBalance } = useGatewayWalletBalance();
  const correct = useCorrectCampaignTotal();

  const [correcting, setCorrecting] = useState<CampaignAuditRow | null>(null);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<{ msg: string; ok: boolean } | null>(null);

  const rows = report?.campaigns ?? [];
  const summary = report?.summary;
  const walletShort = summary && walletBalance != null && walletBalance < summary.owed_to_campaigns;

  const submit = async () => {
    if (!correcting || reason.trim().length < 5) {
      setNotice({ msg: "Explain the correction (at least 5 characters)", ok: false });
      return;
    }
    try {
      const result = await correct.mutateAsync({ campaignId: correcting.campaign_id, expectedCurrent: correcting.amount_raised, reason: reason.trim() });
      setNotice({ msg: `${correcting.title}: ${gmd(result.previous)} → ${gmd(result.corrected)}`, ok: true });
      setCorrecting(null);
      setReason("");
    } catch (error) {
      setNotice({ msg: errorMessage(error), ok: false });
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#15201a", letterSpacing: "-0.02em" }}>Campaign totals</div>
          <div style={{ fontSize: 13, color: "#626d66", marginTop: 4, maxWidth: 620 }}>
            Each campaign&apos;s raised amount, recomputed from its successful donations and promotions and compared with what is stored. Also checked daily; admins are emailed when anything is flagged.
          </div>
        </div>
        <button onClick={() => void refetch()} disabled={isFetching} style={{ padding: "8px 16px", borderRadius: 9, border: "1px solid rgba(21,32,26,0.12)", background: "#fff", color: "#15201a", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          {isFetching ? "Checking…" : "Re-run check"}
        </button>
      </div>

      {summary && (
        <div className="admin-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2, background: "#fff", border: "1px solid rgba(21,32,26,0.07)", borderRadius: 12, overflow: "hidden" }}>
          {[
            { label: "Flagged campaigns", value: String(summary.flagged_campaigns), color: summary.flagged_campaigns ? RED : GREEN },
            { label: "Unexplained credit", value: gmd(summary.over_credited), color: summary.over_credited ? RED : "#15201a" },
            { label: "Overdrawn", value: gmd(summary.overdrawn), color: summary.overdrawn ? RED : "#15201a" },
            {
              label: "Owed to campaigns / wallet",
              value: `${gmd(summary.owed_to_campaigns)} / ${walletBalance == null ? "—" : gmd(walletBalance)}`,
              color: walletShort ? RED : "#15201a",
            },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ padding: "12px 18px" }}>
              <div style={{ fontSize: 10, color: "#6e7872", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color }}>{value}</div>
            </div>
          ))}
        </div>
      )}
      {walletShort && (
        <div style={{ padding: "10px 14px", borderRadius: 10, background: "#fdecec", border: "1px solid rgba(212,47,47,0.25)", color: RED, fontSize: 13, fontWeight: 600 }}>
          The HexAI wallet holds less than campaigns are owed. Money has left the wallet that the records don&apos;t account for — investigate before approving withdrawals.
        </div>
      )}

      {notice && (
        <div style={{ padding: "10px 14px", borderRadius: 10, background: notice.ok ? "#e9f5ef" : "#fdecec", color: notice.ok ? GREEN : RED, fontSize: 13, fontWeight: 600 }}>{notice.msg}</div>
      )}

      {correcting && (
        <div style={{ background: "#fff", border: "1px solid rgba(212,47,47,0.2)", borderRadius: 14, padding: "20px 22px" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#15201a" }}>Correct {correcting.title}</div>
          <div style={{ fontSize: 13, color: "#56625b", marginTop: 6, lineHeight: 1.5 }}>
            Raised amount goes from <b>{gmd(correcting.amount_raised)}</b> to <b>{gmd(correcting.expected)}</b>
            {" "}({gmd(correcting.donations_net)} donations + {gmd(correcting.promo_credit)} promotions). Balance after: <b>{gmd(correcting.true_balance)}</b>.
            {correcting.true_balance < 0 && " The campaign owes this amount; it is taken from future donations before the next withdrawal."}
            {correcting.goals.length > 0 && ` ${correcting.goals.length} goal total(s) are corrected too.`}
          </div>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Why — e.g. donation DON-… credited twice by the webhook/poll race"
            style={{ width: "100%", marginTop: 12, padding: "10px 13px", borderRadius: 9, border: "1px solid rgba(21,32,26,0.15)", fontSize: 13, resize: "vertical", boxSizing: "border-box" }} />
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button onClick={() => void submit()} disabled={correct.isPending} style={{ padding: "9px 18px", borderRadius: 9, border: "none", background: GREEN, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              {correct.isPending ? "Saving…" : "Apply correction"}
            </button>
            <button onClick={() => { setCorrecting(null); setReason(""); }} style={{ padding: "9px 18px", borderRadius: 9, border: "1px solid rgba(21,32,26,0.1)", background: "#fff", color: "#56625b", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ background: "#fff", border: "1px solid rgba(21,32,26,0.07)", borderRadius: 16, overflowX: "auto" }}>
        <div className="admin-table-wrap" style={{ minWidth: 900 }}>
          <div className="admin-table-header" style={{ display: "grid", gridTemplateColumns: COLUMNS, padding: "10px 18px", borderBottom: "1px solid rgba(21,32,26,0.06)", fontSize: 10, fontWeight: 700, color: "#6e7872", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            <div>Campaign</div><div>Stored</div><div>Expected</div><div>Difference</div><div>Withdrawn</div><div>True balance</div><div>Issues</div><div>Action</div>
          </div>
          {isLoading ? (
            <div style={{ padding: 36, textAlign: "center", color: "#6e7872", fontSize: 13 }}>Checking campaign totals…</div>
          ) : isError ? (
            <div style={{ padding: 36, textAlign: "center", color: RED, fontSize: 13 }}>Couldn&apos;t load the audit</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: "40px 24px", textAlign: "center", color: GREEN, fontSize: 14, fontWeight: 600 }}>Every campaign total matches its records</div>
          ) : rows.map((row) => (
            <div key={row.campaign_id} className="admin-table-row" style={{ display: "grid", gridTemplateColumns: COLUMNS, padding: "13px 18px", alignItems: "start", borderBottom: "1px solid rgba(21,32,26,0.04)" }}>
              <div data-label="Campaign" style={{ fontSize: 13, fontWeight: 600, color: "#15201a", overflow: "hidden", textOverflow: "ellipsis" }}>
                <button onClick={() => router.push(`/admin/campaigns/${row.campaign_id}/view`)} style={{ all: "unset", cursor: "pointer", color: "#15201a" }}>{row.title}</button>
                <div style={{ fontSize: 11, color: "#6e7872", fontWeight: 400 }}>#{row.campaign_id}</div>
              </div>
              <div data-label="Stored" style={{ fontSize: 13 }}>{gmd(row.amount_raised)}</div>
              <div data-label="Expected" style={{ fontSize: 13 }}>{gmd(row.expected)}</div>
              <div data-label="Difference" style={{ fontSize: 13, fontWeight: 700, color: row.difference > 0 ? RED : row.difference < 0 ? ORANGE : "#15201a" }}>
                {row.difference > 0 ? "+" : ""}{gmd(row.difference)}
              </div>
              <div data-label="Withdrawn" style={{ fontSize: 13 }}>{gmd(row.withdrawn)}</div>
              <div data-label="True balance" style={{ fontSize: 13, fontWeight: 700, color: row.true_balance < 0 ? RED : "#15201a" }}>{gmd(row.true_balance)}</div>
              <div data-label="Issues" style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {row.issues.map((issue) => (
                  <span key={issue} title={ISSUE_LABELS[issue].help} style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 20, color: ISSUE_LABELS[issue].color, background: `${ISSUE_LABELS[issue].color}14`, border: `1px solid ${ISSUE_LABELS[issue].color}40` }}>
                    {ISSUE_LABELS[issue].label}
                  </span>
                ))}
              </div>
              <div data-label="Action">
                {row.difference !== 0 || row.goals.length > 0 ? (
                  <button onClick={() => { setCorrecting(row); setReason(""); setNotice(null); }} style={{ padding: "5px 11px", borderRadius: 7, fontSize: 11, fontWeight: 700, border: "1px solid rgba(20,120,74,0.3)", background: "#edf7f2", color: GREEN, cursor: "pointer" }}>
                    Correct
                  </button>
                ) : (
                  <span style={{ fontSize: 11, color: "#6e7872" }}>Recovering</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
