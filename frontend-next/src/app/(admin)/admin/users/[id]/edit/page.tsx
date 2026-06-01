"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAdminUserDetail, useAdminUpdateUser } from "@/hooks/use-frontend-data";

const BLUE = "#1dc5ff";
const GREEN = "#1bbf88";
const RED = "#ef4444";

function fade(delay = 0) {
  return { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.32, delay, ease: "easeOut" as const } };
}

const KYC_STATUSES = ["NOT_SUBMITTED", "SUBMITTED", "REVIEWING", "APPROVED", "REJECTED"] as const;
type KYCStatus = typeof KYC_STATUSES[number];

const kycColor: Record<KYCStatus, string> = {
  NOT_SUBMITTED: "#f97316",
  SUBMITTED:     BLUE,
  REVIEWING:     BLUE,
  APPROVED:      GREEN,
  REJECTED:      RED,
};

type FormData = {
  full_name: string;
  email: string;
  wave_number: string;
  role: "USER" | "ADMIN";
  is_active: boolean;
  kyc_status: KYCStatus;
};

export default function UserEditPage() {
  const params = useParams();
  const router = useRouter();
  const userId = Array.isArray(params?.id) ? parseInt(params.id[0]) : parseInt(params?.id as string);
  const { data: user, isLoading, error } = useAdminUserDetail(userId);
  const updateUser = useAdminUpdateUser();

  // null = no explicit edits yet; derive values from server data
  const [overrides, setOverrides] = useState<Partial<FormData> | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const form: FormData = {
    full_name:   overrides?.full_name   ?? user?.full_name   ?? "",
    email:       overrides?.email       ?? user?.email       ?? "",
    wave_number: overrides?.wave_number ?? user?.wave_number ?? "",
    role:        overrides?.role        ?? ((user?.role as "USER" | "ADMIN") ?? "USER"),
    is_active:   overrides?.is_active   ?? (user?.is_active ?? true),
    kyc_status:  overrides?.kyc_status  ?? ((user?.kyc_status as KYCStatus) ?? "NOT_SUBMITTED"),
  };

  const set = (patch: Partial<FormData>) => setOverrides((prev) => ({ ...(prev ?? {}), ...patch }));

  const showToast = (msg: string, ok: boolean) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  const handleSave = async () => {
    if (!user) return;
    try {
      await updateUser.mutateAsync({
        userId,
        payload: {
          full_name:   form.full_name   !== user.full_name   ? form.full_name   : undefined,
          email:       form.email       !== user.email       ? form.email       : undefined,
          wave_number: form.wave_number !== user.wave_number ? form.wave_number : undefined,
          role:        form.role        !== user.role        ? form.role        : undefined,
          is_active:   form.is_active   !== user.is_active   ? form.is_active   : undefined,
          kyc_status:  form.kyc_status  !== user.kyc_status  ? form.kyc_status  : undefined,
        },
      });
      showToast("User updated successfully", true);
      setTimeout(() => router.back(), 900);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to update user";
      showToast(msg, false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px", borderRadius: 9,
    border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)",
    color: "#f0f6ff", fontSize: 14, outline: "none", boxSizing: "border-box",
    transition: "border-color 0.2s",
  };

  if (isLoading) return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 36, height: 36, border: `2px solid ${BLUE}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error || !user) return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#f0f6ff", marginBottom: 12 }}>User not found</div>
        <button onClick={() => router.back()} style={{ padding: "9px 20px", borderRadius: 9, border: "none", background: `linear-gradient(135deg, ${BLUE}, #079bd4)`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Go back</button>
      </div>
    </div>
  );

  return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", padding: "28px clamp(16px,4vw,48px)" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

        {toast && (
          <div style={{ position: "fixed", top: 24, right: 24, zIndex: 999, padding: "12px 20px", borderRadius: 10, background: toast.ok ? "rgba(27,191,136,0.15)" : "rgba(239,68,68,0.15)", border: `1px solid ${toast.ok ? "rgba(27,191,136,0.3)" : "rgba(239,68,68,0.3)"}`, color: toast.ok ? GREEN : RED, fontSize: 13, fontWeight: 600, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>{toast.msg}</div>
        )}

        {/* Header */}
        <motion.div {...fade(0)} style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => router.back()} style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#8899aa", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>←</button>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.03em" }}>Edit User #{userId}</div>
            <div style={{ fontSize: 13, color: "#6b7a8d", marginTop: 2 }}>{user.email}</div>
          </div>
        </motion.div>

        {/* Identity fields */}
        <motion.div {...fade(0.05)}>
          <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "24px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f0f6ff", marginBottom: 18 }}>Identity</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 6 }}>Full name</label>
                <input value={form.full_name} onChange={(e) => set({ full_name: e.target.value })} type="text" style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(29,197,255,0.4)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }} />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 6 }}>Email</label>
                <input value={form.email} onChange={(e) => set({ email: e.target.value })} type="email" style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(29,197,255,0.4)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }} />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 6 }}>Wave number</label>
                <input value={form.wave_number} onChange={(e) => set({ wave_number: e.target.value })} type="tel" style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(29,197,255,0.4)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }} />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Role */}
        <motion.div {...fade(0.08)}>
          <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "24px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f0f6ff", marginBottom: 6 }}>Role</div>
            <div style={{ fontSize: 12, color: "#6b7a8d", marginBottom: 14 }}>ADMIN can access the admin panel and manage all users and campaigns.</div>
            <div style={{ display: "flex", gap: 8 }}>
              {(["USER", "ADMIN"] as const).map((r) => (
                <button key={r} onClick={() => set({ role: r })} style={{
                  padding: "9px 22px", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer",
                  border: `1px solid ${form.role === r ? (r === "ADMIN" ? "rgba(249,115,22,0.4)" : "rgba(29,197,255,0.4)") : "rgba(255,255,255,0.1)"}`,
                  background: form.role === r ? (r === "ADMIN" ? "rgba(249,115,22,0.12)" : "rgba(29,197,255,0.1)") : "rgba(255,255,255,0.04)",
                  color: form.role === r ? (r === "ADMIN" ? "#f97316" : BLUE) : "#8899aa",
                }}>{r}</button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Account status */}
        <motion.div {...fade(0.1)}>
          <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "24px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f0f6ff", marginBottom: 14 }}>Account status</div>
            <div style={{ display: "flex", gap: 8 }}>
              {([true, false] as const).map((active) => (
                <button key={String(active)} onClick={() => set({ is_active: active })} style={{
                  padding: "9px 22px", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer",
                  border: `1px solid ${form.is_active === active ? (active ? "rgba(27,191,136,0.4)" : "rgba(239,68,68,0.4)") : "rgba(255,255,255,0.1)"}`,
                  background: form.is_active === active ? (active ? "rgba(27,191,136,0.12)" : "rgba(239,68,68,0.12)") : "rgba(255,255,255,0.04)",
                  color: form.is_active === active ? (active ? GREEN : RED) : "#8899aa",
                }}>{active ? "Active" : "Suspended"}</button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* KYC override */}
        <motion.div {...fade(0.12)}>
          <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "24px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f0f6ff", marginBottom: 6 }}>KYC status override</div>
            <div style={{ fontSize: 12, color: "#6b7a8d", marginBottom: 14 }}>Use with care — setting APPROVED grants withdrawal access without a document review.</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {KYC_STATUSES.map((s) => {
                const c = kycColor[s];
                const active = form.kyc_status === s;
                return (
                  <button key={s} onClick={() => set({ kyc_status: s })} style={{
                    padding: "8px 16px", borderRadius: 9, fontSize: 11, fontWeight: 700, cursor: "pointer",
                    letterSpacing: "0.05em", textTransform: "uppercase",
                    border: `1px solid ${active ? `${c}66` : "rgba(255,255,255,0.1)"}`,
                    background: active ? `${c}18` : "rgba(255,255,255,0.04)",
                    color: active ? c : "#8899aa",
                  }}>{s.replace("_", " ")}</button>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div {...fade(0.14)} style={{ display: "flex", gap: 10 }}>
          <button onClick={() => void handleSave()} disabled={updateUser.isPending} style={{ padding: "11px 28px", borderRadius: 9, border: "none", background: `linear-gradient(135deg, ${BLUE}, #079bd4)`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px rgba(29,197,255,0.3)", opacity: updateUser.isPending ? 0.7 : 1 }}>
            {updateUser.isPending ? "Saving…" : "Save changes"}
          </button>
          <button onClick={() => router.back()} style={{ padding: "11px 22px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#8899aa", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
        </motion.div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
