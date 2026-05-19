"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useCampaignQRCode, useDonationQRCode, useCampaignAliases, useShortCodeQRCode } from "@/hooks/use-frontend-data";
import { useAppFeedback } from "@/components/ui";

const BLUE = "#1dc5ff";
const GREEN = "#1bbf88";

function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.38, delay, ease: "easeOut" as const },
  };
}

function QRCard({ title, description, tag, tagColor, qrData, isLoading, onDownload, onCopy }: {
  title: string; description: string; tag: string; tagColor: string;
  qrData?: string; isLoading: boolean;
  onDownload: () => void; onCopy: () => void;
}) {
  return (
    <div style={{
      background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 14, overflow: "hidden",
      transition: "border-color 0.2s",
    }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(29,197,255,0.2)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.07)"; }}
    >
      {/* Top accent */}
      <div style={{ height: 2, background: `linear-gradient(90deg, ${tagColor}, transparent)` }} />
      <div style={{ padding: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const,
            padding: "2px 8px", borderRadius: 20,
            color: tagColor, background: `${tagColor}18`,
          }}>{tag}</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#f0f6ff", marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 12, color: "#6b7a8d", marginBottom: 16, lineHeight: 1.6 }}>{description}</div>

        {/* QR image */}
        <div style={{
          width: "100%", aspectRatio: "1", maxWidth: 200, margin: "0 auto 16px",
          background: isLoading ? "rgba(255,255,255,0.04)" : "#fff",
          borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden",
        }}>
          {isLoading ? (
            <div style={{ width: 32, height: 32, borderRadius: "50%", border: `2px solid ${BLUE}`, borderTopColor: "transparent", animation: "spin 0.7s linear infinite" }} />
          ) : qrData ? (
            <img
              src={qrData.startsWith("data:") ? qrData : `data:image/png;base64,${qrData}`}
              alt={title}
              style={{ width: "100%", height: "100%", objectFit: "contain", padding: 8 }}
            />
          ) : (
            <div style={{ fontSize: 12, color: "#4a5568", textAlign: "center", padding: 16 }}>Not available</div>
          )}
        </div>

        {qrData && (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onDownload} style={{
              flex: 1, padding: "9px", borderRadius: 8, border: "none",
              background: `linear-gradient(135deg, ${BLUE}, #079bd4)`,
              color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
              boxShadow: "0 2px 10px rgba(29,197,255,0.25)",
            }}>Download</button>
            <button onClick={onCopy} style={{
              flex: 1, padding: "9px", borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)",
              color: "#8899aa", fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}>Copy link</button>
          </div>
        )}
      </div>
    </div>
  );
}

function LinkRow({ label, url, onCopy }: { label: string; url: string; onCopy: () => void }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 14px", borderRadius: 8,
      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
    }}>
      <span style={{ fontSize: 11, color: "#4a5568", fontWeight: 600, flexShrink: 0, minWidth: 100 }}>{label}</span>
      <span style={{ fontSize: 12, color: "#c0ccd8", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace" }}>{url}</span>
      <button onClick={onCopy} style={{
        padding: "4px 12px", borderRadius: 6, border: "none", flexShrink: 0,
        background: "rgba(29,197,255,0.1)", color: BLUE,
        fontSize: 11, fontWeight: 700, cursor: "pointer",
      }}>Copy</button>
    </div>
  );
}

