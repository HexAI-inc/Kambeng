"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAdminCampaignOverview } from "@/hooks/use-frontend-data";
import { fmtDate, humanize, railLabel } from "@/lib/fmt";
import { getCampaignCategory } from "@/lib/campaign-categories";
import {
  AuditTrail, Chip, DataTable, KeyValues, OverviewShell, Section, Stat, Stats, StatusChip,
  fmtDateTime, linkStyle, money,
} from "@/components/admin/overview-ui";
import { DonationsTable, PayoutsTable, ReportsList } from "@/components/admin/overview-tables";
import type { CampaignOverview } from "@/types/frontend";

const ISSUE_TEXT: Record<string, string> = {
  over_credited: "Holds more than its donations and promotions explain — withdrawals are paused",
  under_credited: "Holds less than its donations and promotions explain",
  overdrawn: "More has been withdrawn than it really raised",
  goal_mismatch: "A goal's total doesn't match its donations",
};

export default function AdminCampaignOverviewPage() {
  const params = useParams();
  const campaignId = Number(Array.isArray(params?.id) ? params.id[0] : params?.id);
  const { data, isLoading, isError } = useAdminCampaignOverview(campaignId);

  if (isLoading) return <div style={stateStyle}>Loading campaign…</div>;
  if (isError || !data) return <div style={stateStyle}>Campaign not found. <Link href="/admin/campaigns" style={linkStyle}>Back to campaigns</Link></div>;
  return <Overview data={data} />;
}

const stateStyle: React.CSSProperties = { minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: "#626d66", fontSize: 14 };

