"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useSessionProfile, useUpdateMyProfile } from "@/hooks/use-frontend-data";

const BLUE = "#1dc5ff";
const GREEN = "#1bbf88";
const RED = "#ef4444";

function fade(delay = 0) {
  return { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.32, delay, ease: "easeOut" as const } };
}

function KYCChip({ status }: { status?: string | null }) {
  const s = (status ?? "NOT_SUBMITTED").toUpperCase();
  const map: Record<string, { color: string; bg: string; border: string; label: string }> = {
    APPROVED:      { color: GREEN,     bg: "rgba(27,191,136,0.1)",  border: "rgba(27,191,136,0.25)", label: "Verified" },
    SUBMITTED:     { color: BLUE,      bg: "rgba(29,197,255,0.1)",  border: "rgba(29,197,255,0.2)",  label: "Under review" },
    REVIEWING:     { color: BLUE,      bg: "rgba(29,197,255,0.1)",  border: "rgba(29,197,255,0.2)",  label: "Under review" },
    REJECTED:      { color: RED,       bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.25)", label: "Rejected" },
    NOT_SUBMITTED: { color: "#f97316", bg: "rgba(249,115,22,0.1)",  border: "rgba(249,115,22,0.25)", label: "Not submitted" },
  };
  const t = map[s] ?? map.NOT_SUBMITTED;
  return <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "4px 12px", borderRadius: 20, color: t.color, background: t.bg, border: `1px solid ${t.border}` }}>{t.label}</span>;
}

function Avatar({ name, size = 60 }: { name: string; size?: number }) {
  const initials = name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg, #0d2340, #0a3d5c)", border: "2px solid rgba(29,197,255,0.35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.36, fontWeight: 800, color: BLUE, flexShrink: 0 }}>
      {initials}
    </div>
  );
}

type DetailsOverrides = { full_name?: string; email?: string; wave_number?: string };

