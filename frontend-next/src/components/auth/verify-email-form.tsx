"use client";

import Link from "next/link";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  AppAlert,
  AppButton,
  AppForm,
  AppInputField,
  AppText,
  AuthShell,
} from "@/components/ui";
import { api } from "@/lib/api";

const verifyEmailSchema = z.object({
  code: z.string().min(1, "Enter the verification code."),
});

type VerifyEmailValues = z.infer<typeof verifyEmailSchema>;

type VerifyEmailFormProps = {
  userEmail?: string;
};

export function VerifyEmailForm({ userEmail }: VerifyEmailFormProps) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);

  const form = useForm<VerifyEmailValues>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: { code: "" },
  });

  const onRequestCode = async () => {
    setSending(true);
    setError(null);
    setSuccess(null);

    try {
      await api.post("/auth/request-email-verification");
      setSuccess("Verification code sent to your email. Check your inbox.");
      setCodeSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send verification code.");
    } finally {
      setSending(false);
    }
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
    <AuthShell
      title="Verify your email"
      description="Confirming your email address helps keep your Kambeng account secure and ensures you can receive important updates."
      aside={
        <div
          style={{
            padding: 18,
            borderRadius: 0,
            background: "linear-gradient(135deg, rgba(29,197,255,0.14), rgba(255,255,255,0.68))",
            border: "1px solid rgba(29,197,255,0.18)",
            backdropFilter: "blur(12px)",
            maxWidth: 460,
          }}
        >
          <AppText strong>Why verify?</AppText>
          <ul style={{ marginTop: 8, marginBottom: 0, fontSize: 13, lineHeight: 1.6 }}>
            <li>Secure your account</li>
            <li>Unlock premium features</li>
            <li>Manage withdrawals safely</li>
          </ul>
          <div style={{ marginTop: 8 }}>
            <Link href="/dashboard">Back to Dashboard</Link>
          </div>
        </div>
      }
    >
      <AppForm layout="vertical" onFinish={() => void onVerify()} style={{ width: "100%" }}>
        <AppText type="secondary" style={{ fontSize: 13 }}>
          {userEmail ? `We'll send a code to ${userEmail}` : "We'll send a verification code to your email address"}
        </AppText>

        {!codeSent ? (
          <AppButton block type="primary" size="large" onClick={() => void onRequestCode()} loading={sending}>
            Send verification code
          </AppButton>
        ) : (
          <>
            <AppInputField
              name="code"
              control={form.control}
              label="Verification code"
              inputProps={{ placeholder: "Enter 6-digit code", maxLength: 6, inputMode: "numeric" }}
            />
            <AppButton block type="primary" size="large" htmlType="submit">
              Verify email
            </AppButton>
            <AppButton block onClick={() => void onRequestCode()} loading={sending}>
              Resend code
            </AppButton>
          </>
        )}

        {error ? <AppAlert type="error" title={error} showIcon /> : null}
        {success ? <AppAlert type="success" title={success} showIcon /> : null}
        <AppText type="secondary" style={{ fontSize: 13, lineHeight: 1.6 }}>
          The verification code expires in 10 minutes. Check your spam folder if you don&apos;t see the email.
        </AppText>
      </AppForm>
    </AuthShell>
  );
}
