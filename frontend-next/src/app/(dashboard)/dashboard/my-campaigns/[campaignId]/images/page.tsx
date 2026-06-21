"use client";

import { useState, useRef, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import {
  useCampaignImages,
  useUploadCampaignImage,
  useDeleteCampaignImage,
  useMyCampaigns,
  useUploadCampaignCover,
  useCampaignProofs,
  useDeleteCampaignProof,
} from "@/hooks/use-frontend-data";
import { ProofUploadForm } from "@/components/ProofUploadForm";
import { ProofList } from "@/components/ProofList";
import { useAppFeedback } from "@/components/ui";
import MediaViewer from "@/components/ui/MediaViewer";
import { motion } from "framer-motion";

const BLUE = "#1dc5ff";
const GREEN = "#1bbf88";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.38, delay, ease: "easeOut" as const },
  };
}

export default function CampaignImagesPage() {
  const params = useParams();
  const campaignId = typeof params.campaignId === "string" ? params.campaignId : null;

  const { data: myCampaigns, isLoading: campaignsLoading } = useMyCampaigns(Boolean(campaignId));
  const uploadImage = useUploadCampaignImage();
  const deleteImage = useDeleteCampaignImage();
  const { message } = useAppFeedback();

  const campaign = useMemo(() => {
    if (!campaignId || !myCampaigns) return null;
    return myCampaigns.find((c) => c.id === Number(campaignId)) ?? null;
  }, [campaignId, myCampaigns]);

  const campaignSlug = campaign?.slug ?? null;
  const { data: images, isLoading: imagesLoading } = useCampaignImages(campaignSlug ?? undefined, Boolean(campaignSlug));
  const { data: proofs = [], isLoading: proofsLoading } = useCampaignProofs(campaignSlug ?? undefined, Boolean(campaignSlug));
  const deleteProof = useDeleteCampaignProof();
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadCover = useUploadCampaignCover();
  const [activeTab, setActiveTab] = useState<"images" | "proof" | "cover">("images");
  const [coverDragging, setCoverDragging] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const [viewer, setViewer] = useState<{ src: string; type: string } | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || !campaignSlug) return;
    for (const file of Array.from(files)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        message.error(`${file.name}: only PNG, JPEG, WebP allowed.`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        message.error(`${file.name}: max 10MB.`);
        continue;
      }
      setUploading((p) => [...p, file.name]);
      try {
        const fd = new FormData();
        fd.append("files", file);
        await uploadImage.mutateAsync({ slug: campaignSlug, formData: fd });
        message.success(`${file.name} uploaded`);
      } catch {
        message.error(`Failed to upload ${file.name}`);
      } finally {
        setUploading((p) => p.filter((n) => n !== file.name));
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = async (fileName: string) => {
    if (!campaignSlug) return;
    if (!window.confirm(`Delete "${fileName}"?`)) return;
    try {
      await deleteImage.mutateAsync({ slug: campaignSlug, fileName });
      message.success("Image deleted");
    } catch {
      message.error("Failed to delete image");
    }
  };

  const handleCoverFile = async (files: FileList | null) => {
    if (!files || !campaignSlug) return;
    const file = files[0];
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      message.error("Only PNG, JPEG, WebP allowed.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      message.error("Max file size is 8MB.");
      return;
    }
    setCoverUploading(true);
    try {
      await uploadCover.mutateAsync({ slug: campaignSlug, file });
      message.success("Cover image updated");
    } catch {
      message.error("Failed to upload cover image");
    } finally {
      setCoverUploading(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  };

  if (!campaignId) return <div style={{ color: "#f0f6ff", padding: 32 }}>Invalid campaign ID</div>;

  return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", padding: "28px clamp(16px, 4vw, 48px)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Header */}
        <motion.div {...fadeUp(0)} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <Link href="/dashboard/my-campaigns" style={{ fontSize: 12, color: "#4a5568", fontWeight: 500 }}>
                ← My Campaigns
              </Link>
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.03em", marginBottom: 4 }}>
              {campaignsLoading ? "Loading…" : campaign?.title ?? "Campaign"}
            </div>
            <div style={{ fontSize: 13, color: "#6b7a8d" }}>Manage campaign images and proof uploads</div>
          </div>

          {campaignSlug && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link href={`/campaigns/${campaignSlug}`}>
                <button style={{
                  padding: "9px 16px", borderRadius: 9,
                  border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)",
                  color: "#8899aa", fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}>Public page ↗</button>
              </Link>
              <Link href={`/dashboard/my-campaigns/${campaignId}/updates`}>
                <button style={{
                  padding: "9px 16px", borderRadius: 9,
                  border: `1px solid rgba(29,197,255,0.25)`, background: "rgba(29,197,255,0.08)",
                  color: BLUE, fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}>Updates</button>
              </Link>
              <Link href={`/dashboard/my-campaigns/${campaignId}/withdrawals`}>
                <button style={{
                  padding: "9px 16px", borderRadius: 9,
                  border: "1px solid rgba(27,191,136,0.25)", background: "rgba(27,191,136,0.08)",
                  color: GREEN, fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}>Withdraw funds</button>
              </Link>
              <Link href="/dashboard/kyc">
                <button style={{
                  padding: "9px 16px", borderRadius: 9,
                  border: "1px solid rgba(27,191,136,0.3)", background: "rgba(27,191,136,0.07)",
                  color: GREEN, fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}>KYC docs</button>
              </Link>
            </div>
          )}
        </motion.div>

        {/* Tabs */}
        <motion.div {...fadeUp(0.05)} style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: 3, width: "fit-content" }}>
          {(["images", "proof", "cover"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
              background: activeTab === tab ? `linear-gradient(135deg, ${BLUE}, #079bd4)` : "transparent",
              color: activeTab === tab ? "#fff" : "#6b7a8d",
              boxShadow: activeTab === tab ? "0 2px 10px rgba(29,197,255,0.25)" : "none",
              transition: "all 0.2s",
            }}>
              {tab === "images" ? "Campaign Images" : tab === "proof" ? "Proof & Evidence" : "Cover Image"}
            </button>
          ))}
        </motion.div>

        {activeTab === "images" ? (
          <>
            {/* Upload zone */}
            <motion.div {...fadeUp(0.08)}>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={() => setDragging(true)}
                onDragLeave={() => setDragging(false)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); setDragging(false); void handleFiles(e.dataTransfer.files); }}
                style={{
                  padding: "36px 24px", borderRadius: 14, textAlign: "center", cursor: "pointer",
                  border: `2px dashed ${dragging ? BLUE : "rgba(255,255,255,0.1)"}`,
                  background: dragging ? "rgba(29,197,255,0.05)" : "rgba(255,255,255,0.02)",
                  transition: "all 0.2s",
                }}
              >
                <input ref={fileInputRef} type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={(e) => void handleFiles(e.target.files)} style={{ display: "none" }} />
                <div style={{
                  width: 52, height: 52, borderRadius: 12,
                  background: "rgba(29,197,255,0.08)", border: "1px solid rgba(29,197,255,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px",
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round"/>
                    <polyline points="17 8 12 3 7 8" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    <line x1="12" y1="3" x2="12" y2="15" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#f0f6ff", marginBottom: 6 }}>
                  {dragging ? "Drop to upload" : "Click to upload or drag & drop"}
                </div>
                <div style={{ fontSize: 12, color: "#6b7a8d" }}>PNG, JPEG, WebP · max 10MB each</div>
              </div>

              {/* Uploading indicators */}
              {uploading.length > 0 && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                  {uploading.map((name) => (
                    <div key={name} style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "8px 14px",
                      background: "rgba(29,197,255,0.06)", border: "1px solid rgba(29,197,255,0.15)",
                      borderRadius: 8,
                    }}>
                      <div style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${BLUE}`, borderTopColor: "transparent", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: BLUE, fontWeight: 500 }}>Uploading {name}…</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Images grid */}
            <motion.div {...fadeUp(0.12)}>
              {imagesLoading ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
                  {[1,2,3,4].map((i) => <div key={i} style={{ aspectRatio: "1", borderRadius: 10, background: "rgba(255,255,255,0.05)" }} />)}
                </div>
              ) : images && images.length > 0 ? (
                <>
                  <div style={{ fontSize: 11, color: "#4a5568", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 12 }}>
                    {images.length} image{images.length !== 1 ? "s" : ""} uploaded
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
                    {images.map((img, imgIdx) => (
                      <div key={img.file_name} style={{
                        borderRadius: 10, overflow: "hidden",
                        background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)",
                        position: "relative", aspectRatio: "1",
                      }}>
                        <Image src={img.url} alt={img.original_name ?? img.file_name} fill unoptimized sizes="180px" style={{ objectFit: "cover" }} />
                        {imgIdx === 0 && (
                          <div style={{
                            position: "absolute", top: 7, left: 7, zIndex: 2,
                            padding: "2px 8px", borderRadius: 6,
                            background: "rgba(29,197,255,0.9)", color: "#fff",
                            fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                          }}>Cover</div>
                        )}
                        {/* Hover overlay */}
                        <div className="img-overlay" style={{
                          position: "absolute", inset: 0,
                          background: "rgba(0,0,0,0.7)",
                          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                          gap: 8, opacity: 0, transition: "opacity 0.2s",
                        }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = "1"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = "0"; }}
                        >
                          <button onClick={() => setViewer({ src: img.url, type: img.content_type ?? "image/jpeg" })} style={{
                            padding: "6px 14px", borderRadius: 7, border: "none",
                            background: "rgba(255,255,255,0.15)", color: "#fff",
                            fontSize: 11, fontWeight: 600, cursor: "pointer",
                          }}>View</button>
                          <button onClick={() => void handleDelete(img.file_name)} style={{
                            padding: "6px 14px", borderRadius: 7, border: "none",
                            background: "rgba(239,68,68,0.3)", color: "#fca5a5",
                            fontSize: 11, fontWeight: 600, cursor: "pointer",
                          }}>Delete</button>
                        </div>
                        {/* File info */}
                        <div style={{
                          position: "absolute", bottom: 0, left: 0, right: 0,
                          padding: "20px 8px 6px",
                          background: "linear-gradient(transparent, rgba(0,0,0,0.8))",
                          pointerEvents: "none",
                        }}>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {img.original_name ?? img.file_name}
                          </div>
                          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>{(img.size / 1024).toFixed(0)} KB</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{
                  padding: "40px 24px", textAlign: "center",
                  background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)",
                  borderRadius: 14,
                }}>
                  <div style={{ fontSize: 13, color: "#4a5568" }}>No images yet — upload your first one above</div>
                </div>
              )}
            </motion.div>
          </>
        ) : activeTab === "proof" ? (
          /* Proof tab */
          <motion.div {...fadeUp(0.08)} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {campaignSlug ? (
              <>
                {/* Upload form */}
                <div style={{
                  background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 14, padding: "24px",
                }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#f0f6ff", marginBottom: 4 }}>Upload Proof & Evidence</div>
                  <div style={{ fontSize: 13, color: "#6b7a8d", marginBottom: 20 }}>
                    Add receipts, photos, ID screenshots, or documents that show donors how funds were used.
                  </div>
                  <ProofUploadForm slug={campaignSlug} />
                </div>

                {/* Existing proofs */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#8899aa", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 12 }}>
                    Uploaded Documents ({proofs.length})
                  </div>
                  {proofsLoading ? (
                    <div style={{ fontSize: 13, color: "#4a5568", padding: "20px 0" }}>Loading…</div>
                  ) : (
                    <ProofList
                      proofs={proofs}
                      onDelete={async (proofId) => {
                        await deleteProof.mutateAsync({ slug: campaignSlug, proofId });
                      }}
                    />
                  )}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: "#4a5568", padding: 24 }}>Loading campaign…</div>
            )}
          </motion.div>
        ) : (
          /* Cover Image tab */
          <motion.div {...fadeUp(0.08)}>
            <div style={{
              background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 14, padding: "24px", display: "flex", flexDirection: "column", gap: 20,
            }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#f0f6ff", marginBottom: 4 }}>Cover Image</div>
                <div style={{ fontSize: 13, color: "#6b7a8d" }}>
                  This image appears at the top of your public campaign page and in campaign cards.
                </div>
              </div>

              {/* Current cover preview */}
              {campaign?.cover_image_url && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#4a5568", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 10 }}>
                    Current cover
                  </div>
                  <div style={{
                    position: "relative", borderRadius: 12, overflow: "hidden",
                    border: "1px solid rgba(255,255,255,0.09)",
                    maxWidth: 480, aspectRatio: "16/9",
                  }}>
                    <Image
                      src={campaign.cover_image_url}
                      alt="Current cover"
                      fill
                      unoptimized
                      sizes="480px"
                      style={{ objectFit: "cover" }}
                    />
                  </div>
                </div>
              )}

              {/* Upload zone */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#4a5568", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 10 }}>
                  {campaign?.cover_image_url ? "Replace cover" : "Upload cover"}
                </div>
                <div
                  onClick={() => coverInputRef.current?.click()}
                  onDragEnter={() => setCoverDragging(true)}
                  onDragLeave={() => setCoverDragging(false)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); setCoverDragging(false); void handleCoverFile(e.dataTransfer.files); }}
                  style={{
                    padding: "36px 24px", borderRadius: 14, textAlign: "center", cursor: "pointer",
                    border: `2px dashed ${coverDragging ? BLUE : "rgba(255,255,255,0.1)"}`,
                    background: coverDragging ? "rgba(29,197,255,0.05)" : "rgba(255,255,255,0.02)",
                    transition: "all 0.2s",
                    maxWidth: 480,
                  }}
                >
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => void handleCoverFile(e.target.files)}
                    style={{ display: "none" }}
                  />
                  <div style={{
                    width: 52, height: 52, borderRadius: 12,
                    background: "rgba(29,197,255,0.08)", border: "1px solid rgba(29,197,255,0.15)",
                    display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px",
                  }}>
                    {coverUploading ? (
                      <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${BLUE}`, borderTopColor: "transparent", animation: "spin 0.7s linear infinite" }} />
                    ) : (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round"/>
                        <polyline points="17 8 12 3 7 8" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        <line x1="12" y1="3" x2="12" y2="15" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round"/>
                      </svg>
                    )}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#f0f6ff", marginBottom: 6 }}>
                    {coverUploading ? "Uploading…" : coverDragging ? "Drop to upload" : "Click to upload or drag & drop"}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7a8d" }}>PNG, JPEG, WebP · max 8MB</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
        {viewer && <MediaViewer src={viewer.src} type={viewer.type} onClose={() => setViewer(null)} />}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .img-overlay:hover { opacity: 1 !important; }
      `}</style>
    </div>
  );
}
