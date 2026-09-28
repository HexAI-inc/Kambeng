"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  useFollowProfile,
  useHandleAvailability,
  useMyFollowing,
  useRemoveProfileImage,
  useSessionProfile,
  useUpdateMyProfile,
  useUploadProfileImage,
} from "@/hooks/use-frontend-data";
import { CAMPAIGN_CATEGORIES } from "@/lib/campaign-categories";
import { profileHref } from "@/lib/profile-url";
import { UserAvatar } from "@/components/ui/user-avatar";
import { SOCIAL_NETWORKS } from "@/components/profile/social-links";
import type { SocialLinks } from "@/lib/api";
import { kycLabel } from "@/lib/fmt";
import { StyledSelect } from "@/components/ui/styled-select";

const BLUE = "#14784a";
const GREEN = "#1f9960";
const RED = "#d42f2f";

function fade(delay = 0) {
  return { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.32, delay, ease: "easeOut" as const } };
}

function KYCChip({ status }: { status?: string | null }) {
  const s = (status ?? "NOT_SUBMITTED").toUpperCase();
  const map: Record<string, { color: string; bg: string; border: string; label: string }> = {
    APPROVED:      { color: GREEN,     bg: "#e9f5ef",  border: "rgba(31,153,96,0.25)", label: "Verified" },
    SUBMITTED:     { color: BLUE,      bg: "#e8f2ed",  border: "rgba(20,120,74,0.2)",  label: "Under review" },
    REVIEWING:     { color: BLUE,      bg: "#e8f2ed",  border: "rgba(20,120,74,0.2)",  label: "Under review" },
    REJECTED:      { color: RED,       bg: "#fdecec",   border: "rgba(239,68,68,0.25)", label: "Rejected" },
    NOT_SUBMITTED: { color: "#e8650f", bg: "#fdf0e7",  border: "rgba(232,101,15,0.25)", label: "Not submitted" },
  };
  const t = map[s] ?? map.NOT_SUBMITTED;
  return <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "4px 12px", borderRadius: 20, color: t.color, background: t.bg, border: `1px solid ${t.border}` }}>{t.label}</span>;
}

const IMAGE_LIMITS = { avatar: 5 * 1024 * 1024, cover: 8 * 1024 * 1024 } as const;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
// Mirrors NAME_LOCKED_KYC_STATUSES on the backend
const NAME_LOCKED_KYC = ["SUBMITTED", "REVIEWING", "APPROVED"];

const MAX_CAUSES = 3;
const HANDLE_FORMAT = /^[a-z][a-z0-9_]{2,29}$/;

type DetailsOverrides = {
  full_name?: string; email?: string; wave_number?: string; bio?: string; location?: string; account_purpose?: string;
  social_links?: SocialLinks; handle?: string; favorite_causes?: string[];
};

const normalizeHandle = (raw: string) => raw.trim().replace(/^@/, "").toLowerCase();

/** Trimmed, blank links dropped — for comparing and sending. */
function cleanLinks(links: SocialLinks): SocialLinks {
  return Object.fromEntries(Object.entries(links).map(([k, v]) => [k, (v ?? "").trim()]).filter(([, v]) => v)) as SocialLinks;
}

