import type { Metadata } from "next";
import { DM_Sans, Syne } from "next/font/google";
import "antd/dist/reset.css";
import { Providers } from "@/components/providers";
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
  title: "Kambeng — Gambia's Transparent Crowdfunding Platform",
  description:
    "Donate to verified Gambian campaigns in seconds — with Wave, APS Mobile Money, or your card. Every campaigner ID-verified. Every dalasi tracked with receipts.",
  metadataBase: new URL("https://kambeng.hexai.gm"),
  openGraph: {
    title: "Kambeng — Real Causes. Real Proof. Real Gambians.",
    description:
      "Gambia's most transparent way to give. Fund schools, health projects, and community causes with Wave, APS, or Visa/Mastercard.",
    url: "https://kambeng.hexai.gm",
    siteName: "Kambeng",
    images: [{ url: "/og-banner.png", width: 1200, height: 630, alt: "Kambeng" }],
    locale: "en_GM",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kambeng — Gambia's Transparent Crowdfunding Platform",
    description: "Donate to verified Gambian campaigns with Wave, APS Mobile Money, or your card.",
    images: ["/og-banner.png"],
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
    other: [
      { rel: "icon", url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { rel: "icon", url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
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
          {children}
        </Providers>
      </body>
    </html>
  );
}
