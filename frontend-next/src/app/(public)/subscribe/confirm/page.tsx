"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const BLUE = "#1dc5ff";
const GREEN = "#1bbf88";
const RED = "#ef4444";

function ConfirmContent() {
  const searchParams = useSearchParams();
  const token = searchParams?.get("token");
  const [requestState, setRequestState] = useState<"loading" | "confirmed" | "error">("loading");
  const calledRef = useRef(false);

  useEffect(() => {
    if (!token || calledRef.current) return;
    calledRef.current = true;
    fetch(`/api/backend/subscribe/confirm?token=${encodeURIComponent(token)}`)
      .then((r) => setRequestState(r.ok ? "confirmed" : "error"))
      .catch(() => setRequestState("error"));
  }, [token]);

  const state = token ? requestState : "error";
  const color = state === "confirmed" ? GREEN : state === "error" ? RED : BLUE;

  return (
    <div style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px" }}>
      <div style={{ width: "100%", maxWidth: 440, textAlign: "center" }}>
        <div style={{
          width: 72, height: 72, borderRadius: "50%", margin: "0 auto 24px",
          border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 28, fontWeight: 900, color,
        }}>
          {state === "confirmed" ? "✓" : state === "error" ? "✕" : (
            <div style={{ width: 28, height: 28, border: `3px solid ${BLUE}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.9s linear infinite" }} />
          )}
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.03em", marginBottom: 10 }}>
          {state === "confirmed" ? "You're subscribed!" : state === "error" ? "Link not valid" : "Confirming…"}
        </h1>
        <p style={{ fontSize: 14, color: "#8899aa", lineHeight: 1.7, marginBottom: 28 }}>
          {state === "confirmed"
            ? "Thanks for confirming. You'll get one short email a week from Kambeng — no spam, unsubscribe anytime."
            : state === "error"
              ? "This confirmation link is invalid or has expired. Try subscribing again from the homepage."
              : "One moment while we confirm your email."}
        </p>
        <Link href="/campaigns" style={{ display: "inline-block", padding: "13px 28px", borderRadius: 10, background: `linear-gradient(135deg, ${BLUE}, #079bd4)`, color: "#fff", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
          Browse live campaigns
        </Link>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function SubscribeConfirmPage() {
  return (
    <Suspense>
      <ConfirmContent />
    </Suspense>
  );
}
