"use client";

import { Space } from "antd";
import type { ReactNode } from "react";

import { AppText, AppTitle } from "@/components/ui/primitives/typography";

type AppPageHeaderProps = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
};

export function AppPageHeader({ title, description, actions }: AppPageHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        flexWrap: "wrap",
        gap: 14,
      }}
    >
      <Space orientation="vertical" size={4}>
        <AppTitle level={2} style={{ margin: 0 }}>
          {title}
        </AppTitle>
        {description ? <AppText type="secondary">{description}</AppText> : null}
      </Space>
      {actions}
    </div>
  );
}
