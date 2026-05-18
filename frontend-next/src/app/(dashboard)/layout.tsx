import { requireUser } from "@/lib/server-auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireUser("/dashboard");

  return <>{children}</>;
}
