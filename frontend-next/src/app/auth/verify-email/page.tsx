import { VerifyEmailForm } from "@/components/auth/verify-email-form";
import { getServerSession } from "@/lib/server-auth";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ full_name?: string; email?: string; wave_number?: string; message?: string }>;
}) {
  const session = await getServerSession();
  const resolvedSearchParams = await searchParams;

  return (
    <main style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "24px" }}>
      <VerifyEmailForm
        fullName={resolvedSearchParams.full_name}
        userEmail={resolvedSearchParams.email ?? session?.email}
        waveNumber={resolvedSearchParams.wave_number}
        initialCodeSent={resolvedSearchParams.message === "signup_success"}
      />
    </main>
  );
}
