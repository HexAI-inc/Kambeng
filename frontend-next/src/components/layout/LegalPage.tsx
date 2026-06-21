import type { ReactNode } from "react";

type Section = {
  heading: string;
  body: ReactNode;
};

type LegalPageProps = {
  title: string;
  subtitle?: string;
  lastUpdated: string;
  sections: Section[];
};

export function LegalPage({ title, subtitle, lastUpdated, sections }: LegalPageProps) {
  return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", padding: "48px clamp(20px,5vw,64px) 80px" }}>
      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <div style={{
            display: "inline-block", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
            textTransform: "uppercase", color: "#1dc5ff", background: "rgba(29,197,255,0.1)",
            border: "1px solid rgba(29,197,255,0.2)", borderRadius: 20, padding: "4px 14px", marginBottom: 16,
          }}>Legal</div>
          <h1 style={{ fontSize: "clamp(26px,4vw,38px)", fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.03em", lineHeight: 1.15, margin: "0 0 12px" }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{ fontSize: 16, color: "#8899aa", lineHeight: 1.6, margin: "0 0 16px" }}>{subtitle}</p>
          )}
          <p style={{ fontSize: 13, color: "#4a5568" }}>Last updated: {lastUpdated}</p>
        </div>

        {/* Sections */}
        <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
          {sections.map((s, i) => (
            <div key={i}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "#f0f6ff", letterSpacing: "-0.02em", margin: "0 0 14px", paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {s.heading}
              </h2>
              <div style={{ fontSize: 15, color: "#8899aa", lineHeight: 1.75 }}>
                {s.body}
              </div>
            </div>
          ))}
        </div>

        {/* Contact footer */}
        <div style={{ marginTop: 56, padding: "24px 28px", background: "#0d1120", border: "1px solid rgba(29,197,255,0.15)", borderRadius: 16 }}>
          <p style={{ fontSize: 14, color: "#f0f6ff", fontWeight: 700, margin: "0 0 6px" }}>Questions about this document?</p>
          <p style={{ fontSize: 14, color: "#8899aa", margin: 0 }}>
            Contact us at{" "}
            <a href="mailto:legal@hexai.gm" style={{ color: "#1dc5ff", textDecoration: "none" }}>legal@hexai.gm</a>.
            We aim to respond within 5 business days.
          </p>
        </div>
      </div>
    </div>
  );
}
