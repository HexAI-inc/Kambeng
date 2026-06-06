import { requireUser } from "@/lib/server-auth";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireUser("/dashboard");

  return <DashboardShell>{children}</DashboardShell>;
}
