"use client";

import { useState } from "react";
import { useCampaignPublicStats } from "@/hooks/use-frontend-data";
import { fmtDate, timeAgo } from "@/lib/fmt";

const INK = "#15201a";
const MUTED = "#626d66";

function plural(n: number, word: string) {
  return `${n.toLocaleString("en-GB")} ${word}${n === 1 ? "" : "s"}`;
}

/** One line under the progress bar: donors, start date, last gift. */
export function CampaignFactsLine({ slug, createdAt }: { slug: string; createdAt: string }) {
  const { data } = useCampaignPublicStats(slug);
  const parts = [
    data && data.donors_count > 0 ? plural(data.donors_count, "donor") : null,
    `Started ${fmtDate(createdAt)}`,
    data?.last_donation_at ? `last gift ${timeAgo(data.last_donation_at)}` : null,
  ].filter(Boolean);
  return <div style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>{parts.join(" · ")}</div>;
}

/** "About this campaign": the public record of when it started and how active it is. */
export function CampaignFactsCard({ slug, createdAt }: { slug: string; createdAt: string }) {
  const { data } = useCampaignPublicStats(slug);
  // Read the clock once per mount so renders stay pure.
  const [now] = useState(() => Date.now());
  const days = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 86_400_000));
  const rows: [string, string][] = [
    ["Started", `${fmtDate(createdAt)} · ${days === 0 ? "today" : `${plural(days, "day")} ago`}`],
  ];
  if (data) {
    rows.push(["Donations", data.donations_count ? `${plural(data.donations_count, "gift")} from ${plural(data.donors_count, "donor")}` : "No gifts yet — be the first"]);
    if (data.first_donation_at) rows.push(["First gift", fmtDate(data.first_donation_at)]);
    if (data.last_donation_at) rows.push(["Latest gift", timeAgo(data.last_donation_at)]);
    if (data.largest_donation) rows.push(["Largest gift", `${Math.round(data.largest_donation).toLocaleString("en-GB")} GMD`]);
    rows.push(["Updates posted", data.receipts_count ? `${data.updates_count} (${data.receipts_count} with receipts)` : String(data.updates_count)]);
    if (data.followers_count) rows.push(["Following", plural(data.followers_count, "person").replace("persons", "people")]);
    if (data.organizer_since) {
      rows.push(["Organizer", `On Kambeng since ${fmtDate(data.organizer_since)}${data.organizer_campaigns > 1 ? ` · ${data.organizer_campaigns} campaigns` : ""}`]);
    }
  }

  return (
    <div style={{ background: "#fff", border: "1px solid rgba(21,32,26,0.07)", borderRadius: 16, padding: "18px 20px" }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: INK, marginBottom: 6 }}>About this campaign</div>
      <dl style={{ margin: 0 }}>
        {rows.map(([label, value]) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid rgba(21,32,26,0.05)", fontSize: 13 }}>
            <dt style={{ color: MUTED }}>{label}</dt>
            <dd style={{ margin: 0, color: INK, fontWeight: 600, textAlign: "right" }}>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
