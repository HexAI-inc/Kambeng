"use client";

import type { ReactNode } from "react";

type AuthShellProps = {
  title: string;
  description: string;
  eyebrow?: string;
  children: ReactNode;
  aside?: ReactNode;
};

export function AuthShell({ title, description, eyebrow, children, aside }: AuthShellProps) {
  return (
    <div style={{
      display: "flex",
      alignItems: "flex-start",
      gap: 48,
      width: "min(1120px, 100%)",
    }}>
      {/* Left panel */}
      <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 18, alignContent: "start" }}>
        {eyebrow ? (
          <span style={{ fontSize: 12, color: "#1dc5ff", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {eyebrow}
          </span>
        ) : null}
        <h1 style={{
          margin: 0,
          fontSize: "clamp(2rem, 5vw, 3.5rem)",
          fontWeight: 800,
          color: "#f0f6ff",
          lineHeight: 1.05,
          letterSpacing: "-0.03em",
        }}>
          {title}
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.7, maxWidth: 460, color: "#8899aa", margin: 0 }}>
          {description}
        </p>
        {aside}
      </div>

      {/* Right form card */}
      <div style={{
        width: "100%",
        maxWidth: 480,
        marginLeft: "auto",
        background: "#111827",
        borderRadius: 20,
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
        padding: "32px",
        display: "flex",
        flexDirection: "column",
        gap: 20,
        flexShrink: 0,
      }}>
        {children}
      </div>
    </div>
  );
}
