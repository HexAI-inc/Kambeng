"use client";

import { createElement, type PropsWithChildren } from "react";
import type { ThemeConfig } from "antd";
import { ConfigProvider, theme } from "antd";

export const appTheme: ThemeConfig = {
  token: {
    colorPrimary: "#1dc5ff",
    colorInfo: "#1dc5ff",
    colorSuccess: "#1bbf88",
    colorBgBase: "#f7fbfd",
    colorBgContainer: "#ffffff",
    colorTextBase: "#0f1720",
    colorBorder: "#d6e4ec",
    fontFamily: "var(--font-body)",
    borderRadius: 0,
    wireframe: false,
  },
  components: {
    Card: {
      borderRadiusLG: 0,
      colorBorderSecondary: "#d6e4ec",
    },
    Button: {
      controlHeightLG: 44,
      fontWeight: 600,
      borderRadius: 0,
      primaryShadow: "0 12px 24px rgba(29, 197, 255, 0.25)",
    },
    Input: {
      borderRadius: 0,
      controlHeight: 42,
      controlHeightLG: 48,
    },
    Table: {
      borderColor: "#d6e4ec",
      headerBg: "#f2f8fb",
      headerColor: "#23323e",
    },
    Modal: {
      borderRadiusLG: 0,
    },
  },
};

export function AppThemeProvider({ children }: PropsWithChildren) {
  return createElement(
    ConfigProvider,
    {
      theme: {
        algorithm: theme.defaultAlgorithm,
        ...appTheme,
      },
    },
    children,
  );
}
