"use client";

import Link from "next/link";

import { OrganizationBadge, OrganizationLogo } from "@/components/campaigns/organization-badge";
import { organizationTypeLabel } from "@/lib/organizations";
import type { BeneficiaryType, Organization } from "@/types/frontend";

const BLUE = "#14784a";

const OPTIONS: { value: BeneficiaryType; label: string; hint: string }[] = [
  { value: "self", label: "Myself", hint: "Money for you or your family" },
  { value: "someone_else", label: "Someone else", hint: "A friend, neighbour or relative" },
  { value: "organization", label: "An organization", hint: "A school, mosque, clinic, association…" },
];

type Props = {
  value: BeneficiaryType;
  onChange: (value: BeneficiaryType) => void;
  organizationId?: number;
  onOrganizationChange: (id: number | undefined) => void;
  organizations: Organization[];
  error?: string;
  showWithdrawalNote?: boolean;
};

export function BeneficiaryFields({
  value, onChange, organizationId, onOrganizationChange, organizations, error, showWithdrawalNote = true,
}: Props) {
  const selectedOrg = organizations.find((o) => o.id === organizationId);

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ marginBottom: 6, color: "#15201a", fontSize: 13, fontWeight: 600 }}>Who are you raising money for?</div>
      <div role="radiogroup" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
        {OPTIONS.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                onChange(option.value);
                if (option.value !== "organization") onOrganizationChange(undefined);
                else if (!organizationId && organizations.length === 1) onOrganizationChange(organizations[0].id);
              }}
              style={{
                textAlign: "left", padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                border: `1.5px solid ${active ? BLUE : "rgba(21,32,26,0.1)"}`,
                background: active ? "#eef6f1" : "#fff",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: active ? BLUE : "#15201a" }}>{option.label}</div>
              <div style={{ fontSize: 11, color: "#626d66", marginTop: 2, lineHeight: 1.4 }}>{option.hint}</div>
            </button>
          );
        })}
      </div>

      {value === "organization" && (
        <div style={{ marginTop: 10, padding: 12, borderRadius: 12, background: "#faf9f6", border: "1px solid rgba(21,32,26,0.07)" }}>
          {organizations.length === 0 ? (
            <div style={{ fontSize: 13, color: "#56625b", lineHeight: 1.6 }}>
              Add the organization first, so donors can see who is behind the campaign.{" "}
              <Link href="/dashboard/organizations?new=1" style={{ color: BLUE, fontWeight: 700 }}>Add an organization</Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {organizations.map((org) => {
                const active = org.id === organizationId;
                return (
                  <button
                    key={org.id}
                    type="button"
                    onClick={() => onOrganizationChange(org.id)}
                    aria-pressed={active}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, textAlign: "left",
                      padding: "8px 10px", borderRadius: 10, cursor: "pointer",
                      border: `1.5px solid ${active ? BLUE : "rgba(21,32,26,0.08)"}`,
                      background: active ? "#eef6f1" : "#fff",
                    }}
                  >
                    <OrganizationLogo org={org} size={32} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#15201a" }}>{org.name}</div>
                      <div style={{ fontSize: 11, color: "#626d66" }}>{organizationTypeLabel(org.org_type)}</div>
                    </div>
                    <OrganizationBadge verified={org.is_verified} size="sm" />
                  </button>
                );
              })}
              <Link href="/dashboard/organizations?new=1" style={{ fontSize: 12, color: BLUE, fontWeight: 600, marginTop: 2 }}>
                + Add another organization
              </Link>
            </div>
          )}

          {showWithdrawalNote && selectedOrg && !selectedOrg.is_verified && (
            <div style={{ marginTop: 10, fontSize: 12, color: "#8a5a14", lineHeight: 1.6 }}>
              You can launch now and take donations. Withdrawals open once {selectedOrg.name} is verified.{" "}
              <Link href="/dashboard/organizations" style={{ color: BLUE, fontWeight: 600 }}>Verify it</Link>
            </div>
          )}
        </div>
      )}

      {error && <div style={{ marginTop: 6, color: "#b42323", fontSize: 12 }}>{error}</div>}
    </div>
  );
}
