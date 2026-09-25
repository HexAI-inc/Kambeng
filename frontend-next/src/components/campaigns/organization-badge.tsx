import Link from "next/link";

import { organizationLocation, organizationTypeLabel } from "@/lib/organizations";
import type { CampaignOwner, OrganizationPublic } from "@/types/frontend";

const GREEN = "#1f9960";
const BLUE = "#14784a";

export function OrganizationBadge({ verified, size = "md" }: { verified: boolean; size?: "sm" | "md" }) {
  const small = size === "sm";
  return (
    <span
      title={verified
        ? "Kambeng checked evidence that this person may raise money for this organization"
        : "The organization hasn't been verified yet. Funds can't be withdrawn until it is."}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: small ? "2px 8px" : "3px 10px", borderRadius: 20,
        fontSize: small ? 10 : 11, fontWeight: 700, whiteSpace: "nowrap",
        color: verified ? GREEN : "#8a5a14",
        background: verified ? "#e9f5ef" : "#fbf3e4",
        border: `1px solid ${verified ? "rgba(31,153,96,0.3)" : "rgba(180,120,30,0.25)"}`,
      }}
    >
      {verified ? (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#8a5a14" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      )}
      {verified ? "Verified organization" : "Organization (not yet verified)"}
    </span>
  );
}

export function OrganizationLogo({ org, size = 44 }: { org: Pick<OrganizationPublic, "name"> & { logo_url?: string | null }; size?: number }) {
  if (org.logo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={org.logo_url}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size, borderRadius: 12, objectFit: "cover", flexShrink: 0, border: "1px solid rgba(21,32,26,0.08)", background: "#fff" }}
      />
    );
  }
  const initials = org.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: 12, flexShrink: 0,
      background: "#e6f4ec", border: "1px solid rgba(20,120,74,0.3)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: Math.round(size * 0.34), fontWeight: 800, color: BLUE,
    }}>
      {initials || "?"}
    </div>
  );
}

/** The campaign page's "who is behind this" card for organization campaigns. */
export function OrganizationCard({
  org,
  owner,
}: {
  org: Pick<OrganizationPublic, "name" | "is_verified"> & Partial<OrganizationPublic>;
  owner?: CampaignOwner | null;
}) {
  const location = organizationLocation(org);
  return (
    <div style={{
      display: "flex", gap: 14, alignItems: "flex-start",
      padding: "14px 16px", borderRadius: 14, marginBottom: 14,
      background: "#fff", border: "1px solid rgba(21,32,26,0.09)",
    }}>
      <OrganizationLogo org={org} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 11, color: "#6e7872", fontWeight: 600, marginBottom: 2 }}>Raising for</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#15201a" }}>{org.name}</span>
          <OrganizationBadge verified={org.is_verified} size="sm" />
        </div>
        <div style={{ fontSize: 12, color: "#626d66", marginTop: 3 }}>
          {organizationTypeLabel(org.org_type)}{location ? ` · ${location}` : ""}
        </div>
        {org.description && (
          <div style={{ fontSize: 13, color: "#56625b", lineHeight: 1.6, marginTop: 8 }}>{org.description}</div>
        )}
        {owner && (
          <div style={{ fontSize: 12, color: "#626d66", marginTop: 8 }}>
            Managed by{" "}
            <Link href={`/profiles/${owner.id}`} style={{ color: "#15201a", fontWeight: 700, textDecoration: "none" }}>
              {owner.full_name ?? "Kambeng organizer"}
            </Link>
            {org.representative_role ? `, ${org.representative_role}` : ""}
            {owner.kyc_verified ? " · identity verified" : ""}
          </div>
        )}
      </div>
    </div>
  );
}

/** Admin-facing chip for org verification statuses. */
export function OrgStatusChip({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string; border: string }> = {
    SUBMITTED: { color: BLUE, bg: "#e8f2ed", border: "rgba(20,120,74,0.2)" },
    REVIEWING: { color: "#b9500b", bg: "#fdf0e7", border: "rgba(232,101,15,0.25)" },
    APPROVED: { color: GREEN, bg: "#e9f5ef", border: "rgba(31,153,96,0.25)" },
    REJECTED: { color: "#d42f2f", bg: "#fdecec", border: "rgba(239,68,68,0.25)" },
    NOT_SUBMITTED: { color: "#56625b", bg: "rgba(21,32,26,0.05)", border: "rgba(21,32,26,0.1)" },
  };
  const s = map[status] ?? map.SUBMITTED;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 20, color: s.color, background: s.bg, border: `1px solid ${s.border}`, whiteSpace: "nowrap" }}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
