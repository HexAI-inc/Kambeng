"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import axios from "axios";
import { api } from "@/lib/api";

const BLUE = "#1dc5ff";
const GREEN = "#1bbf88";

const verifyEmailSchema = z.object({
  code: z.string().min(1, "Enter the verification code."),
});
type VerifyEmailValues = z.infer<typeof verifyEmailSchema>;

const credentialSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  waveNumber: z.string().min(6, "Enter your Wave number."),
});
type CredentialValues = z.infer<typeof credentialSchema>;

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{msg}</div>;
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px", borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)",
  color: "#f0f6ff", fontSize: 16, outline: "none", boxSizing: "border-box",
  transition: "border-color 0.2s",
};

export function VerifyEmailForm({
  fullName,
  userEmail,
  waveNumber,
  initialCodeSent = false,
  isLoggedIn = false,
}: {
  fullName?: string;
  userEmail?: string;
  waveNumber?: string;
  initialCodeSent?: boolean;
  isLoggedIn?: boolean;
}) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(initialCodeSent);
  const [verified, setVerified] = useState(false);
  const [notice, setNotice] = useState<string | null>(
    initialCodeSent ? "Verification code sent. Check your inbox and enter the code below." : null,
  );
  // shown when we need to collect email + wave number from an anonymous user
  const [showCredentialForm, setShowCredentialForm] = useState(false);

  const effectiveEmail = userEmail ?? (typeof window !== "undefined" ? window.localStorage.getItem("kambeng_onboarding_email") ?? undefined : undefined);
  const effectiveWaveNumber = waveNumber ?? (typeof window !== "undefined" ? window.localStorage.getItem("kambeng_onboarding_wave_number") ?? undefined : undefined);
  const effectiveVerificationCode = typeof window !== "undefined" ? window.localStorage.getItem("kambeng_onboarding_verification_code") ?? undefined : undefined;

  if (typeof window !== "undefined") {
    if (userEmail) window.localStorage.setItem("kambeng_onboarding_email", userEmail);
    if (waveNumber) window.localStorage.setItem("kambeng_onboarding_wave_number", waveNumber);
  }

  const codeForm = useForm<VerifyEmailValues>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: { code: "" },
  });

  const credForm = useForm<CredentialValues>({
    resolver: zodResolver(credentialSchema),
    defaultValues: { email: effectiveEmail ?? "", waveNumber: effectiveWaveNumber ?? "" },
  });

  const getErrorMessage = (err: unknown, fallback: string) => {
    if (axios.isAxiosError(err)) {
      const detail = err.response?.data?.detail;
      if (typeof detail === "string" && detail) return detail;
    }
    return err instanceof Error ? err.message : fallback;
  };

  const doRequestCode = async (email?: string, wave?: string) => {
    setSending(true); setError(null); setSuccess(null);
    try {
      // If logged in, send empty body — JWT cookie authenticates the user.
      // If credentials are provided, send them. Backend prefers credentials
      // over JWT when both email+wave_number are present.
      const hasCredentials = email && wave;
      const body = hasCredentials
        ? { email, wave_number: wave, code: effectiveVerificationCode }
        : {};

      const response = await api.post("/auth/request-email-verification", body);
      const verificationCode = response.headers?.["x-verification-code"];
      if (verificationCode) {
        window.localStorage.setItem("kambeng_onboarding_verification_code", verificationCode as string);
      }
      setNotice("Verification code sent! Check your inbox.");
      setSuccess("Verification code sent! Check your inbox.");
      setCodeSent(true);
      setShowCredentialForm(false);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to send verification code."));
    } finally {
      setSending(false);
    }
  };

  const onRequestCode = async () => {
    const hasContext = effectiveEmail && effectiveWaveNumber;
    if (hasContext) {
      await doRequestCode(effectiveEmail, effectiveWaveNumber);
    } else if (isLoggedIn) {
      // JWT cookie is sufficient — no credentials needed in body
      await doRequestCode();
    } else {
      // Anonymous user with no context — collect credentials first
      setShowCredentialForm(true);
    }
  };

  const onSubmitCredentials = credForm.handleSubmit(async (values) => {
    window.localStorage.setItem("kambeng_onboarding_email", values.email);
    window.localStorage.setItem("kambeng_onboarding_wave_number", values.waveNumber);
    await doRequestCode(values.email, values.waveNumber);
  });

  const onVerify = codeForm.handleSubmit(async (values) => {
    const email = effectiveEmail ?? credForm.getValues("email");
    const wave = effectiveWaveNumber ?? credForm.getValues("waveNumber");

    if (!email || !wave) {
      setError("Missing account details. Please enter your email and Wave number above.");
      return;
    }

    setError(null);
    try {
      await api.post("/auth/verify-email", {
        code: values.code.trim(),
        email,
        wave_number: wave,
      });
      setSuccess("Email verified successfully!");
      setVerified(true);
      setCodeSent(false);
      codeForm.reset({ code: "" });
    } catch (err) {
      setError(getErrorMessage(err, "Invalid or expired verification code."));
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
            <div style={{ fontSize: 13, color: "#6b7a8d", lineHeight: 1.6 }}>
              {fullName ? <div style={{ marginBottom: 4, color: "#f0f6ff", fontWeight: 600 }}>Welcome, {fullName}.</div> : null}
              {effectiveEmail
                ? `We'll send a code to ${effectiveEmail}.`
                : "Enter your details below to receive a verification code."}
              {effectiveWaveNumber ? <div>Wave: <span style={{ color: "#f0f6ff", fontFamily: "monospace" }}>{effectiveWaveNumber}</span></div> : null}
            </div>
          </div>

          {notice && !success && (
            <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(27,191,136,0.08)", border: "1px solid rgba(27,191,136,0.2)", fontSize: 13, color: GREEN, marginBottom: 16 }}>{notice}</div>
          )}
          {success && (
            <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(27,191,136,0.08)", border: "1px solid rgba(27,191,136,0.2)", fontSize: 13, color: GREEN, marginBottom: 16 }}>{success}</div>
          )}
          {error && (
            <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", fontSize: 13, color: "#fca5a5", marginBottom: 16 }}>{error}</div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {verified ? (
              <Link
                href="/dashboard"
                style={{ width: "100%", padding: "13px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${BLUE}, #079bd4)`, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 20px rgba(29,197,255,0.35)", textDecoration: "none", textAlign: "center" }}
              >
                Go to dashboard
              </Link>
            ) : null}

            {/* Credential collection form — shown when user has no localStorage context */}
            {!verified && showCredentialForm && (
              <form onSubmit={(e) => void onSubmitCredentials(e)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#8899aa", display: "block", marginBottom: 6 }}>Email address</label>
                  <input
                    {...credForm.register("email")}
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    style={inputStyle}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(29,197,255,0.4)"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
                  />
                  <FieldError msg={credForm.formState.errors.email?.message} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#8899aa", display: "block", marginBottom: 6 }}>Wave number</label>
                  <input
                    {...credForm.register("waveNumber")}
                    type="tel"
                    placeholder="+220XXXXXXXX"
                    autoComplete="tel"
                    style={inputStyle}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(29,197,255,0.4)"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
                  />
                  <FieldError msg={credForm.formState.errors.waveNumber?.message} />
                </div>
                <button type="submit" disabled={sending} style={{ width: "100%", padding: "13px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${BLUE}, #079bd4)`, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 20px rgba(29,197,255,0.35)", opacity: sending ? 0.7 : 1 }}>
                  {sending ? "Sending…" : "Send verification code"}
                </button>
                <button type="button" onClick={() => setShowCredentialForm(false)} style={{ width: "100%", padding: "11px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#8899aa", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Cancel
                </button>
              </form>
            )}

            {/* Initial send — no code sent yet */}
            {!verified && !codeSent && !showCredentialForm ? (
              <button onClick={() => void onRequestCode()} disabled={sending} style={{ width: "100%", padding: "13px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${BLUE}, #079bd4)`, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 20px rgba(29,197,255,0.35)", opacity: sending ? 0.7 : 1 }}>
                {sending ? "Sending…" : "Send verification code"}
              </button>
            ) : null}

            {/* Code entry + resend */}
            {!verified && codeSent && !showCredentialForm ? (
              <form onSubmit={(e) => void onVerify(e)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#8899aa", display: "block", marginBottom: 6 }}>Verification code</label>
                  <input
                    {...codeForm.register("code")}
                    placeholder="• • • • • •"
                    maxLength={6}
                    inputMode="numeric"
                    style={{ ...inputStyle, letterSpacing: "0.2em", textAlign: "center" }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(29,197,255,0.4)"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
                  />
                  <FieldError msg={codeForm.formState.errors.code?.message} />
                </div>

                <button type="submit" disabled={codeForm.formState.isSubmitting} style={{ width: "100%", padding: "13px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${BLUE}, #079bd4)`, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 20px rgba(29,197,255,0.35)", opacity: codeForm.formState.isSubmitting ? 0.7 : 1 }}>
                  {codeForm.formState.isSubmitting ? "Verifying…" : "Verify email"}
                </button>

                <button type="button" onClick={() => void onRequestCode()} disabled={sending} style={{ width: "100%", padding: "11px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#8899aa", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: sending ? 0.6 : 1 }}>
                  {sending ? "Sending…" : "Resend code"}
                </button>
              </form>
            ) : null}

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
