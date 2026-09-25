"use client";

import { useState } from "react";
import { isAxiosError } from "axios";

import { useAppFeedback } from "@/components/ui";
import {
  useInviteOrganizationMember,
  useMyOrganizationInvitations,
  useRemoveOrganizationMember,
  useRespondToInvitation,
  useUpdateOrganization,
} from "@/hooks/use-frontend-data";
import { organizationTypeLabel } from "@/lib/organizations";
import type { Organization } from "@/types/frontend";

const BLUE = "#14784a";
const GREEN = "#1f9960";
const RED = "#b42323";

const sectionLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#6e7872", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 };
const input: React.CSSProperties = {
  padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(21,32,26,0.12)", background: "#fff",
  color: "#15201a", fontSize: 14, outline: "none", boxSizing: "border-box", minWidth: 0,
};
const primaryBtn: React.CSSProperties = { padding: "10px 16px", borderRadius: 10, border: "none", background: BLUE, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" };
const ghostBtn: React.CSSProperties = { padding: "8px 12px", borderRadius: 9, border: "1px solid rgba(21,32,26,0.12)", background: "#fff", color: "#56625b", fontSize: 12, fontWeight: 600, cursor: "pointer" };

function detail(error: unknown, fallback: string) {
  const d = isAxiosError(error) ? error.response?.data?.detail : null;
  if (typeof d === "string") return d;
  if (Array.isArray(d) && d[0]?.msg) return String(d[0].msg);
  return fallback;
}

/** Owner: team members, invites and the two-person approval rule. */
export function TeamSection({ org }: { org: Organization }) {
  const invite = useInviteOrganizationMember();
  const remove = useRemoveOrganizationMember();
  const update = useUpdateOrganization();
  const { message } = useAppFeedback();
  const [identifier, setIdentifier] = useState("");
  const [title, setTitle] = useState("");
  const [threshold, setThreshold] = useState(org.approval_threshold != null ? String(org.approval_threshold) : "");

  const activeMembers = org.members.filter((m) => m.status === "ACTIVE");

  const onInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await invite.mutateAsync({ id: org.id, identifier: identifier.trim(), title: title.trim() || undefined });
      message.success("Invitation sent. They'll see it when they sign in.");
      setIdentifier("");
      setTitle("");
    } catch (err) {
      message.error(detail(err, "Couldn't send the invitation"));
    }
  };

  const saveThreshold = async (value: number | null) => {
    try {
      await update.mutateAsync({ id: org.id, approval_threshold: value });
      message.success(value == null ? "Approval rule turned off" : `Withdrawals above ${value.toLocaleString()} GMD now need a second manager`);
      if (value == null) setThreshold("");
    } catch (err) {
      message.error(detail(err, "Couldn't save the approval rule"));
    }
  };

  return (
    <div style={{ borderTop: "1px solid rgba(21,32,26,0.06)", paddingTop: 16, display: "grid", gap: 18 }}>
      <div>
        <div style={sectionLabel}>Team</div>
        <div style={{ fontSize: 13, color: "#56625b", lineHeight: 1.6, marginBottom: 12 }}>
          Managers can post updates and receipts, withdraw, and approve each other&apos;s large withdrawals. Only you can change the team, verification and settings.
        </div>

        <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 10, background: "#faf9f6" }}>
            <span style={{ fontSize: 13, color: "#15201a", fontWeight: 600 }}>
              {org.owner_name ?? "You"} <span style={{ color: "#6e7872", fontWeight: 500 }}>· Owner{org.representative_role ? `, ${org.representative_role}` : ""}</span>
            </span>
          </div>
          {org.members.map((m) => (
            <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, background: "#faf9f6", flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: "#15201a", fontWeight: 600 }}>
                {m.full_name ?? `User #${m.user_id}`}
                <span style={{ color: "#6e7872", fontWeight: 500 }}>{m.title ? ` · ${m.title}` : ""}</span>
                {m.status === "INVITED" && <span style={{ marginLeft: 8, fontSize: 11, color: "#b9500b", fontWeight: 700 }}>Invited</span>}
                {m.status === "ACTIVE" && !m.kyc_verified && <span style={{ marginLeft: 8, fontSize: 11, color: "#b9500b", fontWeight: 600 }}>KYC pending</span>}
                {m.status === "ACTIVE" && m.kyc_verified && <span style={{ marginLeft: 8, fontSize: 11, color: GREEN, fontWeight: 600 }}>✓ KYC</span>}
              </span>
              <button type="button" style={ghostBtn} disabled={remove.isPending}
                onClick={() => void remove.mutateAsync({ id: org.id, memberId: m.id }).then(
                  () => message.success(m.status === "INVITED" ? "Invitation withdrawn" : "Removed from the team"),
                  (err) => message.error(detail(err, "Couldn't remove them")),
                )}>
                {m.status === "INVITED" ? "Withdraw invite" : "Remove"}
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={(e) => void onInvite(e)} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
          <input required value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="Their Wave number or email" aria-label="Wave number or email" style={input} />
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="Role, e.g. Treasurer" aria-label="Role" style={input} />
          <button type="submit" disabled={invite.isPending} style={primaryBtn}>{invite.isPending ? "Inviting…" : "Invite"}</button>
        </form>
        <div style={{ fontSize: 11, color: "#6e7872", marginTop: 6 }}>They need a Kambeng account first.</div>
      </div>

      <div>
        <div style={sectionLabel}>Two-person approval</div>
        <div style={{ fontSize: 13, color: "#56625b", lineHeight: 1.6, marginBottom: 10 }}>
          Withdrawals above this amount wait until a different manager approves them.
          {activeMembers.length === 0 && " Add a team member first, so someone can approve."}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input type="number" min={0} step={1} inputMode="numeric" value={threshold} onChange={(e) => setThreshold(e.target.value)}
            placeholder="e.g. 5000" aria-label="Approval threshold in GMD" disabled={activeMembers.length === 0} style={{ ...input, width: 140 }} />
          <span style={{ fontSize: 13, color: "#6e7872" }}>GMD</span>
          <button type="button" style={primaryBtn} disabled={update.isPending || threshold === "" || activeMembers.length === 0}
            onClick={() => void saveThreshold(Math.floor(Number(threshold)))}>Save</button>
          {org.approval_threshold != null && (
            <button type="button" style={ghostBtn} disabled={update.isPending} onClick={() => void saveThreshold(null)}>Turn off</button>
          )}
        </div>
        {org.approval_threshold != null && activeMembers.length === 0 && (
          <div style={{ fontSize: 12, color: RED, marginTop: 8 }}>
            Nobody else is on the team, so withdrawals above {org.approval_threshold.toLocaleString()} GMD can&apos;t be approved. Invite someone or turn the rule off.
          </div>
        )}
      </div>
    </div>
  );
}

