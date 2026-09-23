"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { BrandMark } from "@/components/layout/brand-mark";

const BLUE = "#14784a";

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(1, "Confirm your password."),
  })
  .refine((v) => v.password === v.confirmPassword, { message: "Passwords do not match.", path: ["confirmPassword"] });

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <div style={{ fontSize: 11, color: "#d42f2f", marginTop: 4 }}>{msg}</div>;
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px", borderRadius: 10,
  border: "1px solid rgba(21,32,26,0.1)", background: "#fff",
  color: "#15201a", fontSize: 14, outline: "none", boxSizing: "border-box",
  transition: "border-color 0.2s",
};

export function ResetPasswordFormCard({ token }: { token: string }) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    const response = await fetch("/api/backend/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, new_password: values.password }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) { setSubmitError(payload?.detail ?? "Failed to reset password."); return; }
    router.push("/auth/login");
  });

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(20,120,74,0.08) 0%, transparent 70%)", left: "-20%", top: "-20%", pointerEvents: "none" }} />
      <div style={{ width: "100%", maxWidth: 440, position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <BrandMark size={40} />
            <span style={{ fontSize: 20, fontWeight: 900, color: "#15201a", letterSpacing: "-0.03em" }}>Kambeng</span>
          </Link>
        </div>

        <div style={{ background: "#ffffff", border: "1px solid rgba(21,32,26,0.08)", borderRadius: 20, padding: "32px", boxShadow: "0 24px 80px rgba(21,32,26,0.12)" }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#15201a", letterSpacing: "-0.03em", marginBottom: 6 }}>Create a new password</div>
            <div style={{ fontSize: 13, color: "#626d66" }}>Use at least 8 characters with letters, numbers, and symbols.</div>
          </div>

          <form onSubmit={(e) => void onSubmit(e)} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#56625b", display: "block", marginBottom: 6 }}>New password</label>
              <div style={{ position: "relative" }}>
                <input
                  {...form.register("password")}
                  type={showPw ? "text" : "password"}
                  placeholder="Create a strong password"
                  autoComplete="new-password"
                  style={{ ...inputStyle, paddingRight: 44 }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(20,120,74,0.4)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(21,32,26,0.1)"; }}
                />
                <button type="button" onClick={() => setShowPw((v) => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#6e7872", cursor: "pointer", fontSize: 12 }}>{showPw ? "Hide" : "Show"}</button>
              </div>
              <FieldError msg={form.formState.errors.password?.message} />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#56625b", display: "block", marginBottom: 6 }}>Confirm password</label>
              <input
                {...form.register("confirmPassword")}
                type={showPw ? "text" : "password"}
                placeholder="Re-enter your password"
                autoComplete="new-password"
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(20,120,74,0.4)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(21,32,26,0.1)"; }}
              />
              <FieldError msg={form.formState.errors.confirmPassword?.message} />
            </div>

            <div style={{ padding: "10px 14px", borderRadius: 8, background: "#f1f7f4", border: "1px solid rgba(20,120,74,0.15)", fontSize: 12, color: "#626d66" }}>
              Your password will be updated immediately. You&apos;ll need to log in again.
            </div>

            {submitError && (
              <div style={{ padding: "10px 14px", borderRadius: 8, background: "#fef0f0", border: "1px solid rgba(239,68,68,0.2)", fontSize: 13, color: "#b42323" }}>{submitError}</div>
            )}

            <button type="submit" disabled={form.formState.isSubmitting} style={{ width: "100%", padding: "13px", borderRadius: 10, border: "none", background: `${BLUE}`, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 20px rgba(20,120,74,0.35)", opacity: form.formState.isSubmitting ? 0.7 : 1 }}>
              {form.formState.isSubmitting ? "Resetting…" : "Reset password"}
            </button>

            <div style={{ textAlign: "center" }}>
              <Link href="/auth/login" style={{ fontSize: 13, color: "#6e7872" }}>Back to login</Link>
            </div>
          </form>
        </div>

        <div style={{ textAlign: "center", marginTop: 20, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Image src="/wave.png" alt="Wave" width={16} height={16} style={{ objectFit: "contain", borderRadius: 3 }} />
          <span style={{ fontSize: 12, color: "#6e7872" }}>Powered by Wave Mobile Money</span>
        </div>
      </div>
    </div>
  );
}
