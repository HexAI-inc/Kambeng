"use client";

import { Suspense, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { VerificationTabs } from "@/components/layout/verification-tabs";
import { InvitationsBanner, ManagerSummary, TeamSection } from "@/components/organizations/team-section";
import { isAxiosError } from "axios";

import { useAppFeedback } from "@/components/ui";
import { OrganizationBadge, OrganizationLogo } from "@/components/campaigns/organization-badge";
import {
  type OrganizationInput,
  useCreateOrganization,
  useMyOrganizations,
  useSessionProfile,
  useSubmitOrgVerification,
  useUpdateOrganization,
  useUploadOrganizationLogo,
} from "@/hooks/use-frontend-data";
import {
  EVIDENCE_TYPES,
  ORG_STATUS_COPY,
  ORGANIZATION_TYPES,
  organizationLocation,
  organizationTypeLabel,
} from "@/lib/organizations";
import type { OrgEvidenceType, Organization, OrganizationType, PayoutAccountHolder } from "@/types/frontend";

const BLUE = "#14784a";
const GREEN = "#1f9960";
const RED = "#b42323";
const MAX_DOC_BYTES = 10 * 1024 * 1024;
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

const card: React.CSSProperties = { background: "#fff", border: "1px solid rgba(21,32,26,0.07)", borderRadius: 14, padding: 20 };
const labelStyle: React.CSSProperties = { display: "block", marginBottom: 6, color: "#15201a", fontSize: 13, fontWeight: 600 };
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(21,32,26,0.12)",
  background: "#fff", color: "#15201a", fontSize: 14, outline: "none", boxSizing: "border-box",
};
const primaryBtn: React.CSSProperties = {
  padding: "11px 18px", borderRadius: 10, border: "none", background: BLUE, color: "#fff",
  fontSize: 14, fontWeight: 700, cursor: "pointer",
};
const ghostBtn: React.CSSProperties = {
  padding: "9px 14px", borderRadius: 10, border: "1px solid rgba(21,32,26,0.12)", background: "#fff",
  color: "#56625b", fontSize: 13, fontWeight: 600, cursor: "pointer",
};

function errorMessage(error: unknown, fallback: string) {
  if (isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg).replace(/^Value error, /, "");
  }
  return fallback;
}

function fadeUp(delay = 0) {
  return { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35, delay, ease: "easeOut" as const } };
}

// ── Profile form (create + edit) ──────────────────────────────────────────────

function ProfileForm({ initial, locked, submitLabel, busy, onSubmit, onCancel }: {
  initial?: Organization;
  locked?: boolean;
  submitLabel: string;
  busy: boolean;
  onSubmit: (values: OrganizationInput) => void;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState<OrganizationInput>({
    name: initial?.name ?? "",
    org_type: initial?.org_type ?? "SCHOOL",
    region: initial?.region ?? "",
    village: initial?.village ?? "",
    description: initial?.description ?? "",
    representative_role: initial?.representative_role ?? "",
  });
  const set = (key: keyof OrganizationInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(values); }}
      style={{ display: "grid", gap: 14 }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        <div>
          <label style={labelStyle} htmlFor="org-name">Organization name</label>
          <input id="org-name" required minLength={2} maxLength={120} value={values.name} onChange={set("name")} disabled={locked}
            placeholder="E.g. Sukuta Lower Basic School" style={{ ...inputStyle, opacity: locked ? 0.6 : 1 }} />
        </div>
        <div>
          <label style={labelStyle} htmlFor="org-type">Type</label>
          <select id="org-type" value={values.org_type} disabled={locked}
            onChange={(e) => setValues((v) => ({ ...v, org_type: e.target.value as OrganizationType }))}
            style={{ ...inputStyle, opacity: locked ? 0.6 : 1 }}>
            {ORGANIZATION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle} htmlFor="org-village">Village / town</label>
          <input id="org-village" maxLength={80} value={values.village ?? ""} onChange={set("village")} placeholder="Sukuta" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle} htmlFor="org-region">Region</label>
          <input id="org-region" maxLength={80} value={values.region ?? ""} onChange={set("region")} placeholder="West Coast" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle} htmlFor="org-role">Your role</label>
          <input id="org-role" maxLength={60} value={values.representative_role ?? ""} onChange={set("representative_role")}
            placeholder="Bursar, PTA chair, Alumni president…" style={inputStyle} />
        </div>
      </div>
      {locked && (
        <div style={{ fontSize: 12, color: "#626d66" }}>
          The name and type are locked while the organization is verified or under review. Contact support if they are wrong.
        </div>
      )}
      <div>
        <label style={labelStyle} htmlFor="org-description">About the organization <span style={{ color: "#6e7872", fontWeight: 500 }}>(shown to donors)</span></label>
        <textarea id="org-description" rows={3} maxLength={1000} value={values.description ?? ""} onChange={set("description")}
          placeholder="Founded in 1972, 640 pupils from Sukuta and nearby villages…" style={{ ...inputStyle, resize: "vertical" }} />
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="submit" disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.7 : 1 }}>{busy ? "Saving…" : submitLabel}</button>
        {onCancel && <button type="button" onClick={onCancel} style={ghostBtn}>Cancel</button>}
      </div>
    </form>
  );
}