export default function ProfilePage() {
  const { data: me, isLoading } = useSessionProfile(true);
  const updateProfile = useUpdateMyProfile();

  // Only track fields the user has explicitly changed
  const [detailOverrides, setDetailOverrides] = useState<DetailsOverrides>({});
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword]         = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  // Derive current field values: explicit override first, then server data
  const fullName   = detailOverrides.full_name   ?? me?.full_name   ?? "";
  const email      = detailOverrides.email       ?? me?.email       ?? "";
  const waveNumber = detailOverrides.wave_number ?? me?.wave_number ?? "";

  const showToast = (msg: string, ok: boolean) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500); };

  const handleSaveDetails = async () => {
    if (!me) return;
    const payload: DetailsOverrides = {};
    if (fullName   !== me.full_name)   payload.full_name   = fullName;
    if (email      !== me.email)       payload.email       = email;
    if (waveNumber !== me.wave_number) payload.wave_number = waveNumber;
    if (!Object.keys(payload).length) { showToast("Nothing changed", false); return; }
    setSaving(true);
    try {
      await updateProfile.mutateAsync(payload);
      showToast("Profile updated successfully", true);
      setDetailOverrides({});
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to update profile";
      showToast(msg, false);
    } finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) { showToast("Fill in both password fields", false); return; }
    if (newPassword !== confirmPassword)  { showToast("New passwords do not match", false); return; }
    if (newPassword.length < 8)           { showToast("Password must be at least 8 characters", false); return; }
    setSaving(true);
    try {
      await updateProfile.mutateAsync({ current_password: currentPassword, new_password: newPassword });
      showToast("Password changed successfully", true);
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to change password";
      showToast(msg, false);
    } finally { setSaving(false); }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px", borderRadius: 9,
    border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)",
    color: "#f0f6ff", fontSize: 14, outline: "none", boxSizing: "border-box",
    transition: "border-color 0.2s",
  };
  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = "rgba(29,197,255,0.4)"; };
  const onBlur  = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; };

  if (isLoading) return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 36, height: 36, border: `2px solid ${BLUE}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!me) return null;

  return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", padding: "28px clamp(16px,4vw,48px)" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

        {toast && (
          <div style={{ position: "fixed", top: 24, right: 24, zIndex: 999, padding: "12px 20px", borderRadius: 10, background: toast.ok ? "rgba(27,191,136,0.15)" : "rgba(239,68,68,0.15)", border: `1px solid ${toast.ok ? "rgba(27,191,136,0.3)" : "rgba(239,68,68,0.3)"}`, color: toast.ok ? GREEN : RED, fontSize: 13, fontWeight: 600, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>{toast.msg}</div>
        )}

        <motion.div {...fade(0)}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.03em" }}>My Profile</div>
          <div style={{ fontSize: 13, color: "#6b7a8d", marginTop: 4 }}>Manage your personal details and security</div>
        </motion.div>

        {/* Identity card */}
        <motion.div {...fade(0.05)}>
          <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "20px 24px", display: "flex", alignItems: "center", gap: 16 }}>
            <Avatar name={me.full_name ?? "U"} size={60} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#f0f6ff", marginBottom: 2 }}>{me.full_name}</div>
              <div style={{ fontSize: 13, color: "#6b7a8d", marginBottom: 10 }}>{me.email}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <KYCChip status={me.kyc_status} />
                <span style={{ fontSize: 11, color: "#4a5568" }}>Member since {new Date(me.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                {me.role === "ADMIN" && (
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "3px 10px", borderRadius: 20, color: "#f97316", background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)" }}>Admin</span>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Personal details */}
        <motion.div {...fade(0.08)}>
          <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "24px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f0f6ff", marginBottom: 18 }}>Personal details</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#8899aa", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 6 }}>Full name</label>
                <input value={fullName} onChange={(e) => setDetailOverrides((p) => ({ ...p, full_name: e.target.value }))} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#8899aa", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 6 }}>Email address</label>
                <input type="email" value={email} onChange={(e) => setDetailOverrides((p) => ({ ...p, email: e.target.value }))} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#8899aa", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 6 }}>Wave number</label>
                <input type="tel" value={waveNumber} onChange={(e) => setDetailOverrides((p) => ({ ...p, wave_number: e.target.value }))} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              </div>
            </div>
            <button onClick={() => void handleSaveDetails()} disabled={saving} style={{ marginTop: 18, padding: "10px 24px", borderRadius: 9, border: "none", background: `linear-gradient(135deg, ${BLUE}, #079bd4)`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px rgba(29,197,255,0.3)", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saving…" : "Save details"}
            </button>
          </div>
        </motion.div>

        {/* Change password */}
        <motion.div {...fade(0.11)}>
          <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "24px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f0f6ff", marginBottom: 4 }}>Change password</div>
            <div style={{ fontSize: 12, color: "#6b7a8d", marginBottom: 18 }}>Leave blank if you don&apos;t want to change it.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {([
                { label: "Current password",     value: currentPassword, setter: setCurrentPassword },
                { label: "New password",         value: newPassword,     setter: setNewPassword },
                { label: "Confirm new password", value: confirmPassword, setter: setConfirmPassword },
              ] as const).map(({ label, value, setter }) => (
                <div key={label}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#8899aa", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 6 }}>{label}</label>
                  <input type="password" value={value} onChange={(e) => setter(e.target.value)} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                </div>
              ))}
            </div>
            <button onClick={() => void handleChangePassword()} disabled={saving} style={{ marginTop: 18, padding: "10px 24px", borderRadius: 9, border: "none", background: `linear-gradient(135deg, ${BLUE}, #079bd4)`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px rgba(29,197,255,0.3)", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saving…" : "Change password"}
            </button>
          </div>
        </motion.div>

        {/* Read-only account info */}
        <motion.div {...fade(0.14)}>
          <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "24px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f0f6ff", marginBottom: 18 }}>Account info</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {[
                { label: "Role",           value: me.role },
                { label: "KYC status",     value: me.kyc_status ?? "NOT_SUBMITTED" },
                { label: "Account status", value: me.is_active ? "Active" : "Suspended" },
                { label: "Member since",   value: new Date(me.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 13, color: "#8899aa", padding: "9px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
