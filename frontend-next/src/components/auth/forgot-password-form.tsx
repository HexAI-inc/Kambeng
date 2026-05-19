"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

const BLUE = "#1dc5ff";

const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address."),
});
type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{msg}</div>;
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px", borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)",
  color: "#f0f6ff", fontSize: 14, outline: "none", boxSizing: "border-box",
  transition: "border-color 0.2s",
};

type ForgotPasswordFormCardProps = { nextTarget?: string };

export function ForgotPasswordFormCard({ nextTarget = "/auth/login" }: ForgotPasswordFormCardProps) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    const response = await fetch("/api/backend/auth/request-password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: values.email.trim() }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) { setSubmitError(payload?.detail ?? "Failed to request password reset."); return; }
    setSent(true);
    setTimeout(() => router.push(nextTarget), 2000);
  });

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1a", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(29,197,255,0.08) 0%, transparent 70%)", left: "-20%", top: "-20%", pointerEvents: "none" }} />
      <div style={{ width: "100%", maxWidth: 440, position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `linear-gradient(135deg, ${BLUE}, #079bd4)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900, color: "#fff" }}>K</div>
            <span style={{ fontSize: 20, fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.03em" }}>Kambeng</span>
          </Link>
        </div>

        <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "32px", boxShadow: "0 24px 80px rgba(0,0,0,0.5)" }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.03em", marginBottom: 6 }}>Reset your password</div>
            <div style={{ fontSize: 13, color: "#6b7a8d" }}>Enter your email and we'll send you a reset link.</div>
          </div>

          {sent ? (
            <div style={{ padding: "16px", borderRadius: 10, background: "rgba(27,191,136,0.08)", border: "1px solid rgba(27,191,136,0.2)", color: "#1bbf88", fontSize: 13, textAlign: "center" }}>
              Reset link sent! Check your inbox. Redirecting…
            </div>
          ) : (
            <form onSubmit={(e) => void onSubmit(e)} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#8899aa", display: "block", marginBottom: 6 }}>Email address</label>
                <input
                  {...form.register("email")}
                  type="email"
                  placeholder="name@example.com"
                  autoComplete="email"
                  style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(29,197,255,0.4)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
                />
                <FieldError msg={form.formState.errors.email?.message} />
              </div>

              {submitError && (
                <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", fontSize: 13, color: "#fca5a5" }}>{submitError}</div>
              )}

              <button type="submit" disabled={form.formState.isSubmitting} style={{ width: "100%", padding: "13px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${BLUE}, #079bd4)`, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 20px rgba(29,197,255,0.35)", opacity: form.formState.isSubmitting ? 0.7 : 1 }}>
                {form.formState.isSubmitting ? "Sending…" : "Send reset link"}
              </button>

              <div style={{ display: "flex", gap: 10 }}>
                <Link href="/auth/login" style={{ flex: 1 }}>
                  <button type="button" style={{ width: "100%", padding: "10px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#8899aa", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Back to Login</button>
                </Link>
                <Link href="/auth/signup" style={{ flex: 1 }}>
                  <button type="button" style={{ width: "100%", padding: "10px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#8899aa", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Create Account</button>
                </Link>
              </div>
            </form>
          )}
        </div>

        <div style={{ textAlign: "center", marginTop: 20, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Image src="/wave.png" alt="Wave" width={16} height={16} style={{ objectFit: "contain", borderRadius: 3 }} />
          <span style={{ fontSize: 12, color: "#4a5568" }}>Powered by Wave Mobile Money</span>
        </div>
      </div>
    </div>
  );
}