export default function ProfilePage() {
  const { data: me, isLoading } = useSessionProfile(true);
  const updateProfile = useUpdateMyProfile();
  const uploadAvatar = useUploadProfileImage("avatar");
  const removeAvatar = useRemoveProfileImage("avatar");
  const uploadCover = useUploadProfileImage("cover");
  const removeCover = useRemoveProfileImage("cover");
  const avatarInput = useRef<HTMLInputElement | null>(null);
  const coverInput = useRef<HTMLInputElement | null>(null);
  const { data: following = [] } = useMyFollowing(Boolean(me));
  const unfollow = useFollowProfile();

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
  const bio        = detailOverrides.bio         ?? me?.bio         ?? "";
  const location   = detailOverrides.location    ?? me?.location    ?? "";
  const purpose    = detailOverrides.account_purpose ?? me?.account_purpose ?? "";
  const links      = detailOverrides.social_links ?? me?.social_links ?? {};
  const nameLocked = NAME_LOCKED_KYC.includes((me?.kyc_status ?? "").toUpperCase());
  const handle     = detailOverrides.handle ?? me?.handle ?? "";
  const causes     = detailOverrides.favorite_causes ?? me?.favorite_causes ?? [];

  // Debounced live availability check for the handle picker
  const normalizedHandle = normalizeHandle(handle);
  const [debouncedHandle, setDebouncedHandle] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedHandle(normalizedHandle), 400);
    return () => clearTimeout(t);
  }, [normalizedHandle]);
  const handleChanged = normalizedHandle !== (me?.handle ?? "");
  const handleFormatOk = HANDLE_FORMAT.test(normalizedHandle);
  const { data: availability, isFetching: checkingHandle } = useHandleAvailability(
    handleChanged && handleFormatOk && debouncedHandle === normalizedHandle ? debouncedHandle : "",
  );
  let handleHint: { text: string; ok: boolean } | null = null;
  if (handleChanged && normalizedHandle) {
    if (!handleFormatOk) handleHint = { text: "3–30 lowercase letters, numbers or underscores, starting with a letter", ok: false };
    else if (checkingHandle || !availability) handleHint = { text: "Checking…", ok: true };
    else handleHint = availability.available ? { text: "Available", ok: true } : { text: availability.reason ?? "Not available", ok: false };
  } else if (handleChanged && !normalizedHandle) {
    handleHint = { text: "Saving will remove your custom URL", ok: true };
  }

  const toggleCause = (value: string) => {
    const next = causes.includes(value) ? causes.filter((c) => c !== value) : [...causes, value];
    if (next.length > MAX_CAUSES) { showToast(`Pick up to ${MAX_CAUSES} causes`, false); return; }
    setDetailOverrides((p) => ({ ...p, favorite_causes: next }));
  };

  const showToast = (msg: string, ok: boolean) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500); };

  const handleSaveDetails = async () => {
    if (!me) return;
    const payload: DetailsOverrides = {};
    if (fullName   !== me.full_name && !nameLocked) payload.full_name = fullName;
    if (email      !== me.email)       payload.email       = email;
    if (waveNumber !== me.wave_number) payload.wave_number = waveNumber;
    if (bio        !== (me.bio ?? "")) payload.bio         = bio;
    if (location   !== (me.location ?? "")) payload.location = location;
    if (purpose && purpose !== (me.account_purpose ?? "")) payload.account_purpose = purpose;
    if (JSON.stringify(cleanLinks(links)) !== JSON.stringify(cleanLinks(me.social_links ?? {}))) payload.social_links = cleanLinks(links);
    if (handleChanged) {
      if (normalizedHandle && availability?.available === false) { showToast(availability.reason ?? "That handle isn't available", false); return; }
      payload.handle = normalizedHandle;
    }
    if (JSON.stringify(causes) !== JSON.stringify(me.favorite_causes ?? [])) payload.favorite_causes = causes;
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

  const handleImage = async (kind: "avatar" | "cover", file: File | undefined) => {
    const input = kind === "avatar" ? avatarInput : coverInput;
    if (input.current) input.current.value = "";
    if (!file) return;
    const label = kind === "avatar" ? "Profile photo" : "Cover photo";
    if (!IMAGE_TYPES.includes(file.type)) { showToast("Use a JPG, PNG or WebP image", false); return; }
    if (file.size > IMAGE_LIMITS[kind]) { showToast(`${label} is too large. Maximum size is ${IMAGE_LIMITS[kind] / (1024 * 1024)}MB`, false); return; }
    try {
      await (kind === "avatar" ? uploadAvatar : uploadCover).mutateAsync(file);
      showToast(`${label} updated`, true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Couldn't upload the photo";
      showToast(msg, false);
    }
  };

  const handleRemoveImage = async (kind: "avatar" | "cover") => {
    try {
      await (kind === "avatar" ? removeAvatar : removeCover).mutateAsync();
      showToast(kind === "avatar" ? "Profile photo removed" : "Cover photo removed", true);
    } catch {
      showToast("Couldn't remove the photo", false);
    }
  };

  const handleToggleSupported = async (show: boolean) => {
    try {
      await updateProfile.mutateAsync({ show_supported_campaigns: show });
      showToast(show ? "Campaigns you support are now on your profile" : "Supported campaigns hidden", true);
    } catch {
      showToast("Couldn't update that setting", false);
    }
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
    border: "1px solid rgba(21,32,26,0.1)", background: "#fff",
    color: "#15201a", fontSize: 14, outline: "none", boxSizing: "border-box",
    transition: "border-color 0.2s",
  };
  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = "rgba(20,120,74,0.4)"; };
  const onBlur  = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = "rgba(21,32,26,0.1)"; };

  if (isLoading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 36, height: 36, border: `2px solid ${BLUE}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!me) return null;

  return (
    <div style={{ minHeight: "100vh", padding: "28px clamp(16px,4vw,48px)" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

        {toast && (
          <div style={{ position: "fixed", top: 24, right: 24, zIndex: 999, padding: "12px 20px", borderRadius: 10, background: toast.ok ? "rgba(31,153,96,0.15)" : "rgba(239,68,68,0.15)", border: `1px solid ${toast.ok ? "rgba(31,153,96,0.3)" : "rgba(239,68,68,0.3)"}`, color: toast.ok ? GREEN : RED, fontSize: 13, fontWeight: 600, boxShadow: "0 8px 32px rgba(21,32,26,0.12)" }}>{toast.msg}</div>
        )}

        <motion.div {...fade(0)}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#15201a", letterSpacing: "-0.03em" }}>Profile &amp; Settings</div>
          <div style={{ fontSize: 13, color: "#626d66", marginTop: 4 }}>Manage your personal details, public profile, and security</div>
        </motion.div>

        {/* Identity card */}
        <motion.div {...fade(0.05)}>
          <div style={{ background: "#ffffff", border: "1px solid rgba(21,32,26,0.07)", borderRadius: 16, padding: "20px 24px", display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <button
                type="button"
                onClick={() => avatarInput.current?.click()}
                disabled={uploadAvatar.isPending}
                title="Change profile photo"
                aria-label="Change profile photo"
                style={{ position: "relative", padding: 0, border: "none", background: "none", borderRadius: "50%", cursor: "pointer", opacity: uploadAvatar.isPending ? 0.6 : 1 }}
              >
                <UserAvatar name={me.full_name} src={me.avatar_url} size={72} />
                <span style={{ position: "absolute", right: -2, bottom: -2, width: 26, height: 26, borderRadius: "50%", background: BLUE, border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
                  </svg>
                </span>
              </button>
              <input ref={avatarInput} type="file" accept={IMAGE_TYPES.join(",")} hidden onChange={(e) => void handleImage("avatar", e.target.files?.[0])} />
              {me.avatar_url && (
                <button type="button" onClick={() => void handleRemoveImage("avatar")} disabled={removeAvatar.isPending} style={{ border: "none", background: "none", padding: 0, fontSize: 11, fontWeight: 600, color: "#6e7872", cursor: "pointer" }}>
                  Remove
                </button>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#15201a", marginBottom: 2 }}>{me.full_name}</div>
              <div style={{ fontSize: 13, color: "#626d66", marginBottom: 10 }}>{me.email}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <KYCChip status={me.kyc_status} />
                <span style={{ fontSize: 11, color: "#6e7872" }}>Member since {new Date(me.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                {me.role === "ADMIN" && (
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "3px 10px", borderRadius: 20, color: "#e8650f", background: "#fdf0e7", border: "1px solid rgba(232,101,15,0.25)" }}>Admin</span>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Personal details */}
        <motion.div {...fade(0.08)}>
          <div style={{ background: "#ffffff", border: "1px solid rgba(21,32,26,0.07)", borderRadius: 16, padding: "24px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#15201a", marginBottom: 18 }}>Personal details</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#56625b", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 6 }}>Full name</label>
                <input
                  value={fullName}
                  readOnly={nameLocked}
                  onChange={(e) => setDetailOverrides((p) => ({ ...p, full_name: e.target.value }))}
                  style={nameLocked ? { ...inputStyle, background: "#f6f4ef", color: "#56625b", cursor: "not-allowed" } : inputStyle}
                  onFocus={onFocus}
                  onBlur={onBlur}
                />
                {nameLocked && (
                  <div style={{ fontSize: 11, color: "#6e7872", marginTop: 5 }}>
                    Locked — your name is checked against your ID, and donors see it as verified. Contact support if it needs correcting.
                  </div>
                )}
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#56625b", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 6 }}>Email address</label>
                <input type="email" value={email} onChange={(e) => setDetailOverrides((p) => ({ ...p, email: e.target.value }))} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#56625b", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 6 }}>Wave number</label>
                <input type="tel" value={waveNumber} onChange={(e) => setDetailOverrides((p) => ({ ...p, wave_number: e.target.value }))} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#56625b", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 6 }}>What brings you to Kambeng?</label>
                <StyledSelect
                  value={purpose}
                  onChange={(v) => setDetailOverrides((p) => ({ ...p, account_purpose: v }))}
                  placeholder="Choose one (optional)"
                  options={[
                    { value: "DONATE", label: "I'm mainly here to give" },
                    { value: "FUNDRAISE", label: "I want to fundraise" },
                  ]}
                  style={{ width: "100%" }}
                />
                <div style={{ fontSize: 11, color: "#6e7872", marginTop: 5 }}>Just a preference — you can donate and fundraise either way.</div>
              </div>
            </div>
            <button onClick={() => void handleSaveDetails()} disabled={saving} style={{ marginTop: 18, padding: "10px 24px", borderRadius: 9, border: "none", background: `${BLUE}`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px rgba(20,120,74,0.3)", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saving…" : "Save details"}
            </button>
          </div>
        </motion.div>

        {/* Public profile */}
        <motion.div {...fade(0.095)}>
          <div style={{ background: "#ffffff", border: "1px solid rgba(20,120,74,0.12)", borderRadius: 16, padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#15201a" }}>Public profile</div>
              <a href={profileHref(me)} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 700, color: BLUE, textDecoration: "none" }}>
                View public profile →
              </a>
            </div>
            <div style={{ fontSize: 12, color: "#626d66", marginBottom: 18 }}>
              Your name, photo, location and bio are shown publicly on your campaigns, so donors know who they&apos;re giving to.
              {!me.avatar_url && " Organizers with a real photo tend to earn more trust — tap your avatar above to add one."}
            </div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#56625b", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 6 }}>Profile link</label>
            <div style={{ display: "flex", alignItems: "stretch", border: "1px solid rgba(21,32,26,0.1)", borderRadius: 9, overflow: "hidden", background: "#fff" }}>
              <span style={{ padding: "10px 4px 10px 14px", fontSize: 14, color: "#6e7872", background: "#f6f4ef", whiteSpace: "nowrap" }}>
                {typeof window !== "undefined" ? window.location.host : "kambeng.gm"}/@
              </span>
              <input
                value={handle}
                maxLength={31}
                placeholder="yourname"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                onChange={(e) => setDetailOverrides((p) => ({ ...p, handle: e.target.value }))}
                style={{ ...inputStyle, border: "none", borderRadius: 0, minWidth: 0 }}
              />
            </div>
            <div style={{ fontSize: 11, marginTop: 5, marginBottom: 14, color: handleHint ? (handleHint.ok ? GREEN : RED) : "#6e7872" }}>
              {handleHint?.text ?? "A short, shareable link to your profile. Changing it breaks links to the old one."}
            </div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#56625b", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 6 }}>Cover photo</label>
            <div style={{ position: "relative", height: 120, borderRadius: 12, overflow: "hidden", marginBottom: 14, background: "linear-gradient(135deg, #e6f4ec 0%, #cfe8da 60%, #eef6f1 100%)", border: "1px solid rgba(21,32,26,0.07)" }}>
              {me.cover_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={me.cover_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              )}
              <div style={{ position: "absolute", right: 10, bottom: 10, display: "flex", gap: 8 }}>
                {me.cover_url && (
                  <button type="button" onClick={() => void handleRemoveImage("cover")} disabled={removeCover.isPending} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(21,32,26,0.12)", background: "#fff", color: "#56625b", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    Remove
                  </button>
                )}
                <button type="button" onClick={() => coverInput.current?.click()} disabled={uploadCover.isPending} style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: BLUE, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: uploadCover.isPending ? 0.7 : 1 }}>
                  {uploadCover.isPending ? "Uploading…" : me.cover_url ? "Change cover" : "Add cover"}
                </button>
              </div>
              <input ref={coverInput} type="file" accept={IMAGE_TYPES.join(",")} hidden onChange={(e) => void handleImage("cover", e.target.files?.[0])} />
            </div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#56625b", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 6 }}>Location</label>
            <input
              value={location}
              maxLength={80}
              placeholder="e.g. Serekunda, KMC"
              onChange={(e) => setDetailOverrides((p) => ({ ...p, location: e.target.value }))}
              style={{ ...inputStyle, marginBottom: 14 }}
              onFocus={onFocus}
              onBlur={onBlur}
            />
            <label style={{ fontSize: 11, fontWeight: 700, color: "#56625b", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 6 }}>Bio</label>
            <textarea
              value={bio}
              maxLength={500}
              rows={4}
              placeholder="Tell donors who you are and why you fundraise…"
              onChange={(e) => setDetailOverrides((p) => ({ ...p, bio: e.target.value }))}
              style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
            />
            <div style={{ fontSize: 11, color: "#6e7872", marginTop: 6, textAlign: "right" }}>{bio.length}/500</div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#56625b", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", margin: "6px 0 4px" }}>Causes you care about</label>
            <div style={{ fontSize: 11, color: "#6e7872", marginBottom: 8 }}>Pick up to {MAX_CAUSES}. They show on your profile.</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {CAMPAIGN_CATEGORIES.filter((c) => c.value !== "other").map(({ value, label, icon: Icon }) => {
                const on = causes.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleCause(value)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer", border: `1px solid ${on ? BLUE : "rgba(21,32,26,0.12)"}`, background: on ? BLUE : "#fff", color: on ? "#fff" : "#56625b" }}
                  >
                    <Icon style={{ fontSize: 12 }} />{label}
                  </button>
                );
              })}
            </div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#56625b", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", margin: "6px 0 8px" }}>Links</label>
            <div className="profile-links-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {SOCIAL_NETWORKS.map(({ key, label, placeholder }) => (
                <div key={key}>
                  <div style={{ fontSize: 11, color: "#6e7872", marginBottom: 4 }}>{label}</div>
                  <input
                    type="url"
                    inputMode="url"
                    value={links[key] ?? ""}
                    maxLength={200}
                    placeholder={placeholder}
                    onChange={(e) => setDetailOverrides((p) => ({ ...p, social_links: { ...links, [key]: e.target.value } }))}
                    style={inputStyle}
                    onFocus={onFocus}
                    onBlur={onBlur}
                  />
                </div>
              ))}
            </div>
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 18, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={Boolean(me.show_supported_campaigns)}
                disabled={updateProfile.isPending}
                onChange={(e) => void handleToggleSupported(e.target.checked)}
                style={{ marginTop: 3, accentColor: BLUE, width: 16, height: 16 }}
              />
              <span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#15201a", display: "block" }}>Show campaigns I support</span>
                <span style={{ fontSize: 12, color: "#6e7872", lineHeight: 1.5 }}>
                  Lists campaigns you gave to under your own name — never amounts, and never gifts you made anonymously or under another name. Off by default.
                </span>
              </span>
            </label>
            <button onClick={() => void handleSaveDetails()} disabled={saving} style={{ marginTop: 10, padding: "10px 24px", borderRadius: 9, border: "none", background: `${BLUE}`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px rgba(20,120,74,0.3)", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saving…" : "Save public profile"}
            </button>
          </div>
        </motion.div>

        {/* Following */}
        <motion.div {...fade(0.1)}>
          <div style={{ background: "#ffffff", border: "1px solid rgba(21,32,26,0.07)", borderRadius: 16, padding: "24px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#15201a", marginBottom: 4 }}>Following ({following.length})</div>
            <div style={{ fontSize: 12, color: "#626d66", marginBottom: following.length ? 12 : 0 }}>
              {following.length ? "You get an email when these organizers start a new campaign." : "Follow organizers from their profile to hear when they start a new campaign."}
            </div>
            {following.map((f) => (
              <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: "1px solid rgba(21,32,26,0.06)" }}>
                <Link href={profileHref(f)} style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, textDecoration: "none" }}>
                  <UserAvatar name={f.full_name} src={f.avatar_url} size={36} ring={1} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#15201a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.full_name ?? "Kambeng organizer"}</span>
                    {f.handle && <span style={{ fontSize: 12, color: "#6e7872" }}>@{f.handle}</span>}
                  </span>
                </Link>
                <button
                  type="button"
                  disabled={unfollow.isPending}
                  onClick={() => unfollow.mutate({ userId: f.id, follow: false }, { onError: () => showToast("Couldn't unfollow", false) })}
                  style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(21,32,26,0.12)", background: "#fff", color: "#56625b", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  Unfollow
                </button>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Change password */}
        <motion.div {...fade(0.11)}>
          <div style={{ background: "#ffffff", border: "1px solid rgba(21,32,26,0.07)", borderRadius: 16, padding: "24px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#15201a", marginBottom: 4 }}>Change password</div>
            <div style={{ fontSize: 12, color: "#626d66", marginBottom: 18 }}>Leave blank if you don&apos;t want to change it.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {([
                { label: "Current password",     value: currentPassword, setter: setCurrentPassword },
                { label: "New password",         value: newPassword,     setter: setNewPassword },
                { label: "Confirm new password", value: confirmPassword, setter: setConfirmPassword },
              ] as const).map(({ label, value, setter }) => (
                <div key={label}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#56625b", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 6 }}>{label}</label>
                  <input type="password" value={value} onChange={(e) => setter(e.target.value)} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                </div>
              ))}
            </div>
            <button onClick={() => void handleChangePassword()} disabled={saving} style={{ marginTop: 18, padding: "10px 24px", borderRadius: 9, border: "none", background: `${BLUE}`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px rgba(20,120,74,0.3)", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saving…" : "Change password"}
            </button>
          </div>
        </motion.div>

        {/* Read-only account info */}
        <motion.div {...fade(0.14)}>
          <div style={{ background: "#ffffff", border: "1px solid rgba(21,32,26,0.07)", borderRadius: 16, padding: "24px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#15201a", marginBottom: 18 }}>Account info</div>
            <div className="profile-info-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {[
                { label: "Role",           value: me.role === "ADMIN" ? "Admin" : "Member" },
                { label: "KYC status",     value: kycLabel(me.kyc_status) },
                { label: "Account status", value: me.is_active ? "Active" : "Suspended" },
                { label: "Member since",   value: new Date(me.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#6e7872", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 13, color: "#56625b", padding: "9px 12px", borderRadius: 8, background: "#fff", border: "1px solid rgba(21,32,26,0.06)" }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 480px) {
          .profile-info-grid, .profile-links-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
