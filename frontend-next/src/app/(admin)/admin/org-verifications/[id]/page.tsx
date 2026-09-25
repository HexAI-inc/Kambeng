"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";

import { useAdminOrgVerificationDetail, useDecideOrgVerification } from "@/hooks/use-frontend-data";
import { OrganizationLogo, OrgStatusChip } from "@/components/campaigns/organization-badge";
import { organizationLocation, organizationTypeLabel } from "@/lib/organizations";

const BLUE = "#14784a";
const GREEN = "#1f9960";
const RED = "#d42f2f";

function fade(delay = 0) {
  return { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.32, delay, ease: "easeOut" as const } };
}

const panel: React.CSSProperties = { background: "#fff", border: "1px solid rgba(21,32,26,0.07)", borderRadius: 14, padding: 20 };
const sectionLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#6e7872", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#6e7872", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: "#15201a", wordBreak: "break-word" }}>{children}</div>
    </div>
  );
}

/** Evidence documents are private in storage — fetch a short-lived URL. */
function usePresignedUrl(url?: string) {
  const [signed, setSigned] = useState<string | null>(null);
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    fetch(`/api/backend/media/presign?${new URLSearchParams({ url })}`)
      .then((res) => (res.ok ? res.json() : { url }))
      .then((body) => { if (!cancelled) setSigned(body.url ?? url); })
      .catch(() => { if (!cancelled) setSigned(url); });
    return () => { cancelled = true; };
  }, [url]);
  return signed;
}

