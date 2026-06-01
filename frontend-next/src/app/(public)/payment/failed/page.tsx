"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const BLUE = "#1dc5ff";
const RED = "#ef4444";

function PaymentFailedContent() {
  const searchParams = useSearchParams();
  const ref = searchParams?.get("ref");
  const slug = searchParams?.get("slug");

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1a", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px" }}>
      <div style={{ width: "100%", maxWidth: 460, textAlign: "center" }}>

        <div style={{
          width: 72, height: 72, borderRadius: "50%", margin: "0 auto 24px",
          background: "rgba(239,68,68,0.1)", border: `2px solid ${RED}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 32, color: RED,
        }}>
          ✕
        </div>

        <div style={{ fontSize: 24, fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.03em", marginBottom: 10 }}>
          Payment not completed
        </div>

        <div style={{ fontSize: 14, color: "#6b7a8d", lineHeight: 1.7, marginBottom: 28 }}>
          Your payment was cancelled or could not be completed. No funds have been taken from your account.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {slug && (
            <Link
              href={`/quick-pay/${slug}`}
              style={{ display: "block", padding: "13px", borderRadius: 10, background: `linear-gradient(135deg, ${BLUE}, #079bd4)`, color: "#fff", fontSize: 14, fontWeight: 700, textDecoration: "none", boxShadow: "0 4px 20px rgba(29,197,255,0.3)" }}
            >
              Try again
            </Link>
          )}
          {slug && (
            <Link
              href={`/campaigns/${slug}`}
              style={{ display: "block", padding: "12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#8899aa", fontSize: 14, fontWeight: 600, textDecoration: "none" }}
            >
              Back to campaign
            </Link>
          )}
          {!slug && (
            <Link href="/campaigns" style={{ display: "block", padding: "13px", borderRadius: 10, background: `linear-gradient(135deg, ${BLUE}, #079bd4)`, color: "#fff", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
              Browse campaigns
            </Link>
          )}
        </div>

        {ref && (
          <div style={{ marginTop: 24, fontSize: 11, color: "#2d3748" }}>
            Reference: {ref}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PaymentFailedPage() {
  return (
    <Suspense>
      <PaymentFailedContent />
    </Suspense>
  );
}
