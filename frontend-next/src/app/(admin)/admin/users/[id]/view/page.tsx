"use client";

import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAdminUserDetail } from "@/hooks/use-frontend-data";

const BLUE = "#14784a";
const GREEN = "#1f9960";
const RED = "#d42f2f";

function getKycTone(status?: string | null) {
  const normalized = (status ?? "NOT_SUBMITTED").toUpperCase();

  if (normalized === "APPROVED") {
    return {
      label: "Approved",
      color: GREEN,
      bg: "rgba(31,153,96,0.1)",
      border: "rgba(31,153,96,0.25)",
      note: "This user can receive withdrawals and use the full campaign flow.",
    };
  }

  if (normalized === "SUBMITTED" || normalized === "REVIEWING") {
    return {
      label: normalized === "SUBMITTED" ? "Submitted" : "In review",
      color: BLUE,
      bg: "rgba(20,120,74,0.1)",
      border: "rgba(20,120,74,0.25)",
      note: "The user has uploaded KYC documents and is waiting for admin review.",
    };
  }

  if (normalized === "REJECTED") {
    return {
      label: "Rejected",
      color: RED,
      bg: "rgba(239,68,68,0.1)",
      border: "rgba(239,68,68,0.25)",
      note: "The user needs to resubmit documents before they can be approved.",
    };
  }

  return {
    label: "Not submitted",
    color: "#e8650f",
    bg: "rgba(232,101,15,0.1)",
    border: "rgba(232,101,15,0.25)",
    note: "No KYC submission exists yet for this user.",
  };
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#6e7872", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, color: "#15201a", fontFamily: mono ? "monospace" : undefined }}>{value ?? "—"}</div>
    </div>
  );
}

function Chip({ label, color, bg, border }: { label: string; color: string; bg: string; border: string }) {
  return <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", padding: "4px 12px", borderRadius: 20, color, background: bg, border: `1px solid ${border}` }}>{label}</span>;
}

export default function UserViewPage() {
  const params = useParams();
  const router = useRouter();
  const userId = Array.isArray(params?.id) ? parseInt(params.id[0]) : parseInt(params?.id as string);
  const { data: user, isLoading, error } = useAdminUserDetail(userId);

  if (isLoading) {
    return (
      <div style={{ background: "#f6f4ef", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, border: `2px solid ${BLUE}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div style={{ background: "#f6f4ef", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>😕</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#15201a", marginBottom: 8 }}>User not found</div>
          <button onClick={() => router.back()} style={{ padding: "9px 20px", borderRadius: 9, border: "none", background: `${BLUE}`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Go back</button>
        </div>
      </div>
    );
  }

  const initials = user.full_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() ?? "?";
  const kycTone = getKycTone(user.kyc_status);

  return (
    <div style={{ background: "#f6f4ef", minHeight: "100vh", padding: "28px clamp(16px,4vw,48px)" }}>
      <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <button onClick={() => router.back()} style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid rgba(21,32,26,0.1)", background: "rgba(21,32,26,0.04)", color: "#56625b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>←</button>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${BLUE}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: "#fff" }}>{initials}</div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#15201a", letterSpacing: "-0.03em" }}>{user.full_name}</div>
              <div style={{ fontSize: 13, color: "#6e7872" }}>{user.email}</div>
            </div>
          </div>
        </motion.div>

        {/* Info card */}
        <div style={{ background: "#ffffff", border: "1px solid rgba(21,32,26,0.07)", borderRadius: 16, padding: "24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <Field label="Wave Number" value={user.wave_number} mono />
            <Field label="Role" value={
              <Chip label={user.role === "ADMIN" ? "Admin" : "Member"} color={user.role === "ADMIN" ? "#e8650f" : BLUE} bg={user.role === "ADMIN" ? "rgba(232,101,15,0.1)" : "rgba(20,120,74,0.1)"} border={user.role === "ADMIN" ? "rgba(232,101,15,0.25)" : "rgba(20,120,74,0.2)"} />
            } />
            <Field label="Account Status" value={
              <Chip label={user.is_active ? "Active" : "Suspended"} color={user.is_active ? GREEN : RED} bg={user.is_active ? "rgba(31,153,96,0.1)" : "rgba(239,68,68,0.1)"} border={user.is_active ? "rgba(31,153,96,0.25)" : "rgba(239,68,68,0.25)"} />
            } />
            <Field label="KYC Status" value={
              <Chip label={kycTone.label} color={kycTone.color} bg={kycTone.bg} border={kycTone.border} />
            } />
            <Field label="Campaigns" value={<span style={{ fontSize: 18, fontWeight: 800, color: BLUE }}>{user.campaign_count ?? 0}</span>} />
            <Field label="Total Raised" value={<span style={{ fontWeight: 700, color: GREEN }}>{Number(user.total_raised ?? 0).toLocaleString()} GMD</span>} />
            <Field label="Joined" value={new Date(user.created_at).toLocaleString()} />
            {user.last_activity && <Field label="Last Activity" value={new Date(user.last_activity).toLocaleString()} />}
          </div>
        </div>

        <div style={{ background: "#ffffff", border: `1px solid ${kycTone.border}`, borderRadius: 16, padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#15201a", marginBottom: 4 }}>KYC</div>
              <div style={{ fontSize: 13, color: "#626d66" }}>Identity verification controls withdrawals and campaign eligibility.</div>
            </div>
            <Chip label={kycTone.label} color={kycTone.color} bg={kycTone.bg} border={kycTone.border} />
          </div>
          <div style={{ fontSize: 13, color: "#36443c", lineHeight: 1.7 }}>{kycTone.note}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 18 }}>
            <Field label="Can receive withdrawals" value={user.kyc_status === "APPROVED" ? "Yes" : "No"} />
            <Field label="Can create campaigns" value={user.kyc_status === "APPROVED" ? "Yes" : "No"} />
            <Field label="Next action" value={user.kyc_status === "APPROVED" ? "None" : user.kyc_status === "REJECTED" ? "Ask user to resubmit" : "Review submission"} />
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => router.push(`/admin/users/${user.id}/edit`)} style={{ padding: "10px 20px", borderRadius: 9, border: "none", background: `${BLUE}`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Edit User</button>
          <button onClick={() => router.back()} style={{ padding: "10px 20px", borderRadius: 9, border: "1px solid rgba(21,32,26,0.1)", background: "rgba(21,32,26,0.04)", color: "#56625b", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Back</button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
