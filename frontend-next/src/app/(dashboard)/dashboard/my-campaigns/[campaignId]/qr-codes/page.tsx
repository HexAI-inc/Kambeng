"use client";

import { useParams } from "next/navigation";
import {
  useCampaignQRCode,
  useDonationQRCode,
  useCampaignAliases,
  useShortCodeQRCode,
} from "@/hooks/use-frontend-data";
import { QRCodeDisplay, QRCodeGrid } from "@/components/qr-code-display";
import { AppButton, AppCard, AppSpace, AppTag, useAppFeedback } from "@/components/ui";
import styles from "./qr-codes.module.css";

export default function CampaignQRCodesPage() {
  const params = useParams();
  const campaignId = typeof params.campaignId === "string" ? params.campaignId : null;
  const { message } = useAppFeedback();

  const campaignQR = useCampaignQRCode(campaignId || undefined);
  const donationQR = useDonationQRCode(campaignId || undefined);
  const aliases = useCampaignAliases(
    typeof campaignId === "string" ? parseInt(campaignId, 10) : undefined,
  );

  const shortCodeQR = useShortCodeQRCode(
    aliases.data?.[0]?.short_code,
    !!(aliases.data?.[0]?.short_code),
  );

  if (!campaignId) {
    return <div>Invalid campaign ID</div>;
  }

  const handleDownload = (qrDataUrl: string, filename: string) => {
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = filename;
    link.click();
    message.success("QR code downloaded");
  };

  return (
    <AppSpace direction="vertical" size="large" className={styles.container}>
      <div>
        <h1>Campaign QR Codes</h1>
        <p className={styles.subtitle}>
          Share QR codes to help people discover and donate to your campaign
        </p>
      </div>

      <QRCodeGrid
        campaignQR={campaignQR.data?.qr_code_base64}
        donationQR={
          donationQR.data
            ? typeof donationQR.data === "string"
              ? donationQR.data
              : undefined
            : undefined
        }
        shortCodeQR={
          shortCodeQR.data
            ? typeof shortCodeQR.data === "string"
              ? shortCodeQR.data
              : undefined
            : undefined
        }
        campaignSlug={campaignId}
        isLoading={campaignQR.isLoading || donationQR.isLoading}
      />

      {/* Usage Tips */}
      <AppCard className={styles.tipsCard}>
        <AppSpace direction="vertical" size="medium">
          <h3>💡 How to Use QR Codes</h3>

          <div className={styles.tipsList}>
            <div className={styles.tipItem}>
              <span className={styles.tipIcon}>📱</span>
              <div>
                <h4>Social Media</h4>
                <p>
                  Post QR codes on Instagram Stories, Facebook, Twitter, or other platforms to
                  make it easy for followers to donate
                </p>
              </div>
            </div>

            <div className={styles.tipItem}>
              <span className={styles.tipIcon}>🖨️</span>
              <div>
                <h4>Print & Physical</h4>
                <p>
                  Download QR codes and print them on posters, flyers, or materials for
                  in-person fundraising events
                </p>
              </div>
            </div>

            <div className={styles.tipItem}>
              <span className={styles.tipIcon}>📊</span>
              <div>
                <h4>Track Performance</h4>
                <p>
                  Different QR codes let you track which channel drives the most donations
                  (campaign page vs. quick donate)
                </p>
              </div>
            </div>

            <div className={styles.tipItem}>
              <span className={styles.tipIcon}>🔗</span>
              <div>
                <h4>Short Links</h4>
                <p>
                  Use campaign aliases to create memorable short links that are easier to type
                  and remember
                </p>
              </div>
            </div>
          </div>
        </AppSpace>
      </AppCard>

      {/* Format Information */}
      <AppCard className={styles.formatsCard}>
        <AppSpace direction="vertical" size="medium">
          <h3>📋 QR Code Types</h3>

          <div className={styles.formatsList}>
            <div className={styles.formatItem}>
              <AppTag color="blue">Campaign Page QR</AppTag>
              <p>Links to your full campaign details page where people can read about your cause</p>
            </div>

            <div className={styles.formatItem}>
              <AppTag color="green">Quick Donate QR</AppTag>
              <p>Direct link to the donation form - faster for people who want to contribute</p>
            </div>

            <div className={styles.formatItem}>
              <AppTag color="purple">Short Code QR</AppTag>
              <p>Uses your campaign alias for a shorter, more memorable link</p>
            </div>
          </div>
        </AppSpace>
      </AppCard>

      {/* Links for Easy Copying */}
      <AppCard className={styles.linksCard}>
        <AppSpace direction="vertical" size="medium">
          <h3>🔗 Campaign Links</h3>

          <div className={styles.linksList}>
            <div className={styles.linkItem}>
              <p>
                <strong>Campaign Page:</strong>
              </p>
              <code>{`${typeof window !== "undefined" ? window.location.origin : ""}/campaigns/${campaignId}`}</code>
              <AppButton
                type="default"
                size="small"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${typeof window !== "undefined" ? window.location.origin : ""}/campaigns/${campaignId}`,
                  );
                  message.success("Link copied to clipboard");
                }}
              >
                Copy
              </AppButton>
            </div>

            {aliases.data?.[0] && (
              <div className={styles.linkItem}>
                <p>
                  <strong>Short Link:</strong>
                </p>
                <code>{`${typeof window !== "undefined" ? window.location.origin : ""}/c/${aliases.data[0].short_code}`}</code>
                <AppButton
                  type="default"
                  size="small"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `${typeof window !== "undefined" ? window.location.origin : ""}/c/${aliases.data[0].short_code}`,
                    );
                    message.success("Short link copied to clipboard");
                  }}
                >
                  Copy
                </AppButton>
              </div>
            )}

            <div className={styles.linkItem}>
              <p>
                <strong>Quick Donate:</strong>
              </p>
              <code>{`${typeof window !== "undefined" ? window.location.origin : ""}/quick-pay/${campaignId}`}</code>
              <AppButton
                type="default"
                size="small"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${typeof window !== "undefined" ? window.location.origin : ""}/quick-pay/${campaignId}`,
                  );
                  message.success("Quick donate link copied to clipboard");
                }}
              >
                Copy
              </AppButton>
            </div>
          </div>
        </AppSpace>
      </AppCard>
    </AppSpace>
  );
}
