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

const signupSchema = z.object({
  fullName: z.string().min(2, "Enter your full name."),
  email: z.string().email("Enter a valid email address."),
  waveNumber: z.string().min(6, "Enter your Wave number."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

type SignupFormValues = z.infer<typeof signupSchema>;

type SignupFormCardProps = {
  errorMessage?: string;
};

export function SignupFormCard({ errorMessage }: SignupFormCardProps) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(errorMessage ?? null);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: "",
      email: "",
      waveNumber: "+220",
      password: "",
    },
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
    if (!response.ok) {
      setSubmitError(payload?.detail ?? "Signup failed.");
      return;
    }

    router.replace("/auth/login?message=signup_success");
  });

  return (
    <AuthShell
      title="Create your Kambeng account"
      description="Join the crowdfunding platform, follow campaigns, and manage your contribution activity from a mobile-first dashboard."
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
          <AppText strong>Already have an account?</AppText>
          <div style={{ marginTop: 8 }}>
            <Link href="/auth/login">Go to login</Link>
          </div>
        </div>
      }
    >
      <AppForm layout="vertical" onFinish={() => void onSignup()} style={{ width: "100%" }}>
        <AppInputField
          name="fullName"
          control={form.control}
          label="Full name"
          inputProps={{ placeholder: "Your name", autoComplete: "name", autoFocus: true }}
        />
        <AppInputField
          name="email"
          control={form.control}
          label="Email"
          inputProps={{ placeholder: "you@example.com", autoComplete: "email" }}
        />
        <AppInputField
          name="waveNumber"
          control={form.control}
          label="Wave number"
          inputProps={{ placeholder: "+220XXXXXXXX", autoComplete: "tel" }}
        />
        <AppPasswordField
          name="password"
          control={form.control}
          label="Password"
          inputProps={{ placeholder: "Min 8 characters", autoComplete: "new-password" }}
        />

        <AppButton block type="primary" size="large" htmlType="submit" loading={form.formState.isSubmitting}>
          Create account
        </AppButton>

        {submitError ? <AppAlert type="error" title={submitError} showIcon /> : null}

        <AppText type="secondary" style={{ fontSize: 12, lineHeight: 1.5 }}>
          Takes less than a minute. Support campaigns, rate projects, and track donations in one place.
        </AppText>
      </AppForm>
    </AuthShell>
  );
}
