import { LoginFormCard } from "@/components/auth/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; message?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const nextTarget = resolvedSearchParams.next || "/dashboard";

  return (
    <LoginFormCard
      nextTarget={nextTarget}
      errorMessage={resolvedSearchParams.error}
      successMessage={resolvedSearchParams.message === "signup_success" ? "Account created. You can log in now." : undefined}
    />
  );
}
