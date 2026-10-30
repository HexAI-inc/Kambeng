"use client";

import Link from "next/link";
import { fmtDate, humanize, railLabel } from "@/lib/fmt";
import { Chip, DataTable, StatusChip, fmtDateTime, linkStyle, money } from "@/components/admin/overview-ui";
import type { OverviewDonation, OverviewPayout, OverviewReports } from "@/types/frontend";

/** Donation, withdrawal and report lists shared by the admin campaign and user overviews. */

export function DonationsTable({ rows, showCampaign }: { rows: OverviewDonation[]; showCampaign?: boolean }) {
  return (
    <DataTable
      rows={rows}
      rowKey={(d) => d.id}
      empty="No donations yet"
      columns={[
        { key: "d", label: "Date", render: (d) => fmtDateTime(d.created_at), width: "150px" },
        ...(showCampaign ? [{ key: "c", label: "Campaign", render: (d: OverviewDonation) => <Link href={`/admin/campaigns/${d.campaign_id}/view`} style={linkStyle}>{d.campaign_title ?? `#${d.campaign_id}`}</Link> }] : []),
        { key: "w", label: "Donor", render: (d) => (
          <span>
            {d.user_id ? <Link href={`/admin/users/${d.user_id}/view`} style={linkStyle}>{d.donor_name || "Account"}</Link> : <span className="ov-strong">{d.donor_name || "Anonymous"}</span>}
            {d.donor_email && <div className="ov-faint">{d.donor_email}</div>}
            {d.message && <div className="ov-faint">“{d.message}”</div>}
          </span>
        ) },
        { key: "r", label: "Rail", render: (d) => railLabel(d.provider), width: "110px" },
        { key: "a", label: "Amount", render: (d) => money(d.amount), align: "right", width: "100px" },
        { key: "n", label: "Net", render: (d) => d.status === "SUCCEEDED" ? money(d.net) : "—", align: "right", width: "90px" },
        { key: "s", label: "Status", render: (d) => <span title={d.reconciliation_reason ?? undefined}><StatusChip status={d.status} />{d.reconciliation_source && <div className="ov-faint">{humanize(d.reconciliation_source)}</div>}</span>, width: "110px" },
        { key: "f", label: "Reference", render: (d) => <span className="ov-mono">{d.client_reference}</span>, width: "140px" },
      ]}
    />
  );
}

export function PayoutsTable({ rows, showCampaign }: { rows: OverviewPayout[]; showCampaign?: boolean }) {
  return (
    <DataTable
      rows={rows}
      rowKey={(p) => p.id}
      empty="No withdrawals yet"
      columns={[
        { key: "d", label: "Date", render: (p) => fmtDateTime(p.created_at), width: "150px" },
        ...(showCampaign ? [{ key: "c", label: "Campaign", render: (p: OverviewPayout) => p.campaign_id ? <Link href={`/admin/campaigns/${p.campaign_id}/view`} style={linkStyle}>{p.campaign_title ?? `#${p.campaign_id}`}</Link> : "—" }] : []),
        { key: "g", label: "Withdrawn", render: (p) => money(p.debit), align: "right", width: "110px" },
        { key: "f", label: "Fees", render: (p) => money((p.hexai_fee ?? 0) + (p.platform_commission ?? 0)), align: "right", width: "80px" },
        { key: "n", label: "Sent", render: (p) => money(p.net_amount), align: "right", width: "100px" },
        { key: "t", label: "To", render: (p) => <span><span className="ov-mono">{p.recipient_wave_number ?? "—"}</span>{p.requested_by && <div className="ov-faint">by {p.requested_by}{p.approved_by ? `, approved by ${p.approved_by}` : ""}</div>}</span> },
        { key: "s", label: "Status", render: (p) => <span><StatusChip status={p.status} />{!p.has_gateway_id && <div className="ov-faint" title="No HexAI transaction id on file">no gateway id</div>}</span>, width: "120px" },
        { key: "r", label: "Reference", render: (p) => <span className="ov-mono">{p.client_reference}</span>, width: "160px" },
      ]}
    />
  );
}

export function ReportsList({ reports }: { reports: OverviewReports }) {
  if (reports.fraud.length + reports.moderation.length === 0) return <div className="ov-empty">No reports</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {reports.fraud.map((r) => (
        <div key={`f${r.id}`} style={{ fontSize: 13 }}>
          <Chip tone="red">Fraud</Chip> <span className="ov-strong">{r.reason}</span> <StatusChip status={r.status} />
          <span className="ov-faint"> · {fmtDate(r.created_at)}</span>
          {r.details && <div style={{ color: "#36443c", marginTop: 3 }}>{r.details}</div>}
        </div>
      ))}
      {reports.moderation.map((r) => (
        <div key={`m${r.id}`} style={{ fontSize: 13 }}>
          <Chip tone="amber">{humanize(r.entity_type)}</Chip> <span className="ov-strong">{humanize(r.reason)}</span> <StatusChip status={r.status} />
          {r.created_at && <span className="ov-faint"> · {fmtDate(r.created_at)}</span>}
          <div style={{ color: "#36443c", marginTop: 3 }}>{r.description}</div>
          {(r.action_taken || r.moderation_note) && <div className="ov-faint">Outcome: {[r.action_taken && humanize(r.action_taken), r.moderation_note].filter(Boolean).join(" — ")}</div>}
        </div>
      ))}
    </div>
  );
}
