import { redirect } from "next/navigation";

// The settings module lives at /dashboard/profile; this alias keeps
// /dashboard/settings working as an address people expect.
export default function SettingsPage() {
  redirect("/dashboard/profile");
}
