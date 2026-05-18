"use client";

import type { ReactNode } from "react";

import { AppCard } from "@/components/ui/primitives/surfaces";
import { AppSpace } from "@/components/ui/primitives/layout";
import { AppText, AppTitle } from "@/components/ui/primitives/typography";

type AuthShellProps = {
  title: string;
  description: string;
  eyebrow?: string;
  children: ReactNode;
  aside?: ReactNode;
};

export function AuthShell({ title, description, eyebrow, children, aside }: AuthShellProps) {
  return (
    <AppSpace style={{ width: "min(1120px, 100%)" }} align="start" size={24}>
      <div
        style={{
          display: "grid",
          gap: 18,
          alignContent: "start",
        }}
      >
        {eyebrow ? <AppText type="secondary">{eyebrow}</AppText> : null}
        <AppTitle level={1} style={{ margin: 0, lineHeight: 0.95, fontSize: "clamp(2.5rem, 6vw, 5rem)" }}>
          {title}
        </AppTitle>
        <AppText style={{ fontSize: 16, lineHeight: 1.7, maxWidth: 460 }} type="secondary">
          {description}
        </AppText>
        {aside}
      </div>

      <AppCard style={{ width: "100%", maxWidth: 560, marginLeft: "auto", borderRadius: 0, boxShadow: "0 24px 80px rgba(16,40,32,0.12)" }}>
        {children}
      </AppCard>
    </AppSpace>
  );
}
