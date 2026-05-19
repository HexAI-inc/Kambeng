"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/lib/api";

const BLUE = "#1dc5ff";

const verifyEmailSchema = z.object({
  code: z.string().min(1, "Enter the verification code."),
});
type VerifyEmailValues = z.infer<typeof verifyEmailSchema>;

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{msg}</div>;
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px", borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)",
  color: "#f0f6ff", fontSize: 14, outline: "none", boxSizing: "border-box",
  transition: "border-color 0.2s", letterSpacing: "0.2em", textAlign: "center",
};

export function VerifyEmailForm({ userEmail }: { userEmail?: string }) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);

  const form = useForm<VerifyEmailValues>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: { code: "" },
  });

  const onRequestCode = async () => {
    setSending(true); setError(null); setSuccess(null);
    try {
      await api.post("/auth/request-email-verification");
      setSuccess("Verification code sent! Check your inbox.");
      setCodeSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send verification code.");
    } finally { setSending(false); }
  };

  const onVerify = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await api.post("/auth/verify-email", { code: values.code.trim() });
      setSuccess("Email verified successfully!");
      setCodeSent(false);
      form.reset({ code: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid or expired verification code.");
    }
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
            <div style={{ fontSize: 22, fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.03em", marginBottom: 6 }}>Verify your email</div>
            <div style={{ fontSize: 13, color: "#6b7a8d" }}>
              {userEmail ? `We'll send a code to ${userEmail}` : "We'll send a verification code to your email address."}
            </div>
          </div>

          {success && (
            <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(27,191,136,0.08)", border: "1px solid rgba(27,191,136,0.2)", fontSize: 13, color: "#1bbf88", marginBottom: 16 }}>{success}</div>
          )}
          {error && (
            <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", fontSize: 13, color: "#fca5a5", marginBottom: 16 }}>{error}</div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {!codeSent ? (
              <button onClick={() => void onRequestCode()} disabled={sending} style={{ width: "100%", padding: "13px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${BLUE}, #079bd4)`, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 20px rgba(29,197,255,0.35)", opacity: sending ? 0.7 : 1 }}>
                {sending ? "Sending…" : "Send verification code"}
              </button>
            ) : (
              <form onSubmit={(e) => void onVerify(e)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#8899aa", display: "block", marginBottom: 6 }}>Verification code</label>
                  <input
                    {...form.register("code")}
                    placeholder="• • • • • •"
                    maxLength={6}
                    inputMode="numeric"
                    style={inputStyle}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(29,197,255,0.4)"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
                  />
                  <FieldError msg={form.formState.errors.code?.message} />
                </div>

                <button type="submit" disabled={form.formState.isSubmitting} style={{ width: "100%", padding: "13px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${BLUE}, #079bd4)`, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 20px rgba(29,197,255,0.35)", opacity: form.formState.isSubmitting ? 0.7 : 1 }}>
                  {form.formState.isSubmitting ? "Verifying…" : "Verify email"}
                </button>

                <button type="button" onClick={() => void onRequestCode()} disabled={sending} style={{ width: "100%", padding: "11px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#8899aa", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: sending ? 0.6 : 1 }}>
                  {sending ? "Sending…" : "Resend code"}
                </button>
              </form>
            )}

            <div style={{ fontSize: 12, color: "#4a5568", textAlign: "center", lineHeight: 1.6 }}>
              Code expires in 10 minutes. Check your spam folder if you don&apos;t see it.
            </div>

            <div style={{ paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
              <Link href="/dashboard" style={{ fontSize: 13, color: "#4a5568" }}>Back to Dashboard</Link>
            </div>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 20, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Image src="/wave.png" alt="Wave" width={16} height={16} style={{ objectFit: "contain", borderRadius: 3 }} />
          <span style={{ fontSize: 12, color: "#4a5568" }}>Powered by Wave Mobile Money</span>
        </div>
      </div>
    </div>
  );
}