// ── Verification form ─────────────────────────────────────────────────────────

function VerificationForm({ org, ownWaveNumber, onDone, onCancel }: {
  org: Organization;
  ownWaveNumber?: string;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const submit = useSubmitOrgVerification();
  const { message } = useAppFeedback();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [evidenceType, setEvidenceType] = useState<OrgEvidenceType>("AUTHORIZATION_LETTER");
  const [holder, setHolder] = useState<PayoutAccountHolder>("ORGANIZATION");
  const [orgNumber, setOrgNumber] = useState("");
  const [issuer, setIssuer] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const personalAllowed = evidenceType === "AUTHORIZATION_LETTER";
  const effectiveHolder: PayoutAccountHolder = personalAllowed ? holder : "ORGANIZATION";
  const payoutNumber = effectiveHolder === "REPRESENTATIVE" ? (ownWaveNumber ?? "") : orgNumber;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!file) { setError("Attach the letter or certificate."); return; }
    if (file.size > MAX_DOC_BYTES) { setError("File is too large. Maximum size is 10MB."); return; }
    if (!payoutNumber.trim()) { setError("Enter the Wave number payouts should go to."); return; }

    const fd = new FormData();
    fd.append("evidence_type", evidenceType);
    fd.append("payout_account_holder", effectiveHolder);
    fd.append("payout_wave_number", payoutNumber);
    if (issuer.trim()) fd.append("issuer", issuer.trim());
    fd.append("file", file);
    try {
      await submit.mutateAsync({ id: org.id, formData: fd });
      message.success("Submitted. We'll email you once it's reviewed.");
      onDone();
    } catch (err) {
      setError(errorMessage(err, "We couldn't submit the evidence. Please try again."));
    }
  };

  const radio = (active: boolean): React.CSSProperties => ({
    textAlign: "left", padding: "10px 12px", borderRadius: 10, cursor: "pointer",
    border: `1.5px solid ${active ? BLUE : "rgba(21,32,26,0.1)"}`, background: active ? "#eef6f1" : "#fff",
  });

  return (
    <form onSubmit={(e) => void handleSubmit(e)} style={{ display: "grid", gap: 16 }}>
      <div>
        <div style={labelStyle}>1. Evidence that you may raise money for {org.name}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
          {EVIDENCE_TYPES.map((t) => (
            <button key={t.value} type="button" aria-pressed={evidenceType === t.value} onClick={() => setEvidenceType(t.value)} style={radio(evidenceType === t.value)}>
              <div style={{ fontSize: 13, fontWeight: 700, color: evidenceType === t.value ? BLUE : "#15201a" }}>{t.label}</div>
              <div style={{ fontSize: 11, color: "#626d66", marginTop: 3, lineHeight: 1.5 }}>{t.hint}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        <div>
          <label style={labelStyle} htmlFor={`issuer-${org.id}`}>
            {evidenceType === "AUTHORIZATION_LETTER" ? "Who signed the letter?" : "Issuing body and number"}
          </label>
          <input id={`issuer-${org.id}`} maxLength={200} value={issuer} onChange={(e) => setIssuer(e.target.value)} style={inputStyle}
            placeholder={evidenceType === "AUTHORIZATION_LETTER" ? "Head teacher, Sukuta LBS" : "NGO Affairs Agency, reg. no. 1234"} />
        </div>
        <div>
          <div style={labelStyle}>Document</div>
          <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: "none" }}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <button type="button" onClick={() => fileRef.current?.click()} style={{
            ...inputStyle, textAlign: "left", cursor: "pointer",
            border: `1.5px dashed ${file ? GREEN : "rgba(21,32,26,0.18)"}`, color: file ? "#15201a" : "#6e7872",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {file ? `✓ ${file.name}` : "Choose PDF, PNG or JPG (max 10MB)"}
          </button>
        </div>
      </div>

      <div>
        <div style={labelStyle}>2. Where should withdrawals go?</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
          <button type="button" aria-pressed={effectiveHolder === "ORGANIZATION"} onClick={() => setHolder("ORGANIZATION")} style={radio(effectiveHolder === "ORGANIZATION")}>
            <div style={{ fontSize: 13, fontWeight: 700, color: effectiveHolder === "ORGANIZATION" ? BLUE : "#15201a" }}>The organization&apos;s Wave number</div>
            <div style={{ fontSize: 11, color: "#626d66", marginTop: 3, lineHeight: 1.5 }}>A Wave account that belongs to the organization.</div>
          </button>
          <button type="button" aria-pressed={effectiveHolder === "REPRESENTATIVE"} disabled={!personalAllowed}
            onClick={() => setHolder("REPRESENTATIVE")}
            style={{ ...radio(effectiveHolder === "REPRESENTATIVE"), opacity: personalAllowed ? 1 : 0.5, cursor: personalAllowed ? "pointer" : "not-allowed" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: effectiveHolder === "REPRESENTATIVE" ? BLUE : "#15201a" }}>My own Wave number</div>
            <div style={{ fontSize: 11, color: "#626d66", marginTop: 3, lineHeight: 1.5 }}>
              {personalAllowed ? "Only if the letter names this number." : "Needs an authorization letter that names your number."}
            </div>
          </button>
        </div>
        <div style={{ marginTop: 10 }}>
          <label style={labelStyle} htmlFor={`payout-${org.id}`}>Wave number</label>
          {effectiveHolder === "REPRESENTATIVE" ? (
            <input id={`payout-${org.id}`} value={ownWaveNumber ?? ""} readOnly style={{ ...inputStyle, background: "#f6f4ef" }} />
          ) : (
            <input id={`payout-${org.id}`} inputMode="tel" value={orgNumber} onChange={(e) => setOrgNumber(e.target.value)}
              placeholder="+220 7xx xxxx" style={inputStyle} />
          )}
          <div style={{ fontSize: 12, color: "#626d66", marginTop: 6, lineHeight: 1.5 }}>
            By submitting, you declare this number {effectiveHolder === "REPRESENTATIVE" ? "is authorized by the letter" : `belongs to ${org.name}`}. All withdrawals for its campaigns go here.
          </div>
        </div>
      </div>

      {error && <div style={{ padding: "10px 12px", borderRadius: 10, background: "#fef0f0", border: "1px solid rgba(239,68,68,0.22)", color: RED, fontSize: 13 }}>{error}</div>}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="submit" disabled={submit.isPending} style={{ ...primaryBtn, opacity: submit.isPending ? 0.7 : 1 }}>
          {submit.isPending ? "Submitting…" : "Submit for verification"}
        </button>
        {onCancel && <button type="button" onClick={onCancel} style={ghostBtn}>Cancel</button>}
      </div>
    </form>
  );
}

// ── One organization ──────────────────────────────────────────────────────────

function StatusChip({ org }: { org: Organization }) {
  const copy = ORG_STATUS_COPY[org.verification_status];
  const tones = {
    muted: { color: "#56625b", bg: "rgba(21,32,26,0.05)", border: "rgba(21,32,26,0.1)" },
    pending: { color: BLUE, bg: "#e8f2ed", border: "rgba(20,120,74,0.2)" },
    ok: { color: GREEN, bg: "#e9f5ef", border: "rgba(31,153,96,0.25)" },
    bad: { color: RED, bg: "#fdecec", border: "rgba(239,68,68,0.25)" },
  }[copy.tone];
  return (
    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 20, color: tones.color, background: tones.bg, border: `1px solid ${tones.border}` }}>
      {copy.label}
    </span>
  );
}

