"use client";

import { useState } from "react";
import Link from "next/link";
import EmailCaptureForm from "@/components/marketing/email-capture-form";

const BLUE = "#14784a";
const GREEN = "#1f9960";

const GUIDE_STEPS = [
  {
    title: "Set one clear, specific goal",
    body: "People give to “new roof for Latrikunda school” — not “support our school”. A specific goal tells donors exactly what their money will achieve, and makes your campaign easy to explain in one WhatsApp message.",
  },
  {
    title: "Break it into milestones",
    body: "Instead of asking for 50,000 GMD for “renovation”, ask for 15,000 for cement, then 20,000 for roofing, then 15,000 for paint. Donors trust phased targets they can track — and they come back to fund the next milestone.",
  },
  {
    title: "Verify yourself",
    body: "Upload your ID and get verified before you launch. Donors are far more likely to give to a campaign run by a real, verified person than to an anonymous collection. Verification takes minutes and lasts for every campaign you run.",
  },
  {
    title: "Show proof as you spend",
    body: "Photos and receipts turn one-time donors into repeat donors. Every time you spend campaign money, post the receipt and a photo of the work. Donors who can see their money at work give again — and tell others.",
  },
  {
    title: "Update your donors weekly",
    body: "Campaigns that post updates raise significantly more. One short update a week — a photo, a number, a thank-you — keeps your campaign alive in people's minds and their WhatsApp groups.",
  },
];

export default function GuidePage() {
  const [unlocked, setUnlocked] = useState(false);

  return (
    <div style={{ padding: "48px clamp(16px, 5vw, 72px) 96px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "4px 14px", borderRadius: 20, background: `${GREEN}15`, border: `1px solid ${GREEN}30`, fontSize: 11, color: GREEN, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 18 }}>
            Free guide
          </div>
          <h1 style={{ fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 900, color: "#15201a", letterSpacing: "-0.04em", lineHeight: 1.15, margin: "0 0 14px" }}>
            How to Run a Successful Community Fundraiser in The Gambia
          </h1>
          <p style={{ color: "#56625b", fontSize: 15, lineHeight: 1.75, maxWidth: 560, margin: "0 auto" }}>
            Five steps that separate campaigns that reach their target from campaigns that stall — learned from real Gambian community fundraisers.
          </p>
        </div>

        {!unlocked ? (
          <div style={{ background: "#ffffff", border: "1px solid rgba(20,120,74,0.18)", borderRadius: 20, padding: "32px clamp(20px, 4vw, 40px)" }}>
            {/* Teaser list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 26 }}>
              {GUIDE_STEPS.map((step, i) => (
                <div key={step.title} style={{ display: "flex", alignItems: "center", gap: 12, opacity: i === 0 ? 1 : 0.55 }}>
                  <div style={{ flexShrink: 0, width: 26, height: 26, borderRadius: "50%", background: `${BLUE}18`, border: `1px solid ${BLUE}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: BLUE }}>{i + 1}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#15201a" }}>{step.title}</div>
                  {i > 0 && <span style={{ marginLeft: "auto", fontSize: 11, color: "#6e7872" }}>🔒</span>}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#15201a", marginBottom: 6 }}>Get the full guide — free</div>
            <p style={{ fontSize: 13, color: "#56625b", lineHeight: 1.65, marginBottom: 16 }}>
              Enter your email and the complete guide unlocks right here. We&apos;ll also send you practical fundraising tips — unsubscribe anytime.
            </p>
            <EmailCaptureForm
              source="guide"
              buttonLabel="Unlock the guide"
              successMessage="Guide unlocked — check your inbox to confirm your subscription too."
              onSubscribed={() => setUnlocked(true)}
            />
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {GUIDE_STEPS.map((step, i) => (
                <div key={step.title} style={{ display: "flex", gap: 16, padding: "22px clamp(18px, 3vw, 28px)", borderRadius: 16, background: "#ffffff", border: "1px solid rgba(21,32,26,0.08)" }}>
                  <div style={{ flexShrink: 0, width: 34, height: 34, borderRadius: "50%", background: `${BLUE}18`, border: `1px solid ${BLUE}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: BLUE }}>{i + 1}</div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#15201a", marginBottom: 8, letterSpacing: "-0.02em" }}>{step.title}</div>
                    <div style={{ fontSize: 14, color: "#56625b", lineHeight: 1.75 }}>{step.body}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 32, textAlign: "center", padding: "32px clamp(20px, 4vw, 40px)", borderRadius: 20, background: "linear-gradient(135deg, rgba(20,120,74,0.1) 0%, rgba(15,94,58,0.06) 100%)", border: "1px solid rgba(20,120,74,0.18)" }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#15201a", letterSpacing: "-0.03em", marginBottom: 8 }}>
                Ready to put this into practice?
              </div>
              <p style={{ fontSize: 14, color: "#56625b", lineHeight: 1.7, marginBottom: 22, maxWidth: 440, marginLeft: "auto", marginRight: "auto" }}>
                Every step in this guide maps to a built-in Kambeng feature — verification, milestones, proof of spending, and donor updates.
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                <Link href="/start" style={{ display: "inline-block", padding: "14px 28px", borderRadius: 12, background: `${BLUE}`, color: "#fff", fontSize: 14, fontWeight: 700, textDecoration: "none", boxShadow: "0 6px 24px rgba(20,120,74,0.3)" }}>
                  Start your campaign →
                </Link>
                <button onClick={() => window.print()} style={{ padding: "14px 28px", borderRadius: 12, border: "1px solid rgba(21,32,26,0.15)", background: "rgba(21,32,26,0.05)", color: "#15201a", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  Save as PDF
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