function Overview({ data }: { data: CampaignOverview }) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<{ msg: string; ok: boolean } | null>(null);
  const { campaign, owner, organization, money: m, donation_stats: ds } = data;
  const category = getCampaignCategory(campaign.category);
  const progress = campaign.target_amount ? Math.min((campaign.amount_raised / campaign.target_amount) * 100, 100) : null;
  const reportsCount = data.reports.fraud.length + data.reports.moderation.length;

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      await api.patch(`/admin/campaigns/${campaign.slug}/status`, null, { params: { status } });
    },
    onSuccess: async (_, status) => {
      setNotice({ msg: `Campaign is now ${humanize(status)}`, ok: true });
      await queryClient.invalidateQueries({ queryKey: ["admin-campaign-overview", campaign.id] });
    },
    onError: () => setNotice({ msg: "Couldn't update the status", ok: false }),
  });

  const sections = [
    { id: "money", label: "Money" },
    { id: "details", label: "Details" },
    { id: "organizer", label: "Organizer" },
    { id: "donations", label: "Donations", count: data.donations.length },
    { id: "withdrawals", label: "Withdrawals", count: data.payouts.length },
    { id: "spending", label: "Updates & receipts", count: data.updates.length + data.proofs.length },
    ...(data.goals.length ? [{ id: "goals", label: "Goals", count: data.goals.length }] : []),
    { id: "community", label: "Reviews & reach" },
    { id: "reports", label: "Reports", count: reportsCount },
    { id: "audit", label: "Audit trail", count: data.audit_log.length },
  ];

  return (
    <OverviewShell
      backHref="/admin/campaigns"
      backLabel="All campaigns"
      kicker={`Campaign #${campaign.id}`}
      title={campaign.title}
      subtitle={<>/{campaign.slug} · started {fmtDate(campaign.created_at)}{category ? ` · ${category.label}` : ""}</>}
      chips={<>
        <StatusChip status={campaign.status} />
        <Chip>{humanize(campaign.mode)}</Chip>
        {organization && <Chip tone="blue">Organization</Chip>}
        {campaign.active_promo && <Chip tone="green">Promo: {campaign.active_promo}</Chip>}
        {m.issues.map((issue) => <Chip key={issue} tone="red">{humanize(issue)}</Chip>)}
      </>}
      actions={<>
        <a className="ov-btn" href={`/campaigns/${campaign.slug}`} target="_blank" rel="noreferrer">Public page ↗</a>
        <Link className="ov-btn" href={`/admin/campaigns/${campaign.id}/edit`}>Edit</Link>
        {campaign.status !== "ACTIVE" && <button className="ov-btn" disabled={updateStatus.isPending} onClick={() => updateStatus.mutate("ACTIVE")}>Activate</button>}
        {campaign.status !== "SUSPENDED" && <button className="ov-btn ov-btn-danger" disabled={updateStatus.isPending} onClick={() => updateStatus.mutate("SUSPENDED")}>Suspend</button>}
        {campaign.status !== "CLOSED" && <button className="ov-btn" disabled={updateStatus.isPending} onClick={() => updateStatus.mutate("CLOSED")}>Close</button>}
      </>}
      sections={sections}
    >
      {notice && <div className="ov-alert" style={{ background: notice.ok ? "#e9f5ef" : "#fdecec", color: notice.ok ? "#14784a" : "#c0392b" }}>{notice.msg}</div>}
      {m.issues.length > 0 && (
        <div className="ov-alert" style={{ background: "#fdecec", color: "#c0392b" }}>
          {m.issues.map((i) => ISSUE_TEXT[i]).join(". ")}. <Link href="/admin/reconciliations" style={{ color: "inherit", textDecoration: "underline" }}>Review in Reconciliations</Link>
        </div>
      )}

      <Section id="money" title="Money" sub="Stored totals checked against the donation and promotion records behind them">
        <Stats>
          <Stat label="Raised (shown publicly)" value={money(m.amount_raised)} sub={progress != null ? `${Math.round(progress)}% of ${money(campaign.target_amount)}` : "No target"} />
          <Stat label="Backed by records" value={money(m.expected)} sub={`${money(m.donations_net)} donations + ${money(m.promo_credit)} promos`} tone={Math.abs(m.difference) >= 1 ? "red" : undefined} />
          <Stat label="Withdrawn" value={money(m.withdrawn)} sub="including fees" />
          <Stat label="Available balance" value={money(m.balance)} tone={m.balance < 0 ? "red" : "green"} sub={m.adjustments ? `incl. ${money(m.adjustments)} adjustments` : undefined} />
          <Stat label="Donors paid in" value={money(ds.gross)} sub={`${money(ds.gross - ds.net)} gateway fees`} />
          <Stat label="Receipts posted" value={money(m.spending.accounted_for)} sub={m.spending.unaccounted > 0 ? `${money(m.spending.unaccounted)} of withdrawals unaccounted` : "All withdrawals accounted for"} tone={m.spending.unaccounted > 0 ? "amber" : undefined} />
        </Stats>
        {progress != null && <div className="ov-progress" style={{ marginTop: 14 }}><div style={{ width: `${progress}%` }} /></div>}
      </Section>

      <div className="ov-grid-2">
        <Section id="details" title="Details">
          <p style={{ fontSize: 13, color: "#36443c", lineHeight: 1.7, margin: "0 0 12px", whiteSpace: "pre-line" }}>{campaign.description || "No description"}</p>
          <KeyValues rows={[
            ["Category", category?.label ?? "—"],
            ["Tags", campaign.tags.length ? campaign.tags.map((t) => `#${t}`).join(" ") : "—"],
            ["Raises for", humanize(campaign.beneficiary_type)],
            ["Organiser type", humanize(campaign.organiser_type)],
            ["Target", campaign.target_amount ? money(campaign.target_amount) : "Ongoing, no target"],
            ["Class board", campaign.class_board_enabled ? "On" : "Off"],
            ["Short links", campaign.short_codes.length ? campaign.short_codes.join(", ") : "—"],
            ["Created", fmtDateTime(campaign.created_at)],
          ]} />
        </Section>

        <Section id="organizer" title="Organizer" action={owner && <Link href={`/admin/users/${owner.id}/view`} style={linkStyle}>Full profile →</Link>}>
          {owner ? (
            <>
              <KeyValues rows={[
                ["Name", owner.full_name],
                ["Email", owner.email],
                ["Wave number", owner.wave_number],
                ["Handle", owner.handle ? `@${owner.handle}` : "—"],
                ["Account", <StatusChip key="a" status={owner.is_active ? "ACTIVE" : "SUSPENDED"} />],
                ["KYC", <StatusChip key="k" status={owner.kyc_status} />],
                ["Member since", fmtDate(owner.created_at)],
              ]} />
              {owner.kyc_submissions.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div className="ov-eyebrow" style={{ marginBottom: 6 }}>KYC submissions</div>
                  {owner.kyc_submissions.map((k) => (
                    <div key={k.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "6px 0", fontSize: 13, flexWrap: "wrap" }}>
                      <span>{humanize(k.document_type)} · {fmtDate(k.created_at)}</span>
                      <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <StatusChip status={k.status} />
                        <Link href={`/admin/kyc-queue/${k.id}/review`} style={linkStyle}>Open</Link>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : <div className="ov-empty">No owner on record</div>}
          {organization && (
            <div style={{ marginTop: 16 }}>
              <div className="ov-eyebrow" style={{ marginBottom: 6 }}>Organization</div>
              <KeyValues rows={[
                ["Name", organization.name],
                ["Type", humanize(organization.org_type)],
                ["Verification", <StatusChip key="v" status={organization.verification_status} />],
                ["Region", organization.region],
                ["Payout number", organization.payout_wave_number],
                ["Second approval above", organization.approval_threshold ? money(organization.approval_threshold) : "—"],
              ]} />
            </div>
          )}
        </Section>
      </div>

      <Section id="donations" title="Donations" sub={ds.first_at ? `First gift ${fmtDate(ds.first_at)} · latest ${fmtDate(ds.last_at!)}` : undefined}>
        <Stats>
          <Stat label="Successful" value={ds.succeeded.toLocaleString("en-GB")} sub={`${ds.pending} pending · ${ds.failed} failed`} />
          <Stat label="Donors" value={ds.unique_donors.toLocaleString("en-GB")} sub={`${ds.anonymous_gifts} anonymous gifts`} />
          <Stat label="Average gift" value={money(ds.average)} sub={ds.largest ? `Largest ${money(ds.largest)}` : undefined} />
          <Stat label="Recurring" value={`${money(data.recurring.monthly_committed)}/mo`} sub={`${data.recurring.active_plans} active plans`} />
          {ds.by_provider.map((p) => <Stat key={p.provider} label={railLabel(p.provider)} value={money(p.gross)} sub={`${p.count} gifts`} />)}
        </Stats>
        <div style={{ marginTop: 16 }}>
          <DonationsTable rows={data.donations} />
        </div>
      </Section>

      <Section id="withdrawals" title="Withdrawals">
        <PayoutsTable rows={data.payouts} />
        {data.withdrawal_requests.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div className="ov-eyebrow" style={{ marginBottom: 6 }}>Approval requests (organization)</div>
            <DataTable
              rows={data.withdrawal_requests}
              rowKey={(r) => r.id}
              columns={[
                { key: "d", label: "Requested", render: (r) => fmtDateTime(r.created_at), width: "150px" },
                { key: "b", label: "By", render: (r) => r.requested_by ?? "—" },
                { key: "a", label: "Amount", render: (r) => money(r.amount), align: "right", width: "110px" },
                { key: "s", label: "Status", render: (r) => <StatusChip status={r.status} />, width: "110px" },
                { key: "x", label: "Decided", render: (r) => r.decided_by ? `${r.decided_by} · ${fmtDate(r.decided_at!)}` : "—" },
                { key: "n", label: "Note", render: (r) => r.note ?? "—" },
              ]}
            />
          </div>
        )}
        {data.balance_adjustments.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div className="ov-eyebrow" style={{ marginBottom: 6 }}>Balance adjustments</div>
            <DataTable
              rows={data.balance_adjustments}
              rowKey={(a) => a.id}
              columns={[
                { key: "d", label: "Date", render: (a) => fmtDateTime(a.created_at), width: "150px" },
                { key: "a", label: "Amount", render: (a) => money(a.amount), align: "right", width: "110px" },
                { key: "f", label: "Funded by", render: (a) => humanize(a.funded_by), width: "120px" },
                { key: "r", label: "Reason", render: (a) => a.reason },
                { key: "b", label: "By", render: (a) => a.created_by ?? "—", width: "140px" },
              ]}
            />
          </div>
        )}
      </Section>

      <Section id="spending" title="Updates & receipts" sub={`${money(m.spending.accounted_for)} of ${money(m.spending.withdrawn)} sent shown with receipts`}>
        <DataTable
          rows={data.updates}
          rowKey={(u) => u.id}
          empty="No updates posted"
          columns={[
            { key: "d", label: "Posted", render: (u) => fmtDate(u.created_at), width: "110px" },
            { key: "t", label: "Update", render: (u) => <span><span className="ov-strong">{u.title ?? humanize(u.category ?? "update")}</span> — {u.text.length > 140 ? `${u.text.slice(0, 140)}…` : u.text}</span> },
            { key: "s", label: "Spent", render: (u) => u.amount_spent != null ? money(u.amount_spent) : "—", align: "right", width: "110px" },
            { key: "b", label: "By", render: (u) => u.posted_by ?? "—", width: "130px" },
          ]}
        />
        {data.proofs.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div className="ov-eyebrow" style={{ marginBottom: 6 }}>Proof documents</div>
            <DataTable
              rows={data.proofs}
              rowKey={(p) => p.id}
              columns={[
                { key: "d", label: "Uploaded", render: (p) => fmtDate(p.created_at), width: "110px" },
                { key: "t", label: "Type", render: (p) => humanize(p.document_type), width: "130px" },
                { key: "x", label: "Description", render: (p) => p.description ?? "—" },
                { key: "v", label: "Visibility", render: (p) => <Chip>{humanize(p.visibility)}</Chip>, width: "110px" },
              ]}
            />
          </div>
        )}
      </Section>

      {data.goals.length > 0 && (
        <Section id="goals" title="Goals">
          <DataTable
            rows={data.goals}
            rowKey={(g) => g.id}
            columns={[
              { key: "t", label: "Goal", render: (g) => <span className="ov-strong">{g.title}</span> },
              { key: "r", label: "Raised", render: (g) => `${money(g.amount_raised)} of ${money(g.target_amount)}`, align: "right" },
              { key: "d", label: "Due", render: (g) => g.due_date ? fmtDate(g.due_date) : "—", width: "110px" },
              { key: "s", label: "Status", render: (g) => <StatusChip status={g.status} />, width: "110px" },
            ]}
          />
        </Section>
      )}

      <Section id="community" title="Reviews & reach">
        <Stats>
          <Stat label="Reviews" value={data.reviews.count} sub={data.reviews.average != null ? `${data.reviews.average.toFixed(1)} ★ average` : undefined} />
          <Stat label="Followers" value={data.engagement.followers} sub="get update emails" />
          <Stat label="Share-link clicks" value={data.engagement.share_clicks} sub={`${data.engagement.share_click_donations} led to a gift`} />
          <Stat label="Promotions applied" value={data.promotions.length} sub={data.promotions.length ? money(data.promotions.reduce((s, p) => s + (p.reversed ? 0 : p.fee_waived_amount + (p.match_contributed_amount ?? 0)), 0)) : undefined} />
        </Stats>
        {data.reviews.recent.length > 0 && (
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {data.reviews.recent.map((r) => (
              <div key={r.id} style={{ fontSize: 13 }}>
                <span className="ov-strong">{r.donor_name ?? "Anonymous"}</span> <span style={{ color: "#d9870b" }}>{"★".repeat(r.rating)}</span>
                <span className="ov-faint"> · {fmtDate(r.created_at)}</span>
                {r.comment && <div style={{ color: "#36443c" }}>{r.comment}</div>}
              </div>
            ))}
          </div>
        )}
        {data.promotions.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div className="ov-eyebrow" style={{ marginBottom: 6 }}>Promotions</div>
            <DataTable
              rows={data.promotions}
              rowKey={(p) => p.id}
              columns={[
                { key: "d", label: "Applied", render: (p) => fmtDate(p.applied_at), width: "110px" },
                { key: "n", label: "Promotion", render: (p) => <span className="ov-strong">{p.name}</span> },
                { key: "t", label: "Type", render: (p) => humanize(p.promo_type) },
                { key: "a", label: "Credit", render: (p) => money(p.fee_waived_amount + (p.match_contributed_amount ?? 0)), align: "right", width: "110px" },
                { key: "r", label: "On", render: (p) => p.donation_id ? `Donation #${p.donation_id}` : p.payout_id ? `Payout #${p.payout_id}` : "Campaign", width: "130px" },
              ]}
            />
          </div>
        )}
      </Section>

      <Section id="reports" title="Reports" sub="Fraud and moderation reports about this campaign">
        <ReportsList reports={data.reports} />
      </Section>

      <Section id="audit" title="Audit trail" sub="Admin actions on this campaign, newest first">
        <AuditTrail entries={data.audit_log} />
      </Section>
    </OverviewShell>
  );
}
