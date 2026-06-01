"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { loginWithCredentials } from "@/lib/api";

const BLUE = "#1dc5ff";
const GREEN = "#1bbf88";

const loginSchema = z.object({
  username: z.string().min(1, "Enter your email or Wave number."),
  password: z.string().min(1, "Enter your password."),
});
type LoginFormValues = z.infer<typeof loginSchema>;

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{msg}</div>;
}

type LoginFormCardProps = {
  nextTarget: string;
  errorMessage?: string;
  successMessage?: string;
};

export function LoginFormCard({ nextTarget, errorMessage, successMessage }: LoginFormCardProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await loginWithCredentials(values.username, values.password);
      // Hard navigation so the browser commits the Set-Cookie header before the
      // server reads cookies() in the dashboard layout's requireUser() call.
      // router.replace + router.refresh races against cookie commitment on mobile.
      window.location.href = nextTarget || "/dashboard";
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to sign in. Please try again.");
    }
  });

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "11px 14px", borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)",
    color: "#f0f6ff", fontSize: 16, outline: "none", boxSizing: "border-box",
    transition: "border-color 0.2s",
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0f1a",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px 16px", position: "relative", overflow: "hidden",
    }}>
      {/* Background glow */}
      <div style={{ position: "absolute", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(29,197,255,0.08) 0%, transparent 70%)", left: "-20%", top: "-20%", pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(27,191,136,0.06) 0%, transparent 70%)", right: "-10%", bottom: "-10%", pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: 440, position: "relative", zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: `linear-gradient(135deg, ${BLUE}, #079bd4)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, fontWeight: 900, color: "#fff",
            }}>K</div>
            <span style={{ fontSize: 20, fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.03em" }}>Kambeng</span>
          </Link>
        </div>

        {/* Card */}
        <div style={{
          background: "#0d1120", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 20, padding: "32px",
          boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
        }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.03em", marginBottom: 6 }}>Welcome back</div>
            <div style={{ fontSize: 13, color: "#6b7a8d" }}>Sign in with your email or Wave number.</div>
          </div>

          {successMessage && (
            <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(27,191,136,0.08)", border: "1px solid rgba(27,191,136,0.2)", fontSize: 13, color: GREEN, marginBottom: 16 }}>
              {successMessage}
            </div>
          )}
          {(errorMessage || submitError) && (
            <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", fontSize: 13, color: "#fca5a5", marginBottom: 16 }}>
              {errorMessage ?? submitError}
            </div>
          )}

          <form method="post" action="/api/auth/login" onSubmit={(e) => void onSubmit(e)} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <input type="hidden" name="next" value={nextTarget} />

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#8899aa", display: "block", marginBottom: 6 }}>Email or Wave number</label>
              <input
                {...form.register("username")}
                name="username"
                placeholder="+220XXXXXXXX or you@example.com"
                autoComplete="username"
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(29,197,255,0.4)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
              />
              <FieldError msg={form.formState.errors.username?.message} />
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#8899aa" }}>Password</label>
                <Link href="/auth/forgot-password" style={{ fontSize: 12, color: BLUE, fontWeight: 500 }}>Forgot password?</Link>
              </div>
              <input
                {...form.register("password")}
                name="password"
                type="password"
                placeholder="Your password"
                autoComplete="current-password"
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(29,197,255,0.4)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
              />
              <FieldError msg={form.formState.errors.password?.message} />
            </div>

            <button
              type="submit"
              disabled={form.formState.isSubmitting}
              style={{
                width: "100%", padding: "13px", borderRadius: 10, border: "none",
                background: `linear-gradient(135deg, ${BLUE}, #079bd4)`,
                color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
                boxShadow: "0 4px 20px rgba(29,197,255,0.35)",
                opacity: form.formState.isSubmitting ? 0.7 : 1,
                transition: "opacity 0.2s",
              }}
            >
              {form.formState.isSubmitting ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
            <span style={{ fontSize: 13, color: "#4a5568" }}>Don&apos;t have an account? </span>
            <Link href="/auth/signup" style={{ fontSize: 13, color: BLUE, fontWeight: 600 }}>Create one</Link>
          </div>

          <div style={{ marginTop: 12, textAlign: "center" }}>
            <Link href="/auth/verify-email" style={{ fontSize: 12, color: "#4a5568" }}>Verify email address</Link>
          </div>
        </div>

        {/* Wave badge */}
        <div style={{ textAlign: "center", marginTop: 20, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Image src="/wave.png" alt="Wave" width={16} height={16} style={{ objectFit: "contain", borderRadius: 3 }} />
          <span style={{ fontSize: 12, color: "#4a5568" }}>Powered by Wave Mobile Money</span>
        </div>
      </div>
    </div>
  );
}
