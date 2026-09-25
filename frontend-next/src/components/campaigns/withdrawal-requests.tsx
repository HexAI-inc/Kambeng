"use client";

import { useState } from "react";
import { isAxiosError } from "axios";

import { useAppFeedback } from "@/components/ui";
import { useDecideWithdrawalRequest, useWithdrawalRequests } from "@/hooks/use-frontend-data";
import type { WithdrawalRequest } from "@/types/frontend";

const BLUE = "#14784a";
const GREEN = "#1f9960";
const RED = "#b42323";

const STATUS_COPY: Record<WithdrawalRequest["status"], { label: string; color: string; bg: string }> = {
  PENDING: { label: "Waiting for approval", color: "#b9500b", bg: "#fdf0e7" },
  APPROVED: { label: "Approved · sent", color: GREEN, bg: "#e9f5ef" },
  REJECTED: { label: "Rejected", color: RED, bg: "#fdecec" },
  CANCELLED: { label: "Cancelled", color: "#56625b", bg: "rgba(21,32,26,0.05)" },
  FAILED: { label: "Approved · payout failed", color: RED, bg: "#fdecec" },
};

function when(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function RequestRow({ request }: { request: WithdrawalRequest }) {
  const decide = useDecideWithdrawalRequest();
  const { message } = useAppFeedback();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const copy = STATUS_COPY[request.status];

  const act = async (action: "approve" | "reject" | "cancel") => {
    try {
      await decide.mutateAsync({ requestId: request.id, action, note: action === "reject" ? note.trim() || undefined : undefined });
      message.success(
        action === "approve" ? `Approved. ${request.amount.toLocaleString()} GMD is on its way.`
          : action === "reject" ? "Rejected. They've been told." : "Request cancelled.",
      );
      setRejecting(false);
    } catch (error) {
      const detail = isAxiosError(error) ? error.response?.data?.detail : null;
      message.error(typeof detail === "string" ? detail : "That didn't work. Please try again.");
    }
  };

  return (
    <div style={{ padding: "14px 18px", borderTop: "1px solid rgba(21,32,26,0.05)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#15201a" }}>{request.amount.toLocaleString()} GMD</div>
          <div style={{ fontSize: 12, color: "#626d66", marginTop: 2 }}>
            Asked by {request.requested_by_name ?? "a manager"} · {when(request.created_at)}
            {request.decided_by_name && request.status !== "PENDING" && request.status !== "CANCELLED" ? ` · decided by ${request.decided_by_name}` : ""}
          </div>
          {request.note && <div style={{ fontSize: 12, color: "#56625b", marginTop: 4 }}>“{request.note}”</div>}
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 20, color: copy.color, background: copy.bg, whiteSpace: "nowrap" }}>
          {copy.label}
        </span>
      </div>

      {(request.can_approve || request.can_cancel) && !rejecting && (
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          {request.can_approve && (
            <>
              <button type="button" disabled={decide.isPending} onClick={() => void act("approve")}
                style={{ padding: "9px 16px", borderRadius: 9, border: "none", background: BLUE, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {decide.isPending ? "Working…" : "Approve and send"}
              </button>
              <button type="button" onClick={() => setRejecting(true)}
                style={{ padding: "9px 16px", borderRadius: 9, border: "1px solid rgba(239,68,68,0.3)", background: "#fef0f0", color: RED, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Reject
              </button>
            </>
          )}
          {request.can_cancel && (
            <button type="button" disabled={decide.isPending} onClick={() => void act("cancel")}
              style={{ padding: "9px 16px", borderRadius: 9, border: "1px solid rgba(21,32,26,0.12)", background: "#fff", color: "#56625b", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Cancel request
            </button>
          )}
        </div>
      )}

      {rejecting && (
        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Why? (they'll see this)"
            style={{ padding: "9px 12px", borderRadius: 9, border: "1px solid rgba(21,32,26,0.12)", fontSize: 13 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" disabled={decide.isPending} onClick={() => void act("reject")}
              style={{ padding: "9px 16px", borderRadius: 9, border: "none", background: RED, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Confirm rejection
            </button>
            <button type="button" onClick={() => setRejecting(false)}
              style={{ padding: "9px 16px", borderRadius: 9, border: "1px solid rgba(21,32,26,0.12)", background: "#fff", color: "#56625b", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Two-person approval for organization withdrawals above the threshold. */
export function WithdrawalRequestsPanel({ campaignId, threshold }: { campaignId: number; threshold?: number | null }) {
  const { data: requests = [] } = useWithdrawalRequests(campaignId);
  if (!threshold && requests.length === 0) return null;
  const waitingOnMe = requests.some((r) => r.can_approve);

  return (
    <div style={{ background: "#fff", border: `1px solid ${waitingOnMe ? "rgba(232,101,15,0.35)" : "rgba(21,32,26,0.07)"}`, borderRadius: 16, overflow: "hidden" }}>
      <div style={{ padding: "16px 18px" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#15201a" }}>Approvals</div>
        <div style={{ fontSize: 12, color: "#626d66", marginTop: 3, lineHeight: 1.5 }}>
          {threshold != null
            ? `Withdrawals above ${threshold.toLocaleString()} GMD need a second manager to approve before any money moves.`
            : "The approval rule is off for this organization."}
        </div>
      </div>
      {requests.length === 0 ? (
        <div style={{ padding: "12px 18px 16px", fontSize: 13, color: "#6e7872", borderTop: "1px solid rgba(21,32,26,0.05)" }}>No requests yet.</div>
      ) : (
        requests.map((r) => <RequestRow key={r.id} request={r} />)
      )}
    </div>
  );
}
