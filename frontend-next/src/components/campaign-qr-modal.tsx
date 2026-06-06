"use client";

import { useState } from "react";
import { MobileOutlined } from "@ant-design/icons";
import { useCampaignQRCode, useDonationQRCode } from "@/hooks/use-frontend-data";
import { AppButton, AppCard, AppSpace } from "@/components/ui";
import styles from "./campaign-qr-modal.module.css";

interface CampaignQRModalProps {
  campaignSlug: string;
  campaignTitle?: string;
}

export function CampaignQRModal({ campaignSlug, campaignTitle }: CampaignQRModalProps) {
  const [visible, setVisible] = useState(false);
  const campaignQR = useCampaignQRCode(campaignSlug, visible);
  const donationQR = useDonationQRCode(campaignSlug, visible);

  const handleOpen = () => setVisible(true);
  const handleClose = () => setVisible(false);

  const handleDownloadCampaign = () => {
    if (campaignQR.data?.qr_code_base64) {
      downloadQRCode(campaignQR.data.qr_code_base64, `${campaignSlug}-campaign-qr.png`);
    }
  };

  const handleDownloadDonation = () => {
    if (donationQR.data && typeof donationQR.data === "string") {
      downloadQRCode(donationQR.data, `${campaignSlug}-donate-qr.png`);
    }
  };

  return (
    <>
      <AppButton
        onClick={handleOpen}
        className={styles.triggerButton}
      >
        <MobileOutlined /> Share QR Code
      </AppButton>

      {visible && (
        <div className={styles.modalOverlay} onClick={handleClose}>
          <AppCard className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <AppSpace direction="vertical" size="large">
              <div>
                <h2>Share with QR Code</h2>
                {campaignTitle && <p className={styles.subtitle}>{campaignTitle}</p>}
              </div>

              <div className={styles.qrContainer}>
                {campaignQR.isLoading ? (
                  <div className={styles.loading}>Generating QR codes...</div>
                ) : (
                  <>
                    {campaignQR.data?.qr_code_base64 && (
                      <div className={styles.qrBox}>
                        <h4>Campaign Page</h4>
                        <img
                          src={campaignQR.data.qr_code_base64}
                          alt="Campaign QR"
                          className={styles.qrImage}
                        />
                        <AppButton
                          size="small"
                          block
                          onClick={handleDownloadCampaign}
                        >
                          Download
                        </AppButton>
                      </div>
                    )}

                    {donationQR.data && typeof donationQR.data === "string" && (
                      <div className={styles.qrBox}>
                        <h4>Quick Donate</h4>
                        <img
                          src={donationQR.data}
                          alt="Donation QR"
                          className={styles.qrImage}
                        />
                        <AppButton
                          size="small"
                          block
                          onClick={handleDownloadDonation}
                        >
                          Download
                        </AppButton>
                      </div>
                    )}
                  </>
                )}
              </div>

              <p className={styles.hint}>
                Share these QR codes on social media or print them for your fundraising
              </p>

              <AppButton onClick={handleClose} block>
                Close
              </AppButton>
            </AppSpace>
          </AppCard>
        </div>
      )}
    </>
  );
}

function downloadQRCode(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
