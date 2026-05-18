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
  AppPasswordField,
  AppText,
  AuthShell,
} from "@/components/ui";

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(1, "Confirm your password."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

type ResetPasswordFormCardProps = {
  token: string;
};

export function ResetPasswordFormCard({ token }: ResetPasswordFormCardProps) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);

    const response = await fetch("/api/backend/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, new_password: values.password }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setSubmitError(payload?.detail ?? "Failed to reset password.");
      return;
    }

    router.push("/auth/login");
  });

  return (
    <AuthShell
      title="Create a new password"
      description="Enter a strong password below to secure your Kambeng account. Use a combination of letters, numbers, and symbols."
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
          <AppText strong>Password Tips</AppText>
          <ul style={{ marginTop: 8, marginBottom: 0, fontSize: 13, lineHeight: 1.6 }}>
            <li>At least 8 characters</li>
            <li>Mix of uppercase and lowercase</li>
            <li>Include numbers and symbols</li>
          </ul>
          <div style={{ marginTop: 8 }}>
            <Link href="/auth/login">Back to Login</Link>
          </div>
        </div>
      }
    >
      <AppForm layout="vertical" onFinish={() => void onSubmit()} style={{ width: "100%" }}>
        <AppPasswordField
          name="password"
          control={form.control}
          label="New password"
          inputProps={{ placeholder: "Create a strong password", autoComplete: "new-password" }}
        />
        <AppPasswordField
          name="confirmPassword"
          control={form.control}
          label="Confirm password"
          inputProps={{ placeholder: "Re-enter your password", autoComplete: "new-password" }}
        />

        <AppButton block type="primary" size="large" htmlType="submit">
          Reset password
        </AppButton>

        <AppAlert
          type="info"
          showIcon
          title="Your password will be updated immediately. You'll need to log in again with your new password."
        />
        {submitError ? <AppAlert type="error" title={submitError} showIcon /> : null}
      </AppForm>
    </AuthShell>
  );
}
