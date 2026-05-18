"use client";

import { useState, useRef, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useCampaignImages,
  useUploadCampaignImage,
  useDeleteCampaignImage,
  useMyCampaigns,
} from "@/hooks/use-frontend-data";
import { AppButton, AppCard, AppSpace, useAppFeedback } from "@/components/ui";
import { ProofUploadForm } from "@/components/ProofUploadForm";
import Image from "next/image";
import styles from "./images.module.css";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function CampaignImagesPage() {
  const params = useParams();
  const campaignId = typeof params.campaignId === "string" ? params.campaignId : null;
  
  const { data: myCampaigns, isLoading: campaignsLoading } = useMyCampaigns(Boolean(campaignId));
  const uploadImage = useUploadCampaignImage();
  const deleteImage = useDeleteCampaignImage();
  const { message } = useAppFeedback();

  const campaignSlug = useMemo(() => {
    if (!campaignId || !myCampaigns) {
      return null;
    }

    const campaign = myCampaigns.find((item) => item.id === Number(campaignId));
    return campaign?.slug ?? null;
  }, [campaignId, myCampaigns]);

  const { data: images, isLoading } = useCampaignImages(campaignSlug ?? undefined, Boolean(campaignSlug));

  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    if (!campaignSlug) {
      message.error("Campaign is still loading. Please try again in a moment.");
      return;
    }

    for (const file of Array.from(files)) {
      // Validate file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        message.error(`Invalid file type: ${file.type}. Only PNG, JPEG, and WebP are allowed.`);
        continue;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        message.error(
          `File "${file.name}" is too large. Maximum size is 10MB.`,
        );
        continue;
      }

      // Upload the file
      try {
        const formData = new FormData();
        formData.append("files", file);

        setUploadProgress((prev) => ({
          ...prev,
          [file.name]: 0,
        }));

        await uploadImage.mutateAsync({
          slug: campaignSlug,
          formData,
        });

        message.success(`Image "${file.name}" uploaded successfully`);

        setUploadProgress((prev) => {
          const newProgress = { ...prev };
          delete newProgress[file.name];
          return newProgress;
        });
      } catch {
        message.error(`Failed to upload "${file.name}"`);
        setUploadProgress((prev) => {
          const newProgress = { ...prev };
          delete newProgress[file.name];
          return newProgress;
        });
      }
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (fileName: string) => {
    if (!campaignSlug) {
      message.error("Campaign is still loading. Please try again in a moment.");
      return;
    }

    if (window.confirm(`Delete image "${fileName}"?`)) {
      try {
        await deleteImage.mutateAsync({
          slug: campaignSlug,
          fileName,
        });
        message.success("Image deleted successfully");
      } catch {
        message.error("Failed to delete image");
      }
    }
  };

  if (!campaignId) {
    return <div>Invalid campaign ID</div>;
  }

  if (campaignsLoading && !campaignSlug) {
    return (
      <AppCard>
        <p>Loading campaign...</p>
      </AppCard>
    );
  }

  return (
    <AppSpace direction="vertical" size="large" className={styles.container}>
      <div>
        <h1>Campaign Images</h1>
        <p className={styles.subtitle}>
          Upload and manage images for your campaign
        </p>
      </div>

      <AppCard>
        <AppSpace direction="vertical" size="small">
          <h3>Upload shortcuts</h3>
          <AppSpace wrap size={10}>
            <Link href="/dashboard/kyc">
              <AppButton>Upload KYC documents</AppButton>
            </Link>
            {campaignSlug ? (
              <Link href={`/campaigns/${campaignSlug}`}>
                <AppButton type="default">View public campaign page</AppButton>
              </Link>
            ) : null}
          </AppSpace>
        </AppSpace>
      </AppCard>

      {/* Upload Section */}
      <AppCard>
        <AppSpace direction="vertical" size="large">
          <div>
            <h3>Upload New Image</h3>
            <p className={styles.uploadHint}>
              Supported formats: PNG, JPEG, WebP (Max 10MB per image)
            </p>
          </div>

          <div
            className={styles.uploadBox}
            onClick={() => fileInputRef.current?.click()}
            onDrop={(e) => {
              e.preventDefault();
              if (fileInputRef.current) {
                fileInputRef.current.files = e.dataTransfer.files;
                handleFileSelect({
                  target: fileInputRef.current,
                } as React.ChangeEvent<HTMLInputElement>);
              }
            }}
            onDragOver={(e) => e.preventDefault()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileSelect}
              style={{ display: "none" }}
            />

            <div className={styles.uploadContent}>
              <div className={styles.uploadIcon}>📸</div>
              <p className={styles.uploadLabel}>
                Click to upload or drag & drop
              </p>
              <p className={styles.uploadDescription}>
                PNG, JPEG, or WebP (up to 10MB)
              </p>
            </div>
          </div>

          {/* Upload Progress */}
          {Object.entries(uploadProgress).map(([filename, progress]) => (
            <div key={filename} className={styles.progressItem}>
              <span>{filename}</span>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span>{progress}%</span>
            </div>
          ))}
        </AppSpace>
      </AppCard>

      {campaignSlug && (
        <AppCard>
          <AppSpace direction="vertical" size="large">
            <div>
              <h3>Upload Proof & Evidence</h3>
              <p className={styles.uploadHint}>
                Add student ID, UTG portal screenshots, transcripts, or receipts. Choose who can see each proof.
              </p>
            </div>

            <ProofUploadForm slug={campaignSlug} />
          </AppSpace>
        </AppCard>
      )}

      {/* Images Grid */}
      {isLoading ? (
        <AppCard>
          <p>Loading images...</p>
        </AppCard>
      ) : images && images.length > 0 ? (
        <AppCard>
          <AppSpace direction="vertical" size="medium">
            <h3>Uploaded Images ({images.length})</h3>

            <div className={styles.imagesGrid}>
              {images.map((image) => (
                  <div key={image.file_name} className={styles.imageCard}>
                  <div className={styles.imageContainer}>
                    <Image
                        src={image.url}
                        alt={image.original_name ?? image.file_name}
                      fill
                        unoptimized
                      className={styles.image}
                      sizes="200px"
                    />
                  </div>

                  <div className={styles.imageInfo}>
                      <p className={styles.fileName}>{image.original_name ?? image.file_name}</p>
                      <p className={styles.uploadDate}>
                        {(image.size / 1024).toFixed(1)} KB
                      </p>
                  </div>

                  <div className={styles.imageActions}>
                    <AppButton
                      size="small"
                      type="text"
                      onClick={() =>
                          window.open(image.url, "_blank")
                      }
                    >
                      View
                    </AppButton>
                    <AppButton
                      size="small"
                      danger
                      onClick={() => handleDelete(image.file_name)}
                      loading={deleteImage.isPending}
                    >
                      Delete
                    </AppButton>
                  </div>
                </div>
              ))}
            </div>
          </AppSpace>
        </AppCard>
      ) : (
        <AppCard className={styles.emptyState}>
          <div className={styles.emptyContent}>
            <div className={styles.emptyIcon}>🖼️</div>
            <h3>No images uploaded</h3>
            <p>Upload your first campaign image using the upload box above</p>
          </div>
        </AppCard>
      )}
    </AppSpace>
  );
}
