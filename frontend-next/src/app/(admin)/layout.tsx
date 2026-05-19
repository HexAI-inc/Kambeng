import { requireAdmin } from "@/lib/server-auth";
import { AdminShell } from "@/components/layout/admin-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin("/admin");

  return <AdminShell>{children}</AdminShell>;
}
