import { ResetPasswordFormCard } from "@/components/auth/reset-password-form";
import { notFound } from "next/navigation";

type ResetPasswordPageProps = {
  params: Promise<{ token: string }>;
};

export default async function ResetPasswordPage({ params }: ResetPasswordPageProps) {
  const { token } = await params;

  if (!token) {
    notFound();
  }

  return (
    <main style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "24px" }}>
      <ResetPasswordFormCard token={token} />
    </main>
  );
}