export default function OrgVerificationReviewPage() {
  const params = useParams();
  const router = useRouter();
  const submissionId = Number(Array.isArray(params?.id) ? params.id[0] : params?.id);
  const { data: submission, isLoading, error } = useAdminOrgVerificationDetail(submissionId);
  const decide = useDecideOrgVerification();
  const docUrl = usePresignedUrl(submission?.document_file_url);

  const [mode, setMode] = useState<"idle" | "approve" | "reject">("idle");
  const [reason, setReason] = useState("");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const onDecide = async (approve: boolean) => {
    try {
      await decide.mutateAsync({ submissionId, approve, reason: approve ? undefined : reason.trim() });
      showToast(approve ? "Organization verified — the representative has been emailed" : "Submission rejected — the representative has been emailed", true);
      setMode("idle");
    } catch {
      showToast(approve ? "Failed to approve" : "Failed to reject", false);
    }
  };

  if (isLoading) {
    return <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#6e7872", fontSize: 13 }}>Loading…</div>;
  }
  if (error || !submission) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#15201a" }}>Submission not found</div>
        <button onClick={() => router.push("/admin/org-verifications")} style={{ padding: "9px 20px", borderRadius: 9, border: "none", background: BLUE, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Back to queue</button>
      </div>
    );
  }

  const org = submission.organization;
  const canDecide = submission.status === "SUBMITTED" || submission.status === "REVIEWING";
  const kycApproved = submission.submitter_kyc_status === "APPROVED";
  const isPdf = submission.document_file_url.split("?")[0].toLowerCase().endsWith(".pdf");
  const personalPayout = submission.payout_account_holder === "REPRESENTATIVE";

  return (
    <div style={{ minHeight: "100vh", padding: "28px clamp(16px,4vw,48px)" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
        {toast && (
          <div style={{ position: "fixed", top: 24, right: 24, zIndex: 999, padding: "12px 20px", borderRadius: 10, background: toast.ok ? "#e9f5ef" : "#fdecec", border: `1px solid ${toast.ok ? "rgba(31,153,96,0.3)" : "rgba(239,68,68,0.3)"}`, color: toast.ok ? GREEN : RED, fontSize: 13, fontWeight: 600, boxShadow: "0 8px 32px rgba(21,32,26,0.12)" }}>{toast.msg}</div>
        )}

        <motion.div {...fade(0)} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button onClick={() => router.push("/admin/org-verifications")} aria-label="Back to queue" style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid rgba(21,32,26,0.1)", background: "#fff", color: "#56625b", cursor: "pointer", fontSize: 16 }}>←</button>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#15201a", letterSpacing: "-0.03em" }}>{org.name}</div>
          <OrgStatusChip status={submission.status} />
        </motion.div>

        <div className="org-review-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(300px, 360px)", gap: 20, alignItems: "start" }}>
          {/* Evidence document */}
          <motion.div {...fade(0.05)} style={{ ...panel, padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(21,32,26,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#15201a" }}>
                {submission.evidence_type === "AUTHORIZATION_LETTER" ? "Authorization letter" : "Registration certificate"}
              </div>
              {docUrl && <a href={docUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: BLUE, fontWeight: 600 }}>Open in new tab ↗</a>}
            </div>
            {!docUrl ? (
              <div style={{ height: 400, background: "#f1eee7" }} />
            ) : isPdf ? (
              <iframe src={docUrl} title="Evidence document" style={{ width: "100%", height: "70vh", border: "none", display: "block", background: "#f1eee7" }} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={docUrl} alt="Evidence document" style={{ width: "100%", maxHeight: "70vh", objectFit: "contain", display: "block", background: "#f1eee7" }} />
            )}
          </motion.div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Checklist */}
            <motion.div {...fade(0.08)} style={panel}>
              <div style={sectionLabel}>Check that the document</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#56625b", lineHeight: 1.8 }}>
                <li>names <strong>{org.name}</strong></li>
                <li>names <strong>{submission.submitter_name ?? "the representative"}</strong> as allowed to raise money</li>
                {submission.evidence_type === "AUTHORIZATION_LETTER" && <li>is signed and stamped{submission.issuer ? ` by ${submission.issuer}` : ""}</li>}
                {personalPayout && <li>names the payout number <strong>{submission.payout_wave_number}</strong></li>}
              </ul>
            </motion.div>

            {/* Organization */}
            <motion.div {...fade(0.1)} style={panel}>
              <div style={sectionLabel}>Organization</div>
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
                <OrganizationLogo org={org} size={40} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#15201a" }}>{org.name}</div>
                  <div style={{ fontSize: 12, color: "#6e7872" }}>{organizationTypeLabel(org.org_type)}</div>
                </div>
              </div>
              <div style={{ display: "grid", gap: 12 }}>
                <Field label="Location">{organizationLocation(org) || "—"}</Field>
                <Field label="Issuer">{submission.issuer ?? "—"}</Field>
                <Field label="Campaigns">{submission.campaign_count}</Field>
                {org.description && <Field label="About">{org.description}</Field>}
              </div>
            </motion.div>

            {/* Representative */}
            <motion.div {...fade(0.12)} style={panel}>
              <div style={sectionLabel}>Representative</div>
              <div style={{ display: "grid", gap: 12 }}>
                <Field label="Name">{submission.submitter_name ?? `User #${submission.submitted_by_user_id}`}{org.representative_role ? ` · ${org.representative_role}` : ""}</Field>
                <Field label="Email">{submission.submitter_email ?? "—"}</Field>
                <Field label="Personal KYC">
                  <span style={{ color: kycApproved ? GREEN : "#b9500b", fontWeight: 700 }}>{submission.submitter_kyc_status ?? "—"}</span>
                  {!kycApproved && <span style={{ color: "#6e7872" }}> — withdrawals also need this approved</span>}
                </Field>
              </div>
            </motion.div>

            {/* Payout declaration */}
            <motion.div {...fade(0.14)} style={panel}>
              <div style={sectionLabel}>Payout declaration</div>
              <div style={{ display: "grid", gap: 12 }}>
                <Field label="Wave number"><strong>{submission.payout_wave_number}</strong></Field>
                <Field label="Belongs to">
                  {personalPayout ? "The representative (must be named in the letter)" : `${org.name}`}
                </Field>
              </div>
            </motion.div>

            {submission.rejection_reason && (
              <div style={{ padding: "14px 16px", borderRadius: 12, background: "#fef4f4", border: "1px solid rgba(239,68,68,0.15)" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: RED, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Rejection reason</div>
                <div style={{ fontSize: 13, color: "#b42323", lineHeight: 1.6 }}>{submission.rejection_reason}</div>
              </div>
            )}

            {canDecide ? (
              <motion.div {...fade(0.16)} style={panel}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#15201a", marginBottom: 4 }}>Decision</div>
                <div style={{ fontSize: 12, color: "#626d66", marginBottom: 16, lineHeight: 1.5 }}>The representative is emailed either way.</div>

                {mode === "idle" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <button onClick={() => setMode("approve")} style={{ padding: 12, borderRadius: 10, border: "none", background: GREEN, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>✓ Approve</button>
                    <button onClick={() => setMode("reject")} style={{ padding: 12, borderRadius: 10, border: "1px solid rgba(239,68,68,0.3)", background: "#fef0f0", color: RED, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>✕ Reject</button>
                  </div>
                )}

                {mode === "approve" && (
                  <div>
                    <div style={{ padding: "12px 14px", borderRadius: 9, background: "#f2f9f5", border: "1px solid rgba(31,153,96,0.2)", marginBottom: 14, fontSize: 13, color: "#56625b", lineHeight: 1.5 }}>
                      Marks {org.name} as <strong style={{ color: GREEN }}>verified</strong> and sends all its withdrawals to <strong>{submission.payout_wave_number}</strong>.
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => void onDecide(true)} disabled={decide.isPending} style={{ flex: 1, padding: 10, borderRadius: 9, border: "none", background: GREEN, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                        {decide.isPending ? "Approving…" : "Confirm"}
                      </button>
                      <button onClick={() => setMode("idle")} style={{ padding: "10px 16px", borderRadius: 9, border: "1px solid rgba(21,32,26,0.1)", background: "#fff", color: "#56625b", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                    </div>
                  </div>
                )}

                {mode === "reject" && (
                  <div>
                    <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4}
                      placeholder="E.g. The letter isn't stamped, or doesn't name your Wave number…"
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1px solid rgba(239,68,68,0.2)", background: "#fef8f8", color: "#15201a", fontSize: 13, resize: "vertical", outline: "none", boxSizing: "border-box", marginBottom: 10 }} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => void onDecide(false)} disabled={decide.isPending || reason.trim().length < 10}
                        style={{ flex: 1, padding: 10, borderRadius: 9, border: "none", background: RED, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: reason.trim().length < 10 ? 0.5 : 1 }}>
                        {decide.isPending ? "Rejecting…" : "Confirm"}
                      </button>
                      <button onClick={() => { setMode("idle"); setReason(""); }} style={{ padding: "10px 16px", borderRadius: 9, border: "1px solid rgba(21,32,26,0.1)", background: "#fff", color: "#56625b", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <div style={{ padding: "14px 16px", borderRadius: 12, background: "#fff", border: "1px solid rgba(21,32,26,0.07)", fontSize: 13, color: "#6e7872" }}>
                Already processed ({submission.status.toLowerCase()}).
              </div>
            )}
          </div>
        </div>
      </div>
      <style>{`@media (max-width: 760px) { .org-review-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
