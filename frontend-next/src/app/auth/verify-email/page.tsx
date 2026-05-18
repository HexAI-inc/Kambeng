import { VerifyEmailForm } from "@/components/auth/verify-email-form";
import { getServerSession } from "@/lib/server-auth";

export default async function VerifyEmailPage() {
  const session = await getServerSession();

  return (
    <main style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "24px" }}>
      <VerifyEmailForm userEmail={session?.email} />
    </main>
  );
}
