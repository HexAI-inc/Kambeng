"use client";

import Link from "next/link";
import { profileHref } from "@/lib/profile-url";

import { UserAvatar } from "@/components/ui/user-avatar";
import { useCampaignSupporters } from "@/hooks/use-frontend-data";
import type { PublicDonation } from "@/types/frontend";

const BLUE = "#14784a";

function timeAgo(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function SupporterRow({ d }: { d: PublicDonation }) {
  const name = d.donor_name?.trim() || "Anonymous";
  const anonymous = name.toLowerCase() === "anonymous";
  const nameEl = <span style={{ fontSize: 13, fontWeight: 700, color: "#15201a" }}>{name}</span>;

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 0", borderTop: "1px solid rgba(21,32,26,0.06)" }}>
      {d.donor ? (
        <Link href={profileHref(d.donor)} aria-label={`${name}'s profile`}>
          <UserAvatar name={name} src={d.donor.avatar_url} size={36} ring={1} />
        </Link>
      ) : (
        <UserAvatar name={anonymous ? "?" : name} size={36} ring={1} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          {d.donor ? <Link href={profileHref(d.donor)} style={{ textDecoration: "none" }}>{nameEl}</Link> : nameEl}
          <span style={{ fontSize: 11, color: "#6e7872" }}>{timeAgo(d.created_at)}</span>
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: BLUE, marginTop: 2 }}>
          {d.amount.toLocaleString()} GMD{d.graduating_class ? <span style={{ color: "#6e7872", fontWeight: 500 }}> · Class of {d.graduating_class}</span> : null}
        </div>
        {d.message && (
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#56625b", lineHeight: 1.55, overflowWrap: "anywhere" }}>{d.message}</p>
        )}
      </div>
    </div>
  );
}

/** Latest successful donations, with the donor's photo when they gave under their own name. */
export function RecentSupporters({ slug, header }: { slug: string; header: React.ReactNode }) {
  const { data: donations = [], isLoading } = useCampaignSupporters(slug);
  if (isLoading || donations.length === 0) return null;

  return (
    <div style={{ background: "#ffffff", border: "1px solid rgba(21,32,26,0.07)", borderRadius: 16, padding: "22px 22px 12px" }}>
      {header}
      <div>{donations.map((d) => <SupporterRow key={d.id} d={d} />)}</div>
    </div>
  );
}
