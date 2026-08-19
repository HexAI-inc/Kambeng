"use client";

import { useState } from "react";
import Link from "next/link";

const BLUE = "#1dc5ff";
const GREEN = "#1bbf88";

const STEPS = [
  { title: "Create your free account", detail: "Register in a couple of minutes — all you need is a phone number and email." },
  { title: "Verify your identity", detail: "Upload a clear photo of your ID (national ID, passport, or driver's licence). We review within 24 hours — this is what makes donors trust your campaign." },
  { title: "Set up your campaign", detail: "Title, story, target — and break it into milestones so donors can see exactly what their money achieves at each stage." },
  { title: "Go live and share", detail: "Share your campaign link on WhatsApp. Donations arrive through Wave, and you post proof as you spend." },
];

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "13px 16px", borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)",
  color: "#f0f6ff", fontSize: 14, outline: "none", boxSizing: "border-box",
};

export default function StartPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [goal, setGoal] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/backend/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          source: "waitlist",
          name: name.trim() || null,
          phone: phone.trim() || null,
          fundraising_goal: goal.trim() || null,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(typeof payload?.detail === "string" ? payload.detail : "Something went wrong. Please try again.");
      }
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  };

  return (
    <div style={{ padding: "48px clamp(16px, 5vw, 72px) 96px" }}>
      <div className="start-grid" style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "start" }}>

        {/* Left: pitch + steps */}
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "4px 14px", borderRadius: 20, background: `${BLUE}15`, border: `1px solid ${BLUE}30`, fontSize: 11, color: BLUE, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 18 }}>
            For organisers
          </div>
          <h1 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.04em", lineHeight: 1.1, margin: "0 0 16px" }}>
            Raise money for your community — with proof donors can trust
          </h1>
          <p style={{ color: "#8899aa", fontSize: 15, lineHeight: 1.8, marginBottom: 36 }}>
            Kambeng gives your school, mosque, church, or community group a verified fundraising page, digital payments through Wave, and automatic proof-of-spending records. Setup takes about 10 minutes and costs nothing upfront — we only take a small commission on successful donations.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {STEPS.map((step, i) => (
              <div key={step.title} style={{ display: "flex", gap: 14, padding: "16px 18px", borderRadius: 14, background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ flexShrink: 0, width: 30, height: 30, borderRadius: "50%", background: `${BLUE}18`, border: `1px solid ${BLUE}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: BLUE }}>
                  {i + 1}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#f0f6ff", marginBottom: 4 }}>{step.title}</div>
                  <div style={{ fontSize: 13, color: "#8899aa", lineHeight: 1.65 }}>{step.detail}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 24, fontSize: 13, color: "#6b7a8d", lineHeight: 1.7 }}>
            Ready right now? <Link href="/auth/signup" style={{ color: BLUE, fontWeight: 600 }}>Create your account</Link> and your campaign could be live tomorrow.
          </div>
        </div>

        {/* Right: waitlist form */}
        <div style={{ position: "sticky", top: 88, background: "#0d1120", border: "1px solid rgba(29,197,255,0.18)", borderRadius: 20, padding: "28px clamp(20px, 3vw, 32px) 32px" }}>
          {status === "done" ? (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div style={{ width: 60, height: 60, borderRadius: "50%", margin: "0 auto 18px", border: `2px solid ${GREEN}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 900, color: GREEN }}>✓</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#f0f6ff", marginBottom: 8 }}>You&apos;re on the list!</div>
              <p style={{ fontSize: 13, color: "#8899aa", lineHeight: 1.7, marginBottom: 20 }}>
                Check your inbox to confirm your email — then we&apos;ll walk you through everything, step by step. Want to skip ahead?
              </p>
              <Link href="/auth/signup" style={{ display: "inline-block", padding: "12px 24px", borderRadius: 10, background: `linear-gradient(135deg, ${BLUE}, #079bd4)`, color: "#fff", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
                Create your account now
              </Link>
            </div>
          ) : (
            <form onSubmit={submit}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#f0f6ff", marginBottom: 6 }}>Join the organiser waitlist</div>
              <p style={{ fontSize: 13, color: "#8899aa", lineHeight: 1.65, marginBottom: 22 }}>
                Tell us a little about your cause and we&apos;ll help you get set up — personally.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#8899aa", marginBottom: 6 }}>Your name</label>
                  <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fatou Ceesay" style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#8899aa", marginBottom: 6 }}>Email</label>
                  <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#8899aa", marginBottom: 6 }}>Phone <span style={{ fontWeight: 400, color: "#4a5568" }}>(optional)</span></label>
                  <input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+220 …" style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#8899aa", marginBottom: 6 }}>What do you want to raise funds for?</label>
                  <textarea required value={goal} onChange={(e) => setGoal(e.target.value)} rows={3} placeholder="e.g. New roof for Latrikunda school" style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
                </div>
                <button
                  type="submit"
                  disabled={status === "sending"}
                  style={{ marginTop: 4, padding: "14px 20px", borderRadius: 12, border: "none", background: `linear-gradient(135deg, ${BLUE}, #079bd4)`, color: "#fff", fontSize: 15, fontWeight: 700, cursor: status === "sending" ? "wait" : "pointer", opacity: status === "sending" ? 0.7 : 1, boxShadow: "0 6px 24px rgba(29,197,255,0.3)" }}
                >
                  {status === "sending" ? "Joining…" : "Join the waitlist"}
                </button>
                {error && <div style={{ fontSize: 13, color: "#ef4444" }}>{error}</div>}
                <div style={{ fontSize: 11, color: "#4a5568", lineHeight: 1.6 }}>
                  We&apos;ll only email you about getting your campaign live. Unsubscribe anytime.
                </div>
              </div>
            </form>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .start-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
