"use client";

import { useState } from "react";
import Image from "next/image";
import { AppButton, AppCard, AppSpace } from "@/components/ui";
import styles from "./qr-code-display.module.css";

interface QRCodeDisplayProps {
  qrDataUrl: string | null;
  title: string;
  subtitle?: string;
  campaignSlug?: string;
  isLoading?: boolean;
  downloadFilename?: string;
}

export function QRCodeDisplay({
  qrDataUrl,
  title,
  subtitle,
  campaignSlug,
  isLoading = false,
  downloadFilename = "qrcode.png",
}: QRCodeDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleDownload = () => {
    if (!qrDataUrl) return;

    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = downloadFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyLink = () => {
    if (campaignSlug) {
      const url = `${window.location.origin}/campaigns/${campaignSlug}`;
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <AppCard className={styles.container}>
        <AppSpace direction="vertical" size="medium" align="center">
          <div className={styles.skeleton} />
          <p>Generating QR code...</p>
        </AppSpace>
      </AppCard>
    );
  }

  if (!qrDataUrl) {
    return (
      <AppCard className={styles.container}>
        <div className={styles.empty}>
          <p>QR code could not be generated</p>
        </div>
      </AppCard>
    );
  }

  return (
    <AppCard className={styles.container}>
      <AppSpace direction="vertical" size="medium">
        {title && (
          <div>
            <h3 className={styles.title}>{title}</h3>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
        )}

        <div className={styles.qrCodeContainer}>
          <img
            src={qrDataUrl}
            alt={title}
            className={styles.qrCode}
          />
        </div>

        <div className={styles.actions}>
          <AppButton
            type="primary"
            onClick={handleDownload}
            block
          >
            📥 Download QR Code
          </AppButton>
          {campaignSlug && (
            <AppButton
              onClick={handleCopyLink}
              block
            >
              {copied ? "✓ Copied!" : "📋 Copy Link"}
            </AppButton>
          )}
        </div>

        <p className={styles.hint}>
          Share this QR code to help people discover and donate to your campaign
        </p>
      </AppSpace>
    </AppCard>
  );
}

interface QRCodeGridProps {
  campaignQR?: string | null;
  donationQR?: string | null;
  shortCodeQR?: string | null;
  campaignSlug?: string;
  isLoading?: boolean;
}

export function QRCodeGrid({
  campaignQR,
  donationQR,
  shortCodeQR,
  campaignSlug,
  isLoading = false,
}: QRCodeGridProps) {
  const [showMore, setShowMore] = useState(false);

  return (
    <div className={styles.grid}>
      {campaignQR && (
        <QRCodeDisplay
          qrDataUrl={campaignQR}
          title="Campaign Page"
          subtitle="Links to campaign details"
          campaignSlug={campaignSlug}
          isLoading={isLoading}
          downloadFilename={`${campaignSlug}-campaign-qr.png`}
        />
      )}

      {donationQR && (
        <QRCodeDisplay
          qrDataUrl={donationQR}
          title="Quick Donate"
          subtitle="Direct link to donation page"
          isLoading={isLoading}
          downloadFilename={`${campaignSlug}-donate-qr.png`}
        />
      )}

      {shortCodeQR && (
        <QRCodeDisplay
          qrDataUrl={shortCodeQR}
          title="Short Code"
          subtitle="Compact shareable link"
          isLoading={isLoading}
          downloadFilename={`${campaignSlug}-short-qr.png`}
        />
      )}
    </div>
  );
}

interface QuickQRSupportProps {
  campaignSlug?: string;
  donationMode?: boolean;
}

/**
 * Quick component to embed QR code in a modal or card
 */
export function QuickQRCode({
  campaignSlug,
  donationMode = false,
}: QuickQRSupportProps) {
  const campaignQR = useCampaignQRCode(campaignSlug);
  const donationQR = useDonationQRCode(campaignSlug, donationMode);

  const qrDataUrl = donationMode
    ? typeof donationQR.data === "string"
      ? donationQR.data
      : undefined
    : campaignQR.data?.qr_code_base64;

  return (
    <QRCodeDisplay
      qrDataUrl={qrDataUrl || null}
      title={donationMode ? "Donation QR Code" : "Campaign QR Code"}
      campaignSlug={campaignSlug}
      isLoading={campaignQR.isLoading || donationQR.isLoading}
    />
  );
}

// Need to import the hook
import { useCampaignQRCode, useDonationQRCode } from "@/hooks/use-frontend-data";
