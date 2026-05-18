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
  AppPasswordField,
  AppText,
  AuthShell,
} from "@/components/ui";
import { loginWithCredentials } from "@/lib/api";

const loginSchema = z.object({
  username: z.string().min(1, "Enter your email or wave number."),
  password: z.string().min(1, "Enter your password."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

type LoginFormCardProps = {
  nextTarget: string;
  errorMessage?: string;
  successMessage?: string;
};

export function LoginFormCard({ nextTarget, errorMessage, successMessage }: LoginFormCardProps) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "+2207000000",
      password: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);

    try {
      await loginWithCredentials(values.username, values.password);
      router.replace(nextTarget || "/dashboard");
      router.refresh();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to sign in. Please try again.");
    }
  });

  return (
    <AuthShell
      title="Sign in to Kambeng"
      description="Manage campaigns, reviews, and payments from one place. Use your email or wave number with your password."
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
          <AppText strong>Seeded admin account</AppText>
          <div style={{ marginTop: 8 }}>
            <AppText type="secondary">Wave number: +2207000000</AppText>
          </div>
          <div>
            <AppText type="secondary">Password: AdminPass123!</AppText>
          </div>
        </div>
      }
    >
      <form method="post" action="/api/auth/login" onSubmit={onSubmit} style={{ width: "100%" }}>
        <input type="hidden" name="next" value={nextTarget} />

        <AppInputField
          name="username"
          control={form.control}
          label="Email or Wave number"
          inputProps={{
            id: "login-username",
            name: "username",
            placeholder: "+2207000000 or name@example.com",
            autoComplete: "username",
          }}
        />
        <AppPasswordField
          name="password"
          control={form.control}
          label="Password"
          inputProps={{
            id: "login-password",
            name: "password",
            placeholder: "Your password",
            autoComplete: "current-password",
          }}
        />

        <AppButton htmlType="submit" type="primary" size="large" block loading={form.formState.isSubmitting}>
          Login
        </AppButton>

        <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
          <Link href="/auth/forgot-password" style={{ fontSize: 13, color: "var(--wave-blue-deep)" }}>
            Forgot password?
          </Link>
          <Link href="/auth/verify-email" style={{ fontSize: 13, color: "var(--wave-blue-deep)" }}>
            Verify email
          </Link>
        </div>

        <AppText type="secondary" style={{ fontSize: 13, lineHeight: 1.6 }}>
          Admin access uses the seeded account above. The login session is stored in secure httpOnly cookies.
        </AppText>

        {successMessage ? <AppAlert type="success" title={successMessage} showIcon /> : null}
        {errorMessage ? <AppAlert type="error" title={errorMessage} showIcon /> : null}
        {submitError ? <AppAlert type="error" title={submitError} showIcon /> : null}
      </form>
    </AuthShell>
  );
}
