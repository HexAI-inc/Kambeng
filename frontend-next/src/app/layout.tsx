import type { Metadata } from "next";
import { DM_Sans, Syne } from "next/font/google";
import "antd/dist/reset.css";
import { Providers } from "@/components/providers";
import { AppShell } from "@/components/layout/app-shell";
import "./globals.css";

const display = Syne({
  variable: "--font-display",
  subsets: ["latin"],
  preload: false,
});

const body = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  title: "Kambeng React Portal",
  description: "Next.js frontend migration for Kambeng",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