/** A manager's (non-owner's) view of an organization they help run. */
export function ManagerSummary({ org, myUserId }: { org: Organization; myUserId?: number }) {
  const remove = useRemoveOrganizationMember();
  const { message } = useAppFeedback();
  const me = org.members.find((m) => m.user_id === myUserId);
  return (
    <div style={{ borderTop: "1px solid rgba(21,32,26,0.06)", paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <div style={{ fontSize: 13, color: "#56625b", lineHeight: 1.6 }}>
        You help manage {org.name}{me?.title ? ` as ${me.title}` : ""}. {org.owner_name ?? "The owner"} runs the team and verification.
        {org.approval_threshold != null && ` Withdrawals above ${org.approval_threshold.toLocaleString()} GMD need a second manager.`}
      </div>
      {me && (
        <button type="button" style={ghostBtn} disabled={remove.isPending}
          onClick={() => {
            if (!window.confirm(`Leave ${org.name}? You'll lose access to its campaigns.`)) return;
            void remove.mutateAsync({ id: org.id, memberId: me.id }).then(
              () => message.success(`You left ${org.name}`),
              (err) => message.error(detail(err, "Couldn't leave the team")),
            );
          }}>
          Leave team
        </button>
      )}
    </div>
  );
}

/** Pending invitations for the signed-in user. */
export function InvitationsBanner() {
  const { data: invitations = [] } = useMyOrganizationInvitations(true);
  const respond = useRespondToInvitation();
  const { message } = useAppFeedback();
  if (invitations.length === 0) return null;

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {invitations.map((inv) => (
        <div key={inv.member_id} style={{ padding: "14px 18px", borderRadius: 14, background: "#eff6f2", border: "1px solid rgba(20,120,74,0.25)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 13, color: "#15201a", lineHeight: 1.6 }}>
            <strong>{inv.invited_by_name ?? "Someone"}</strong> invited you to help manage <strong>{inv.organization.name}</strong>
            {inv.title ? ` as ${inv.title}` : ""}
            <span style={{ color: "#6e7872" }}> · {organizationTypeLabel(inv.organization.org_type)}</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" style={primaryBtn} disabled={respond.isPending}
              onClick={() => void respond.mutateAsync({ memberId: inv.member_id, accept: true }).then(
                () => message.success(`You're now on the ${inv.organization.name} team`),
                (err) => message.error(detail(err, "Couldn't accept")),
              )}>Accept</button>
            <button type="button" style={ghostBtn} disabled={respond.isPending}
              onClick={() => void respond.mutateAsync({ memberId: inv.member_id, accept: false }).then(
                () => message.success("Invitation declined"),
                (err) => message.error(detail(err, "Couldn't decline")),
              )}>Decline</button>
          </div>
        </div>
      ))}
    </div>
  );
}
