"use client";

import { createElement, type PropsWithChildren } from "react";
import type { ThemeConfig } from "antd";
import { ConfigProvider, theme } from "antd";

export const appTheme: ThemeConfig = {
  token: {
    colorPrimary: "#14784a",
    colorInfo: "#14784a",
    colorSuccess: "#1f9960",
    colorWarning: "#e8650f",
    colorError: "#d42f2f",
    colorLink: "#14784a",
    colorBgBase: "#ffffff",
    colorBgLayout: "#f6f4ef",
    colorBgContainer: "#ffffff",
    colorBgElevated: "#ffffff",
    colorTextBase: "#15201a",
    colorTextSecondary: "#56625b",
    colorBorder: "rgba(21,32,26,0.09)",
    colorBorderSecondary: "rgba(21,32,26,0.06)",
    fontFamily: "var(--font-body)",
    borderRadius: 12,
    wireframe: false,
  },
  components: {
    Card: {
      borderRadiusLG: 12,
      colorBorderSecondary: "rgba(21,32,26,0.09)",
      colorBgContainer: "#ffffff",
      paddingLG: 20,
    },
    Button: {
      controlHeightLG: 48,
      fontWeight: 600,
      borderRadius: 10,
      primaryShadow: "0 8px 20px -8px rgba(20,120,74,0.5)",
    },
    Input: {
      borderRadius: 10,
      controlHeight: 44,
      controlHeightLG: 52,
      colorBgContainer: "#ffffff",
      colorBorder: "rgba(21,32,26,0.16)",
    },
    Table: {
      borderColor: "rgba(21,32,26,0.09)",
      headerBg: "#f6f4ef",
      headerColor: "#56625b",
      colorBgContainer: "#ffffff",
    },
    Modal: {
      borderRadiusLG: 16,
      contentBg: "#ffffff",
      headerBg: "#ffffff",
    },
    Tag: {
      borderRadiusSM: 6,
    },
    Progress: {
      defaultColor: "#14784a",
    },
    Drawer: {
      colorBgElevated: "#ffffff",
    },
    Select: {
      colorBgContainer: "#ffffff",
      colorBorder: "rgba(21,32,26,0.16)",
      colorBgElevated: "#ffffff",
    },
    Statistic: {
      colorTextDescription: "#56625b",
      colorTextHeading: "#15201a",
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
