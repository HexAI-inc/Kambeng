"use client";

import Link from "next/link";
import Image from "next/image";

const BLUE = "#1dc5ff";

type OnboardingCardProps = {
  fullName?: string;
  email?: string;
  waveNumber?: string;
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ fontSize: 12, color: "#8899aa", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 13, color: "#f0f6ff", fontWeight: 600, textAlign: "right", wordBreak: "break-word" }}>{value}</div>
    </div>
  );
}

export function OnboardingCard({ fullName, email, waveNumber }: OnboardingCardProps) {
  const details = [
    { label: "Full name", value: fullName ?? "—" },
    { label: "Email", value: email ?? "—" },
    { label: "Wave number", value: waveNumber ?? "—" },
  ];

  const verifyLink = new URLSearchParams({
    full_name: fullName ?? "",
    email: email ?? "",
    wave_number: waveNumber ?? "",
    message: "signup_success",
  });

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0f1a",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px 16px", position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", width: 640, height: 640, borderRadius: "50%", background: "radial-gradient(circle, rgba(29,197,255,0.10) 0%, transparent 70%)", right: "-18%", top: "-18%", pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: 420, height: 420, borderRadius: "50%", background: "radial-gradient(circle, rgba(27,191,136,0.07) 0%, transparent 70%)", left: "-12%", bottom: "-12%", pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: 560, position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `linear-gradient(135deg, ${BLUE}, #079bd4)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900, color: "#fff" }}>K</div>
            <span style={{ fontSize: 20, fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.03em" }}>Kambeng</span>
          </Link>
        </div>

        <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 24, padding: 32, boxShadow: "0 24px 80px rgba(0,0,0,0.5)" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 999, background: "rgba(29,197,255,0.12)", color: BLUE, fontSize: 12, fontWeight: 700, marginBottom: 18 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: BLUE, display: "inline-block" }} />
            Account created
          </div>

          <div style={{ fontSize: 28, fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.04em", lineHeight: 1.1, marginBottom: 10 }}>
            Welcome{fullName ? `, ${fullName}` : ""}.
          </div>
          <div style={{ fontSize: 14, color: "#6b7a8d", lineHeight: 1.7, marginBottom: 24 }}>
            Your account is linked to the email and Wave number below. We’ve already sent a verification code to your inbox so you can finish setup and start using Kambeng.
          </div>

          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, padding: "4px 18px", marginBottom: 22 }}>
            {details.map((detail) => (
              <InfoRow key={detail.label} label={detail.label} value={detail.value} />
            ))}
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <Link
              href={`/auth/verify-email?${verifyLink.toString()}`}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: "100%", padding: "13px 16px", borderRadius: 12, border: "none",
                background: `linear-gradient(135deg, ${BLUE}, #079bd4)`, color: "#fff",
                fontSize: 14, fontWeight: 700, textDecoration: "none",
                boxShadow: "0 4px 20px rgba(29,197,255,0.35)",
              }}
            >
              Continue to email verification
            </Link>

            <Link
              href="/auth/login"
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: "100%", padding: "12px 16px", borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)",
                color: "#c9d3df", fontSize: 14, fontWeight: 600, textDecoration: "none",
              }}
            >
              I already verified, sign in
            </Link>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 20, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Image src="/wave.png" alt="Wave" width={16} height={16} style={{ objectFit: "contain", borderRadius: 3 }} />
          <span style={{ fontSize: 12, color: "#4a5568" }}>Powered by Wave Mobile Money</span>
        </div>
      </div>
    </div>
  );
}