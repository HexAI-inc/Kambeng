import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { AuthUser } from "@/lib/api";

const BACKEND_API_BASE = process.env.BACKEND_API_BASE_URL ?? "http://127.0.0.1:8001/api";
const ACCESS_COOKIE = "kambeng_access_token";

export async function getServerSession(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE)?.value;
  if (!token) return null;

  try {
    const response = await fetch(`${BACKEND_API_BASE}/auth/me`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!response.ok) return null;
    return (await response.json()) as AuthUser;
  } catch {
    return null;
  }
}

export async function requireUser(nextPath?: string): Promise<AuthUser> {
  const session = await getServerSession();
  if (!session) {
    const suffix = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
    redirect(`/auth/login${suffix}`);
  }
  return session;
}

export async function requireAdmin(nextPath?: string): Promise<AuthUser> {
  const session = await requireUser(nextPath);
  if (session.role !== "ADMIN") {
    redirect("/dashboard");
  }
  return session;
}
