"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { useAdminUserDetail, useUpdateAdminUserStatus } from "@/hooks/use-frontend-data";

const BLUE = "#1dc5ff";
const GREEN = "#1bbf88";

function getKycTone(status?: string | null) {
  const normalized = (status ?? "NOT_SUBMITTED").toUpperCase();

  if (normalized === "APPROVED") {
    return {
      label: "Approved",
      color: GREEN,
      bg: "rgba(27,191,136,0.1)",
      border: "rgba(27,191,136,0.25)",
      note: "This user can receive withdrawals and create campaigns.",
    };
  }

  if (normalized === "SUBMITTED" || normalized === "REVIEWING") {
    return {
      label: normalized === "SUBMITTED" ? "Submitted" : "In review",
      color: BLUE,
      bg: "rgba(29,197,255,0.1)",
      border: "rgba(29,197,255,0.25)",
      note: "The user has an active KYC submission in the review queue.",
    };
  }

  if (normalized === "REJECTED") {
    return {
      label: "Rejected",
      color: "#ef4444",
      bg: "rgba(239,68,68,0.1)",
      border: "rgba(239,68,68,0.25)",
      note: "The user needs to resubmit documents before approval.",
    };
  }

  return {
    label: "Not submitted",
    color: "#f97316",
    bg: "rgba(249,115,22,0.1)",
    border: "rgba(249,115,22,0.25)",
    note: "No KYC submission is on file for this user yet.",
  };
}

function Field({ label, value, mono }: { label: string; value: string | number | null | undefined; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{label}</div>
      <div style={{ padding: "10px 14px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.03)", color: "#8899aa", fontSize: 13, fontFamily: mono ? "monospace" : undefined }}>{value ?? "—"}</div>
    </div>
  );
}

export default function UserEditPage() {
  const params = useParams();
  const router = useRouter();
  const userId = Array.isArray(params?.id) ? parseInt(params.id[0]) : parseInt(params?.id as string);
  const { data: user, isLoading, error } = useAdminUserDetail(userId);
  const updateStatus = useUpdateAdminUserStatus();
  const kycTone = getKycTone(user?.kyc_status);

  const [status, setStatus] = useState<"ACTIVE" | "SUSPENDED" | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  const effectiveStatus = status ?? (user?.is_active ? "ACTIVE" : "SUSPENDED");

  const handleSave = async () => {
    if (!status) { router.back(); return; }
    try {
      await updateStatus.mutateAsync({ userId, status });
      showToast("User updated successfully", true);
      setTimeout(() => router.back(), 800);
    } catch {
      showToast("Failed to update user", false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ background: "#0a0f1a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, border: `2px solid ${BLUE}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div style={{ background: "#0a0f1a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>😕</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#f0f6ff", marginBottom: 8 }}>User not found</div>
          <button onClick={() => router.back()} style={{ padding: "9px 20px", borderRadius: 9, border: "none", background: `linear-gradient(135deg, ${BLUE}, #079bd4)`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Go back</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", padding: "28px clamp(16px,4vw,48px)" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

        {toast && (
          <div style={{ position: "fixed", top: 24, right: 24, zIndex: 999, padding: "12px 20px", borderRadius: 10, background: toast.ok ? "rgba(27,191,136,0.15)" : "rgba(239,68,68,0.15)", border: `1px solid ${toast.ok ? "rgba(27,191,136,0.3)" : "rgba(239,68,68,0.3)"}`, color: toast.ok ? GREEN : "#ef4444", fontSize: 13, fontWeight: 600, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>{toast.msg}</div>
        )}

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => router.back()} style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#8899aa", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>←</button>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.03em" }}>Edit User #{userId}</div>
          </div>
        </motion.div>

        <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "24px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="User ID" value={user.id} />
            <Field label="Role" value={String(user.role)} />
            <Field label="Full Name" value={user.full_name} />
            <Field label="Email" value={user.email} mono />
            <Field label="Wave Number" value={user.wave_number} mono />
            <Field label="KYC Status" value={String(user.kyc_status ?? "—")} />
          </div>

          <div style={{ padding: 20, borderRadius: 14, border: `1px solid ${kycTone.border}`, background: kycTone.bg }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#f0f6ff", marginBottom: 4 }}>KYC</div>
                <div style={{ fontSize: 13, color: "#6b7a8d" }}>Verification status controls withdrawals and campaign creation.</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", padding: "4px 12px", borderRadius: 20, color: kycTone.color, background: kycTone.bg, border: `1px solid ${kycTone.border}` }}>{kycTone.label}</span>
            </div>
            <div style={{ fontSize: 13, color: "#c0ccd8", lineHeight: 1.7, marginBottom: 14 }}>{kycTone.note}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              <Field label="Can receive withdrawals" value={user.kyc_status === "APPROVED" ? "Yes" : "No"} />
              <Field label="Can create campaigns" value={user.kyc_status === "APPROVED" ? "Yes" : "No"} />
              <Field label="Follow-up" value={user.kyc_status === "APPROVED" ? "None" : user.kyc_status === "REJECTED" ? "Request resubmission" : user.kyc_status ? "Review submission" : "Wait for user upload"} />
            </div>
          </div>

          {/* Editable: status */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#8899aa", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Account Status</div>
            <div style={{ display: "flex", gap: 8 }}>
              {(["ACTIVE", "SUSPENDED"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  style={{
                    padding: "9px 22px", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer",
                    border: `1px solid ${effectiveStatus === s ? (s === "ACTIVE" ? "rgba(27,191,136,0.4)" : "rgba(239,68,68,0.4)") : "rgba(255,255,255,0.1)"}`,
                    background: effectiveStatus === s ? (s === "ACTIVE" ? "rgba(27,191,136,0.12)" : "rgba(239,68,68,0.12)") : "rgba(255,255,255,0.04)",
                    color: effectiveStatus === s ? (s === "ACTIVE" ? GREEN : "#ef4444") : "#8899aa",
                  }}
                >{s}</button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => void handleSave()} disabled={updateStatus.isPending} style={{ padding: "11px 24px", borderRadius: 9, border: "none", background: `linear-gradient(135deg, ${BLUE}, #079bd4)`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px rgba(29,197,255,0.3)" }}>
            {updateStatus.isPending ? "Saving…" : "Save Changes"}
          </button>
          <button onClick={() => router.back()} style={{ padding: "11px 22px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#8899aa", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
