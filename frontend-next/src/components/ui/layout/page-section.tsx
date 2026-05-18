"use client";

import type { ReactNode } from "react";

import { AppCard } from "@/components/ui/primitives/surfaces";
import { AppSpace } from "@/components/ui/primitives/layout";
import { AppText, AppTitle } from "@/components/ui/primitives/typography";

type AppPageSectionProps = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
};

export function AppPageSection({ title, description, actions, children }: AppPageSectionProps) {
  return (
    <AppCard>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 14,
        }}
      >
        <AppSpace direction="vertical" size={4}>
          <AppTitle level={4} style={{ margin: 0 }}>
            {title}
          </AppTitle>
          {description ? <AppText type="secondary">{description}</AppText> : null}
        </AppSpace>
        {actions}
      </div>
      {children ? <div style={{ marginTop: 14 }}>{children}</div> : null}
    </AppCard>
  );
}