export default function CampaignQRCodesPage() {
  const params = useParams();
  const campaignId = typeof params.campaignId === "string" ? params.campaignId : null;
  const { message } = useAppFeedback();

  const campaignQR = useCampaignQRCode(campaignId || undefined);
  const donationQR = useDonationQRCode(campaignId || undefined);
  const aliases = useCampaignAliases(campaignId ? parseInt(campaignId, 10) : undefined);
  const shortCodeQR = useShortCodeQRCode(aliases.data?.[0]?.short_code, !!(aliases.data?.[0]?.short_code));

  if (!campaignId) return <div style={{ color: "#f0f6ff", padding: 32 }}>Invalid campaign ID</div>;

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const handleDownload = (qrData: string, filename: string) => {
    const src = qrData.startsWith("data:") ? qrData : `data:image/png;base64,${qrData}`;
    const a = document.createElement("a");
    a.href = src; a.download = filename; a.click();
    message.success("Downloaded");
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success("Copied to clipboard");
  };

  const tips = [
    { icon: "📱", title: "Social Media", desc: "Post QR codes on Instagram Stories or Facebook to make it easy for followers to donate." },
    { icon: "🖨️", title: "Print & Physical", desc: "Print QR codes on posters and flyers for in-person fundraising events." },
    { icon: "📊", title: "Track Channels", desc: "Different QR codes let you see which channel drives the most donations." },
    { icon: "🔗", title: "Short Links", desc: "Use aliases for memorable short links that are easier to share and type." },
  ];

  return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", padding: "28px clamp(16px, 4vw, 48px)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Header */}
        <motion.div {...fadeUp(0)}>
          <Link href="/dashboard/my-campaigns" style={{ fontSize: 12, color: "#4a5568", display: "inline-block", marginBottom: 8 }}>← My Campaigns</Link>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.03em", marginBottom: 4 }}>QR Codes</div>
          <div style={{ fontSize: 13, color: "#6b7a8d" }}>Share these QR codes to help people discover and donate to your campaign.</div>
        </motion.div>

        {/* QR grid */}
        <motion.div {...fadeUp(0.06)} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
          <QRCard
            title="Campaign Page" tag="Discovery" tagColor={BLUE}
            description="Links to your full campaign details page."
            qrData={campaignQR.data?.qr_code_base64}
            isLoading={campaignQR.isLoading}
            onDownload={() => campaignQR.data?.qr_code_base64 && handleDownload(campaignQR.data.qr_code_base64, "campaign-qr.png")}
            onCopy={() => copy(`${origin}/campaigns/${campaignId}`)}
          />
          <QRCard
            title="Quick Donate" tag="Donations" tagColor={GREEN}
            description="Direct link to the donation form — faster for donors."
            qrData={typeof donationQR.data === "string" ? donationQR.data : undefined}
            isLoading={donationQR.isLoading}
            onDownload={() => typeof donationQR.data === "string" && handleDownload(donationQR.data, "donate-qr.png")}
            onCopy={() => copy(`${origin}/quick-pay/${campaignId}`)}
          />
          <QRCard
            title="Short Link" tag="Alias" tagColor="#a855f7"
            description="Uses your campaign alias for a shorter, memorable URL."
            qrData={typeof shortCodeQR.data === "string" ? shortCodeQR.data : undefined}
            isLoading={shortCodeQR.isLoading}
            onDownload={() => typeof shortCodeQR.data === "string" && handleDownload(shortCodeQR.data, "shortlink-qr.png")}
            onCopy={() => aliases.data?.[0] && copy(`${origin}/c/${aliases.data[0].short_code}`)}
          />
        </motion.div>

        {/* Campaign links */}
        <motion.div {...fadeUp(0.12)}>
          <div style={{ fontSize: 11, color: "#4a5568", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 12 }}>Campaign Links</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <LinkRow label="Campaign page" url={`${origin}/campaigns/${campaignId}`} onCopy={() => copy(`${origin}/campaigns/${campaignId}`)} />
            <LinkRow label="Quick donate" url={`${origin}/quick-pay/${campaignId}`} onCopy={() => copy(`${origin}/quick-pay/${campaignId}`)} />
            {aliases.data?.[0] && (
              <LinkRow label="Short link" url={`${origin}/c/${aliases.data[0].short_code}`} onCopy={() => copy(`${origin}/c/${aliases.data[0].short_code}`)} />
            )}
          </div>
        </motion.div>

        {/* Tips */}
        <motion.div {...fadeUp(0.16)}>
          <div style={{ fontSize: 11, color: "#4a5568", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 12 }}>Tips</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
            {tips.map(({ icon, title, desc }) => (
              <div key={title} style={{
                padding: "16px", borderRadius: 12,
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
              }}>
                <div style={{ fontSize: 20, marginBottom: 8 }}>{icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#f0f6ff", marginBottom: 4 }}>{title}</div>
                <div style={{ fontSize: 12, color: "#6b7a8d", lineHeight: 1.65 }}>{desc}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
