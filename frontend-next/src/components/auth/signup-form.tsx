"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

const BLUE = "#1dc5ff";
const GREEN = "#1bbf88";

const signupSchema = z.object({
  fullName: z.string().min(2, "Enter your full name."),
  email: z.string().email("Enter a valid email address."),
  waveNumber: z.string().min(6, "Enter your Wave number."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});
type SignupFormValues = z.infer<typeof signupSchema>;

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{msg}</div>;
}

export function SignupFormCard({ errorMessage }: { errorMessage?: string }) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(errorMessage ?? null);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: "", email: "", waveNumber: "+220", password: "" },
  });

  const onSignup = form.handleSubmit(async (values) => {
    setSubmitError(null);
    const response = await fetch("/api/backend/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: values.fullName.trim(),
        email: values.email.trim(),
        wave_number: values.waveNumber.trim(),
        password: values.password,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) { setSubmitError(payload?.detail ?? "Signup failed."); return; }
    router.replace("/auth/login?message=signup_success");
  });

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "11px 14px", borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)",
    color: "#f0f6ff", fontSize: 14, outline: "none", boxSizing: "border-box",
    transition: "border-color 0.2s",
  };

  const fields = [
    { name: "fullName" as const, label: "Full name", placeholder: "Omar Keita", type: "text", autoComplete: "name", autoFocus: true },
    { name: "email" as const, label: "Email", placeholder: "you@example.com", type: "email", autoComplete: "email" },
    { name: "waveNumber" as const, label: "Wave number", placeholder: "+220XXXXXXXX", type: "tel", autoComplete: "tel" },
    { name: "password" as const, label: "Password", placeholder: "Min 8 characters", type: "password", autoComplete: "new-password" },
  ];

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0f1a",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px 16px", position: "relative", overflow: "hidden",
    }}>
      {/* Background glows */}
      <div style={{ position: "absolute", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(29,197,255,0.08) 0%, transparent 70%)", right: "-20%", top: "-20%", pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(27,191,136,0.06) 0%, transparent 70%)", left: "-10%", bottom: "-10%", pointerEvents: "none" }} />

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
            <div style={{ fontSize: 22, fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.03em", marginBottom: 6 }}>Create your account</div>
            <div style={{ fontSize: 13, color: "#6b7a8d" }}>Join Kambeng to support campaigns and track your donations.</div>
          </div>

          {submitError && (
            <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", fontSize: 13, color: "#fca5a5", marginBottom: 16 }}>
              {submitError}
            </div>
          )}

          <form onSubmit={(e) => void onSignup(e)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {fields.map(({ name, label, placeholder, type, autoComplete, autoFocus }) => (
              <div key={name}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#8899aa", display: "block", marginBottom: 6 }}>{label}</label>
                <input
                  {...form.register(name)}
                  type={type}
                  placeholder={placeholder}
                  autoComplete={autoComplete}
                  autoFocus={autoFocus}
                  style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(29,197,255,0.4)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
                />
                <FieldError msg={form.formState.errors[name]?.message} />
              </div>
            ))}

            <button
              type="submit"
              disabled={form.formState.isSubmitting}
              style={{
                width: "100%", padding: "13px", borderRadius: 10, border: "none",
                background: `linear-gradient(135deg, ${BLUE}, #079bd4)`,
                color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
                boxShadow: "0 4px 20px rgba(29,197,255,0.35)",
                opacity: form.formState.isSubmitting ? 0.7 : 1,
                marginTop: 4,
              }}
            >
              {form.formState.isSubmitting ? "Creating account…" : "Create account"}
            </button>
          </form>

          <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
            <span style={{ fontSize: 13, color: "#4a5568" }}>Already have an account? </span>
            <Link href="/auth/login" style={{ fontSize: 13, color: BLUE, fontWeight: 600 }}>Sign in</Link>
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
