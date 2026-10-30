"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAdminUserOverview } from "@/hooks/use-frontend-data";
import { fmtDate, humanize, kycLabel } from "@/lib/fmt";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  AuditTrail, Chip, DataTable, KeyValues, OverviewShell, Section, Stat, Stats, StatusChip,
  fmtDateTime, linkStyle, money,
} from "@/components/admin/overview-ui";
import { DonationsTable, PayoutsTable, ReportsList } from "@/components/admin/overview-tables";
import type { UserOverview } from "@/types/frontend";

const stateStyle: React.CSSProperties = { minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: "#626d66", fontSize: 14 };

export default function AdminUserOverviewPage() {
  const params = useParams();
  const userId = Number(Array.isArray(params?.id) ? params.id[0] : params?.id);
  const { data, isLoading, isError } = useAdminUserOverview(userId);

  if (isLoading) return <div style={stateStyle}>Loading user…</div>;
  if (isError || !data) return <div style={stateStyle}>User not found. <Link href="/admin/users" style={linkStyle}>Back to users</Link></div>;
  return <Overview data={data} />;
}

function kycNote(status?: string | null) {
  switch ((status ?? "").toUpperCase()) {
    case "APPROVED": return "Identity verified — can withdraw from their campaigns.";
    case "SUBMITTED": case "REVIEWING": return "Documents submitted and waiting for review.";
    case "REJECTED": return "Rejected — they need to resubmit before they can withdraw.";
    default: return "No documents submitted yet — withdrawals are blocked until they do.";
  }
}

