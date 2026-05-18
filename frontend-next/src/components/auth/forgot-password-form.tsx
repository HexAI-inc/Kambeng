"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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

const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address."),
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

type ForgotPasswordFormCardProps = {
  nextTarget?: string;
};

export function ForgotPasswordFormCard({ nextTarget = "/auth/login" }: ForgotPasswordFormCardProps) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

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
    if (!response.ok) {
      setSubmitError(payload?.detail ?? "Failed to request password reset.");
      return;
    }

    router.push(nextTarget);
  });

  return (
    <AuthShell
      title="Reset your password"
      description="Enter the email address associated with your Kambeng account, and we'll send you a link to reset your password."
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
          <AppText strong>Remember your password?</AppText>
          <div style={{ marginTop: 8 }}>
            <Link href="/auth/login">Go to login</Link>
          </div>
        </div>
      }
    >
      <AppForm layout="vertical" onFinish={() => void onSubmit()} style={{ width: "100%" }}>
        <AppInputField
          name="email"
          control={form.control}
          label="Email address"
          inputProps={{ placeholder: "name@example.com", autoComplete: "email" }}
        />

        <AppButton block type="primary" size="large" htmlType="submit">
          Send reset link
        </AppButton>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <AppButton href="/auth/login">Back to Login</AppButton>
          <AppButton href="/auth/signup" type="default">
            Create Account
          </AppButton>
        </div>

        {submitError ? <AppAlert type="error" title={submitError} showIcon /> : null}
      </AppForm>
    </AuthShell>
  );
}
