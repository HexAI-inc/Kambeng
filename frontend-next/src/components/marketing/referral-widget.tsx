"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const BLUE = "#1dc5ff";
const GREEN = "#1bbf88";

type ReferralInfo = { referral_code: string; share_link: string };

export default function ReferralWidget() {
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get<ReferralInfo>("/users/me/referral-code")
      .then((res) => { if (!cancelled) setInfo(res.data); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const copyLink = async () => {
    if (!info) return;
    try {
      await navigator.clipboard.writeText(info.share_link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable — silently ignore
    }
  };

  if (!info) return null;

  return (
    <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#4a5568", letterSpacing: "0.08em", textTransform: "uppercase" }}>Invite organisers</span>
      </div>
      <div style={{ padding: "14px 18px" }}>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "#8899aa", lineHeight: 1.6 }}>
          Share your link — when someone you refer launches a campaign, your next withdrawal fee is waived.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{
            flex: 1, minWidth: 0, padding: "9px 12px", borderRadius: 9,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            fontSize: 11, color: "#c0ccd8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {info.share_link}
          </div>
          <button
            onClick={copyLink}
            style={{
              flexShrink: 0, padding: "9px 14px", borderRadius: 9, border: "none", cursor: "pointer",
              background: copied ? "rgba(27,191,136,0.15)" : `${BLUE}20`,
              color: copied ? GREEN : BLUE, fontSize: 11, fontWeight: 700,
            }}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}
