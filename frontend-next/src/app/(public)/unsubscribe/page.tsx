"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const token = searchParams?.get("token");
  const [requestState, setRequestState] = useState<"loading" | "done" | "error">("loading");
  const calledRef = useRef(false);

  useEffect(() => {
    if (!token || calledRef.current) return;
    calledRef.current = true;
    fetch(`/api/backend/unsubscribe?token=${encodeURIComponent(token)}`)
      .then((r) => setRequestState(r.ok ? "done" : "error"))
      .catch(() => setRequestState("error"));
  }, [token]);

  const state = token ? requestState : "error";

  return (
    <div style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px" }}>
      <div style={{ width: "100%", maxWidth: 440, textAlign: "center" }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.03em", marginBottom: 10 }}>
          {state === "done" ? "You've been unsubscribed" : state === "error" ? "Link not valid" : "One moment…"}
        </h1>
        <p style={{ fontSize: 14, color: "#8899aa", lineHeight: 1.7, marginBottom: 28 }}>
          {state === "done"
            ? "You won't receive any more marketing emails from Kambeng. If this was a mistake, you can subscribe again any time from the homepage."
            : state === "error"
              ? "This unsubscribe link is invalid or has already been used."
              : "Removing you from the list."}
        </p>
        <Link href="/" style={{ display: "inline-block", padding: "13px 28px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "#f0f6ff", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
          Back to Kambeng
        </Link>
      </div>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense>
      <UnsubscribeContent />
    </Suspense>
  );
}
