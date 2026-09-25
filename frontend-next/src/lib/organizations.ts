import type { OrganizationType, OrgVerificationStatus } from "@/types/frontend";

// Must match OrganizationType in backend/app/models/organization.py.
export const ORGANIZATION_TYPES: { value: OrganizationType; label: string }[] = [
  { value: "SCHOOL", label: "School" },
  { value: "FAITH", label: "Mosque / church" },
  { value: "HEALTH_CENTRE", label: "Health centre" },
  { value: "COMMUNITY_ASSOCIATION", label: "Community association" },
  { value: "NGO", label: "NGO" },
  { value: "ALUMNI_ASSOCIATION", label: "Alumni association" },
  { value: "OTHER", label: "Other organization" },
];

export function organizationTypeLabel(value?: string | null) {
  return ORGANIZATION_TYPES.find((t) => t.value === value)?.label ?? "Organization";
}

export const ORG_STATUS_COPY: Record<OrgVerificationStatus, { label: string; tone: "muted" | "pending" | "ok" | "bad" }> = {
  NOT_SUBMITTED: { label: "Not yet verified", tone: "muted" },
  SUBMITTED: { label: "Under review", tone: "pending" },
  REVIEWING: { label: "Under review", tone: "pending" },
  APPROVED: { label: "Verified", tone: "ok" },
  REJECTED: { label: "Not approved", tone: "bad" },
};

export const EVIDENCE_TYPES = [
  {
    value: "AUTHORIZATION_LETTER" as const,
    label: "Authorization letter",
    hint: "A signed, stamped letter from the head teacher, school management committee, alkalo or imam naming you as the person raising money.",
  },
  {
    value: "REGISTRATION_CERTIFICATE" as const,
    label: "Registration certificate",
    hint: "NGO Affairs Agency or business registry certificate, or a Ministry of Education school number document.",
  },
];

export function organizationLocation(org: { village?: string | null; region?: string | null }) {
  return [org.village, org.region].filter(Boolean).join(", ");
}