function Overview({ data }: { data: UserOverview }) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<{ msg: string; ok: boolean } | null>(null);
  const { user, totals: t } = data;
  const flagged = data.campaigns.filter((c) => c.issues.length > 0);
  const latestKyc = data.kyc_submissions[0];

  const setStatus = useMutation({
    mutationFn: async (status: "ACTIVE" | "SUSPENDED") => {
      await api.patch(`/admin/users/${user.id}/status`, null, { params: { status } });
    },
    onSuccess: async (_, status) => {
      setNotice({ msg: status === "ACTIVE" ? "Account re-enabled" : "Account suspended", ok: true });
      await queryClient.invalidateQueries({ queryKey: ["admin-user-overview", user.id] });
    },
    onError: () => setNotice({ msg: "Couldn't change the account status", ok: false }),
  });

  const sections = [
    { id: "summary", label: "Summary" },
    { id: "kyc", label: "KYC", count: data.kyc_submissions.length },
    { id: "campaigns", label: "Campaigns", count: data.campaigns.length },
    { id: "received", label: "Donations received", count: data.donations_received.length },
    { id: "withdrawals", label: "Withdrawals", count: data.withdrawals.length },
    { id: "given", label: "Donations made", count: data.donations_made.length },
    ...(data.recurring_plans.length ? [{ id: "recurring", label: "Recurring", count: data.recurring_plans.length }] : []),
    ...(data.organizations.length ? [{ id: "orgs", label: "Organizations", count: data.organizations.length }] : []),
    { id: "reports", label: "Reports", count: data.reports.fraud.length + data.reports.moderation.length },
    { id: "audit", label: "Audit trail", count: data.audit_log.length },
  ];

  return (
    <OverviewShell
      backHref="/admin/users"
      backLabel="All users"
      kicker={`User #${user.id}`}
      title={<span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}><UserAvatar name={user.full_name} src={user.avatar_url} size={40} ring={1} />{user.full_name ?? user.email}</span>}
      subtitle={<>{user.email}{user.wave_number ? ` · ${user.wave_number}` : ""} · joined {fmtDate(user.created_at)}</>}
      chips={<>
        <StatusChip status={user.is_active ? "ACTIVE" : "SUSPENDED"} />
        <Chip tone={user.role === "ADMIN" ? "amber" : "neutral"}>{user.role === "ADMIN" ? "Admin" : "Member"}</Chip>
        <Chip tone={user.kyc_status === "APPROVED" ? "green" : user.kyc_status === "REJECTED" ? "red" : "amber"}>KYC: {kycLabel(user.kyc_status)}</Chip>
        <Chip tone={user.is_email_verified ? "green" : "amber"}>{user.is_email_verified ? "Email verified" : "Email unverified"}</Chip>
        {flagged.length > 0 && <Chip tone="red">{flagged.length} campaign{flagged.length === 1 ? "" : "s"} flagged</Chip>}
      </>}
      actions={<>
        {user.handle && <a className="ov-btn" href={`/@${user.handle}`} target="_blank" rel="noreferrer">Public profile ↗</a>}
        <Link className="ov-btn" href={`/admin/users/${user.id}/edit`}>Edit</Link>
        {user.is_active
          ? <button className="ov-btn ov-btn-danger" disabled={setStatus.isPending} onClick={() => window.confirm(`Suspend ${user.full_name ?? user.email}? They will be signed out and blocked.`) && setStatus.mutate("SUSPENDED")}>Suspend</button>
          : <button className="ov-btn" disabled={setStatus.isPending} onClick={() => setStatus.mutate("ACTIVE")}>Re-enable</button>}
      </>}
      sections={sections}
    >
      {notice && <div className="ov-alert" style={{ background: notice.ok ? "#e9f5ef" : "#fdecec", color: notice.ok ? "#14784a" : "#c0392b" }}>{notice.msg}</div>}

      <Section id="summary" title="Summary">
        <Stats>
          <Stat label="Campaigns" value={t.campaigns} />
          <Stat label="Raised" value={money(t.raised)} sub={`${t.donations_received} donations received`} />
          <Stat label="Withdrawn" value={money(t.withdrawn)} sub={`${money(t.sent_to_wave)} sent to Wave`} />
          <Stat label="Balance" value={money(t.balance)} tone={t.balance < 0 ? "red" : undefined} sub="across their campaigns" />
          <Stat label="Given" value={money(t.given)} sub={`${t.donations_made} donations made`} />
          <Stat label="Followers" value={t.followers} sub={`following ${t.following}`} />
          <Stat label="Referred" value={t.referred_users} sub={user.referral_code ? `code ${user.referral_code}` : undefined} />
        </Stats>
        <div style={{ marginTop: 14 }}>
          <KeyValues rows={[
            ["Handle", user.handle ? `@${user.handle}` : "—"],
            ["Uses Kambeng to", user.account_purpose ? humanize(user.account_purpose) : "—"],
            ["Referred by code", user.referred_by_code ?? "—"],
            ["Joined", fmtDateTime(user.created_at)],
          ]} />
        </div>
      </Section>

      <Section id="kyc" title="Identity verification (KYC)" sub={kycNote(user.kyc_status)}
        action={latestKyc && <Link href={`/admin/kyc-queue/${latestKyc.id}/review`} style={linkStyle}>Review latest →</Link>}>
        <KeyValues rows={[
          ["Status", <StatusChip key="s" status={user.kyc_status} />],
          ["Verified on", user.kyc_verified_at ? fmtDate(user.kyc_verified_at) : "—"],
          ["Last rejection reason", user.kyc_rejection_reason ?? "—"],
        ]} />
        <div style={{ marginTop: 14 }}>
          <DataTable
            rows={data.kyc_submissions}
            rowKey={(k) => k.id}
            empty="No KYC submissions"
            columns={[
              { key: "d", label: "Submitted", render: (k) => fmtDateTime(k.created_at), width: "150px" },
              { key: "t", label: "Document", render: (k) => humanize(k.document_type) },
              { key: "s", label: "Status", render: (k) => <StatusChip status={k.status} />, width: "120px" },
              { key: "r", label: "Reviewed", render: (k) => k.reviewed_at ? `${fmtDate(k.reviewed_at)}${k.reviewed_by ? ` · ${k.reviewed_by}` : ""}` : "—" },
              { key: "x", label: "Reason", render: (k) => k.rejection_reason ?? "—" },
              { key: "o", label: "", render: (k) => <Link href={`/admin/kyc-queue/${k.id}/review`} style={linkStyle}>Open documents</Link>, width: "130px" },
            ]}
          />
        </div>
      </Section>

      <Section id="campaigns" title="Campaigns">
        <DataTable
          rows={data.campaigns}
          rowKey={(c) => c.id}
          empty="No campaigns"
          columns={[
            { key: "t", label: "Campaign", render: (c) => <span><Link href={`/admin/campaigns/${c.id}/view`} style={linkStyle}>{c.title}</Link><div className="ov-faint">started {fmtDate(c.created_at)}</div></span> },
            { key: "s", label: "Status", render: (c) => <StatusChip status={c.status} />, width: "110px" },
            { key: "r", label: "Raised", render: (c) => c.target_amount ? `${money(c.amount_raised)} / ${money(c.target_amount)}` : money(c.amount_raised), align: "right" },
            { key: "d", label: "Gifts", render: (c) => c.donations, align: "right", width: "70px" },
            { key: "w", label: "Withdrawn", render: (c) => money(c.withdrawn), align: "right", width: "110px" },
            { key: "b", label: "Balance", render: (c) => <span style={{ color: c.balance < 0 ? "#c0392b" : undefined }}>{money(c.balance)}</span>, align: "right", width: "110px" },
            { key: "i", label: "Checks", render: (c) => c.issues.length ? c.issues.map((i) => <Chip key={i} tone="red">{humanize(i)}</Chip>) : <Chip tone="green">OK</Chip>, width: "130px" },
          ]}
        />
      </Section>

      <Section id="received" title="Donations received" sub="Across all of their campaigns">
        <DonationsTable rows={data.donations_received} showCampaign />
      </Section>

      <Section id="withdrawals" title="Withdrawals" sub="From their campaigns, or requested by them">
        <PayoutsTable rows={data.withdrawals} showCampaign />
      </Section>

      <Section id="given" title="Donations made" sub="Matched by their account or email">
        <DonationsTable rows={data.donations_made} showCampaign />
      </Section>

      {data.recurring_plans.length > 0 && (
        <Section id="recurring" title="Recurring donations">
          <DataTable
            rows={data.recurring_plans}
            rowKey={(p) => p.id}
            columns={[
              { key: "c", label: "Campaign", render: (p) => <Link href={`/admin/campaigns/${p.campaign_id}/view`} style={linkStyle}>{p.campaign_title ?? `#${p.campaign_id}`}</Link> },
              { key: "a", label: "Amount", render: (p) => `${money(p.amount)} ${humanize(p.frequency).toLowerCase()}`, align: "right" },
              { key: "n", label: "Next charge", render: (p) => p.is_active && p.next_charge_date ? fmtDate(p.next_charge_date) : "—", width: "120px" },
              { key: "s", label: "Status", render: (p) => <StatusChip status={p.is_active ? "ACTIVE" : p.cancelled_at ? "CANCELLED" : "PAUSED"} />, width: "110px" },
              { key: "d", label: "Since", render: (p) => fmtDate(p.created_at), width: "110px" },
            ]}
          />
        </Section>
      )}

      {data.organizations.length > 0 && (
        <Section id="orgs" title="Organizations">
          <DataTable
            rows={data.organizations}
            rowKey={(o) => `${o.id}-${o.role}`}
            columns={[
              { key: "n", label: "Organization", render: (o) => <span className="ov-strong">{o.name}</span> },
              { key: "r", label: "Role", render: (o) => o.role },
              { key: "t", label: "Type", render: (o) => o.org_type ? humanize(o.org_type) : "—" },
              { key: "s", label: "Status", render: (o) => <StatusChip status={o.verification_status ?? o.status} />, width: "130px" },
            ]}
          />
        </Section>
      )}

      <Section id="reports" title="Reports" sub="Fraud and moderation reports about their campaigns">
        <ReportsList reports={data.reports} />
      </Section>

      <Section id="audit" title="Audit trail" sub="Admin actions on this user and their campaigns">
        <AuditTrail entries={data.audit_log} />
      </Section>
    </OverviewShell>
  );
}
