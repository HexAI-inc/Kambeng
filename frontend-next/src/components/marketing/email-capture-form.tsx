"use client";

import { useState } from "react";

const BLUE = "#1dc5ff";
const GREEN = "#1bbf88";

export type CaptureSource = "homepage" | "campaign_follow" | "post_donation" | "waitlist" | "guide";

type Props = {
  source: CaptureSource;
  campaignSlug?: string;
  placeholder?: string;
  buttonLabel?: string;
  successMessage?: string;
  onSubscribed?: () => void;
};

export default function EmailCaptureForm({
  source,
  campaignSlug,
  placeholder = "Your email address",
  buttonLabel = "Subscribe",
  successMessage = "Check your inbox to confirm your subscription.",
  onSubscribed,
}: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || status === "sending") return;
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/backend/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source, campaign_slug: campaignSlug ?? null }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(typeof payload?.detail === "string" ? payload.detail : "Something went wrong. Please try again.");
      }
      setStatus("done");
      onSubscribed?.();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  };

  if (status === "done") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 18px", borderRadius: 12, background: "rgba(27,191,136,0.08)", border: "1px solid rgba(27,191,136,0.3)" }}>
        <span style={{ color: GREEN, fontWeight: 900, fontSize: 16 }}>✓</span>
        <span style={{ color: GREEN, fontSize: 14, fontWeight: 600 }}>{successMessage}</span>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ width: "100%" }}>
      <div className="capture-row" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={placeholder}
          style={{
            flex: "1 1 220px", minWidth: 0, padding: "13px 16px", borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)",
            color: "#f0f6ff", fontSize: 14, outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={status === "sending"}
          style={{
            padding: "13px 24px", borderRadius: 12, border: "none", whiteSpace: "nowrap",
            background: `linear-gradient(135deg, ${BLUE}, #079bd4)`, color: "#fff",
            fontSize: 14, fontWeight: 700, cursor: status === "sending" ? "wait" : "pointer",
            opacity: status === "sending" ? 0.7 : 1, boxShadow: "0 4px 20px rgba(29,197,255,0.3)",
          }}
        >
          {status === "sending" ? "Sending…" : buttonLabel}
        </button>
      </div>
      {error && <div style={{ marginTop: 8, fontSize: 13, color: "#ef4444" }}>{error}</div>}
    </form>
  );
}