function OrganizationPanel({ org, ownWaveNumber, myUserId }: { org: Organization; ownWaveNumber?: string; myUserId?: number }) {
  const isOwner = org.my_role === "OWNER";
  const update = useUpdateOrganization();
  const uploadLogo = useUploadOrganizationLogo();
  const { message } = useAppFeedback();
  const logoRef = useRef<HTMLInputElement | null>(null);
  const [editing, setEditing] = useState(false);
  const [changingPayout, setChangingPayout] = useState(false);

  const status = org.verification_status;
  const pending = status === "SUBMITTED" || status === "REVIEWING";
  const locked = pending || status === "APPROVED";
  const showVerificationForm = status === "NOT_SUBMITTED" || status === "REJECTED" || (status === "APPROVED" && changingPayout);
  const location = organizationLocation(org);

  const onLogo = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) { message.error("Logo is too large. Maximum size is 5MB."); return; }
    try {
      await uploadLogo.mutateAsync({ id: org.id, file });
      message.success("Logo updated");
    } catch (err) {
      message.error(errorMessage(err, "Couldn't upload the logo"));
    }
  };

  return (
    <div style={{ ...card, display: "grid", gap: 18 }}>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
        <button type="button" onClick={() => logoRef.current?.click()} title={isOwner ? "Change logo" : undefined} disabled={!isOwner}
          style={{ padding: 0, border: "none", background: "none", cursor: isOwner ? "pointer" : "default", position: "relative" }}>
          <OrganizationLogo org={org} size={56} />
          {isOwner && <span style={{ position: "absolute", right: -4, bottom: -4, fontSize: 10, background: "#fff", border: "1px solid rgba(21,32,26,0.12)", borderRadius: 8, padding: "1px 5px", color: "#56625b" }}>
            {uploadLogo.isPending ? "…" : "Edit"}
          </span>}
        </button>
        <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }}
          onChange={(e) => void onLogo(e.target.files?.[0])} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 17, fontWeight: 800, color: "#15201a" }}>{org.name}</span>
            <StatusChip org={org} />
          </div>
          <div style={{ fontSize: 12, color: "#626d66", marginTop: 3 }}>
            {organizationTypeLabel(org.org_type)}{location ? ` · ${location}` : ""}
            {isOwner && org.representative_role ? ` · You: ${org.representative_role}` : ""}
          </div>
          <div style={{ marginTop: 8 }}>
            <span style={{ fontSize: 11, color: "#6e7872", marginRight: 6 }}>Donors see:</span>
            <OrganizationBadge verified={org.is_verified} size="sm" />
          </div>
        </div>
        {isOwner && !editing && <button type="button" onClick={() => setEditing(true)} style={ghostBtn}>Edit profile</button>}
        {!isOwner && <span style={{ fontSize: 11, fontWeight: 700, color: BLUE, background: "#eef6f1", padding: "4px 10px", borderRadius: 20 }}>Team member</span>}
      </div>

      {editing && (
        <ProfileForm
          initial={org}
          locked={locked}
          submitLabel="Save changes"
          busy={update.isPending}
          onCancel={() => setEditing(false)}
          onSubmit={async (values) => {
            try {
              const payload = locked ? { ...values, name: undefined, org_type: undefined } : values;
              await update.mutateAsync({ id: org.id, ...payload });
              message.success("Saved");
              setEditing(false);
            } catch (err) {
              message.error(errorMessage(err, "Couldn't save the changes"));
            }
          }}
        />
      )}

      {!isOwner && <ManagerSummary org={org} myUserId={myUserId} />}

      {isOwner && <div style={{ borderTop: "1px solid rgba(21,32,26,0.06)", paddingTop: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#6e7872", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
          Verification
        </div>

        {status === "REJECTED" && org.rejection_reason && (
          <div style={{ padding: "10px 12px", borderRadius: 10, background: "#fef4f4", border: "1px solid rgba(239,68,68,0.15)", color: RED, fontSize: 13, marginBottom: 14, lineHeight: 1.6 }}>
            <strong>Not approved:</strong> {org.rejection_reason}. Fix it and resubmit below.
          </div>
        )}

        {status === "NOT_SUBMITTED" && (
          <div style={{ fontSize: 13, color: "#56625b", lineHeight: 1.6, marginBottom: 14 }}>
            Campaigns for {org.name} can take donations now, but withdrawals stay locked until we verify you may raise money for it.
            Village schools and community groups without a registration can send a signed, stamped letter instead.
          </div>
        )}

        {pending && org.latest_verification && (
          <div style={{ fontSize: 13, color: "#56625b", lineHeight: 1.7 }}>
            We&apos;re reviewing your {org.latest_verification.evidence_type === "AUTHORIZATION_LETTER" ? "authorization letter" : "registration certificate"}
            {" "}(submitted {new Date(org.latest_verification.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}).
            Payouts will go to <strong>{org.latest_verification.payout_wave_number}</strong> once approved. This usually takes 1–2 business days.
          </div>
        )}

        {status === "APPROVED" && !changingPayout && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 13, color: "#56625b", lineHeight: 1.6 }}>
              Verified{org.verified_at ? ` on ${new Date(org.verified_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}.
              {" "}Withdrawals go to <strong>{org.payout_wave_number}</strong>
              {org.payout_account_holder === "REPRESENTATIVE" ? " (your number, named in the letter)" : ` (${org.name}'s account)`}.
            </div>
            <button type="button" onClick={() => setChangingPayout(true)} style={ghostBtn}>Change payout number</button>
          </div>
        )}

        {status === "APPROVED" && changingPayout && (
          <div style={{ padding: "10px 12px", borderRadius: 10, background: "#fbf3e4", border: "1px solid rgba(180,120,30,0.25)", color: "#8a5a14", fontSize: 13, marginBottom: 14, lineHeight: 1.6 }}>
            Changing the payout number needs fresh evidence. Withdrawals pause until we approve it.
          </div>
        )}

        {showVerificationForm && (
          <VerificationForm
            org={org}
            ownWaveNumber={ownWaveNumber}
            onDone={() => setChangingPayout(false)}
            onCancel={status === "APPROVED" ? () => setChangingPayout(false) : undefined}
          />
        )}
      </div>}

      {isOwner && <TeamSection org={org} />}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function OrganizationsContent() {
  const searchParams = useSearchParams();
  const { data: session } = useSessionProfile(true);
  const { data: organizations, isLoading } = useMyOrganizations(true);
  const create = useCreateOrganization();
  const { message } = useAppFeedback();
  const [creating, setCreating] = useState(searchParams.get("new") === "1");

  const orgs = organizations ?? [];
  const showCreate = creating || (!isLoading && orgs.length === 0);
  const kycApproved = session?.kyc_status === "APPROVED";

  return (
    <div style={{ minHeight: "100vh", padding: "28px clamp(16px, 4vw, 48px)" }}>
      <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
        <VerificationTabs />

        <motion.div {...fadeUp(0)} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#15201a", letterSpacing: "-0.03em", marginBottom: 4 }}>Organizations</div>
            <div style={{ fontSize: 13, color: "#626d66", maxWidth: 560, lineHeight: 1.6 }}>
              Raising for a school, mosque, clinic or association? Add it here so donors can see the organization is behind the campaign.
            </div>
          </div>
          {!showCreate && orgs.length > 0 && (
            <button type="button" onClick={() => setCreating(true)} style={primaryBtn}>+ Add organization</button>
          )}
        </motion.div>

        <InvitationsBanner />

        {session && !kycApproved && (
          <motion.div {...fadeUp(0.04)} style={{ padding: "12px 16px", borderRadius: 12, background: "#eff6f2", border: "1px solid rgba(20,120,74,0.2)", fontSize: 13, color: "#56625b", lineHeight: 1.6 }}>
            Withdrawals need two checks: the organization&apos;s verification here, and your own identity check.{" "}
            <Link href="/dashboard/kyc" style={{ color: BLUE, fontWeight: 700 }}>Complete your KYC</Link>
          </motion.div>
        )}

        {showCreate && (
          <motion.div {...fadeUp(0.06)} style={card}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#15201a", marginBottom: 14 }}>Add an organization</div>
            <ProfileForm
              submitLabel="Add organization"
              busy={create.isPending}
              onCancel={orgs.length > 0 ? () => setCreating(false) : undefined}
              onSubmit={async (values) => {
                try {
                  await create.mutateAsync(values);
                  message.success(`${values.name} added. Next, verify it to unlock withdrawals.`);
                  setCreating(false);
                } catch (err) {
                  message.error(errorMessage(err, "Couldn't add the organization"));
                }
              }}
            />
          </motion.div>
        )}

        {isLoading ? (
          <div style={{ height: 160, borderRadius: 14, background: "rgba(21,32,26,0.05)" }} />
        ) : (
          orgs.map((org, i) => (
            <motion.div key={org.id} {...fadeUp(0.08 + i * 0.04)}>
              <OrganizationPanel org={org} ownWaveNumber={session?.wave_number} myUserId={session?.id} />
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

export default function OrganizationsPage() {
  return (
    <Suspense fallback={null}>
      <OrganizationsContent />
    </Suspense>
  );
}
