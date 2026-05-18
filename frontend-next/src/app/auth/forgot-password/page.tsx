import { ForgotPasswordFormCard } from "@/components/auth/forgot-password-form";

type ForgotPasswordPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const params = await searchParams;
  const nextTarget = typeof params.next === "string" ? params.next : "/auth/login";

  return (
    <main style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "24px" }}>
      <ForgotPasswordFormCard nextTarget={nextTarget} />
    </main>
  );
}
