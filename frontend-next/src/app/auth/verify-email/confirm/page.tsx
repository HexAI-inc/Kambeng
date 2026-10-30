import Link from "next/link";
import { headers } from "next/headers";
import { BrandMark } from "@/components/layout/brand-mark";
import { forwardedForHeaders } from "@/lib/forwarded-for";

const BACKEND_API_BASE = process.env.BACKEND_API_BASE_URL ?? "http://127.0.0.1:8001/api";

type Outcome = { ok: boolean; title: string; body: string };

async function confirm(token: string | undefined): Promise<Outcome> {
  const invalid = { ok: false, title: "This link didn't work", body: "It may have expired or been replaced by a newer one. Sign in and request a new verification email from your dashboard." };
  if (!token) return invalid;
  try {
    const res = await fetch(`${BACKEND_API_BASE}/auth/verify-email-link`, {
      method: "POST",
      headers: { "content-type": "application/json", ...forwardedForHeaders({ headers: await headers() }) },
      body: JSON.stringify({ token }),
      cache: "no-store",
    });
    if (!res.ok) return invalid;
    const data = (await res.json()) as { status: string; email?: string };
    return data.status === "already_verified"
      ? { ok: true, title: "Already confirmed", body: `${data.email ?? "Your email"} was already verified. You're all set.` }
      : { ok: true, title: "Email confirmed", body: `Thanks — ${data.email ?? "your email"} is verified. You'll now get receipts, campaign updates and account alerts.` };
  } catch {
    return { ok: false, title: "Something went wrong", body: "We couldn't confirm your email right now. Please open the link again in a minute." };
  }
}

export default async function ConfirmEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const outcome = await confirm((await searchParams).token);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <BrandMark size={40} />
            <span style={{ fontSize: 20, fontWeight: 900, color: "#15201a", letterSpacing: "-0.03em" }}>Kambeng</span>
          </Link>
        </div>
        <div style={{ background: "#ffffff", border: "1px solid rgba(21,32,26,0.08)", borderRadius: 20, padding: 32, boxShadow: "0 24px 80px rgba(21,32,26,0.12)", textAlign: "center" }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center",
            background: outcome.ok ? "#e6f4ec" : "#fdecec", color: outcome.ok ? "#14784a" : "#c0392b", fontSize: 24, fontWeight: 900,
          }}>
            {outcome.ok ? "✓" : "!"}
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: "#15201a", letterSpacing: "-0.03em", margin: "0 0 8px" }}>{outcome.title}</h1>
          <p style={{ fontSize: 14, color: "#626d66", lineHeight: 1.6, margin: "0 0 24px" }}>{outcome.body}</p>
          <Link href={outcome.ok ? "/dashboard" : "/auth/login"} style={{ display: "block", padding: "12px 0", borderRadius: 11, background: "#14784a", color: "#fff", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
            {outcome.ok ? "Go to my dashboard" : "Sign in"}
          </Link>
        </div>
      </div>
    </div>
  );
}
