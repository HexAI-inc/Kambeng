"use client";

import { createElement, type PropsWithChildren } from "react";
import type { ThemeConfig } from "antd";
import { ConfigProvider, theme } from "antd";

export const appTheme: ThemeConfig = {
  token: {
    colorPrimary: "#1dc5ff",
    colorInfo: "#1dc5ff",
    colorSuccess: "#1bbf88",
    colorBgBase: "#111827",
    colorBgContainer: "#111827",
    colorBgElevated: "#1a2333",
    colorTextBase: "#f0f6ff",
    colorTextSecondary: "#8899aa",
    colorBorder: "rgba(255,255,255,0.08)",
    colorBorderSecondary: "rgba(255,255,255,0.06)",
    fontFamily: "var(--font-body)",
    borderRadius: 12,
    wireframe: false,
  },
  components: {
    Card: {
      borderRadiusLG: 12,
      colorBorderSecondary: "rgba(255,255,255,0.08)",
      colorBgContainer: "#111827",
      paddingLG: 20,
    },
    Button: {
      controlHeightLG: 48,
      fontWeight: 600,
      borderRadius: 10,
      primaryShadow: "0 8px 24px rgba(29, 197, 255, 0.35)",
    },
    Input: {
      borderRadius: 10,
      controlHeight: 44,
      controlHeightLG: 52,
      colorBgContainer: "rgba(255,255,255,0.06)",
      colorBorder: "rgba(255,255,255,0.12)",
    },
    Table: {
      borderColor: "rgba(255,255,255,0.08)",
      headerBg: "#1a2333",
      headerColor: "#8899aa",
      colorBgContainer: "#111827",
    },
    Modal: {
      borderRadiusLG: 16,
      contentBg: "#1a2333",
      headerBg: "#1a2333",
    },
    Tag: {
      borderRadiusSM: 6,
    },
    Progress: {
      defaultColor: "#1dc5ff",
    },
    Drawer: {
      colorBgElevated: "#111827",
    },
    Select: {
      colorBgContainer: "rgba(255,255,255,0.06)",
      colorBorder: "rgba(255,255,255,0.12)",
      colorBgElevated: "#1a2333",
    },
    Statistic: {
      colorTextDescription: "#8899aa",
      colorTextHeading: "#f0f6ff",
    },
  },
};

export function AppThemeProvider({ children }: PropsWithChildren) {
  return createElement(
    ConfigProvider,
    {
      theme: {
        algorithm: theme.darkAlgorithm,
        ...appTheme,
      },
    },
    children,
  );
}
