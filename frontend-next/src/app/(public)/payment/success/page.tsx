"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const GREEN = "#1bbf88";
const BLUE = "#1dc5ff";
const RED = "#ef4444";

type DonationStatus = {
  client_reference: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED";
  amount: number;
  campaign_slug: string | null;
  campaign_title: string | null;
};

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const ref = searchParams?.get("ref");
  const slug = searchParams?.get("slug");

  const [donation, setDonation] = useState<DonationStatus | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!ref || fetchedRef.current) return;
    fetchedRef.current = true;
    fetch(`/api/backend/payments/donations/${ref}/status`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: DonationStatus | null) => { if (data) setDonation(data); })
      .catch(() => undefined);
  }, [ref]);

  const campaignSlug = donation?.campaign_slug ?? slug;
  const isConfirmed = donation?.status === "SUCCEEDED";
  const isFailed = donation?.status === "FAILED";
  const isPending = !isConfirmed && !isFailed;

  const statusColor = isConfirmed ? GREEN : isFailed ? RED : BLUE;
  const icon = isConfirmed ? "✓" : isFailed ? "✕" : null;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1a", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px" }}>
      <div style={{ width: "100%", maxWidth: 460, textAlign: "center" }}>

        {/* Icon */}
        <div style={{
          width: 72, height: 72, borderRadius: "50%", margin: "0 auto 24px",
          background: `rgba(${isConfirmed ? "27,191,136" : isFailed ? "239,68,68" : "29,197,255"},0.1)`,
          border: `2px solid ${statusColor}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 28, fontWeight: 900, color: statusColor,
        }}>
          {icon ?? (
            <div style={{ width: 28, height: 28, border: `3px solid ${BLUE}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.9s linear infinite" }} />
          )}
        </div>

        <div style={{ fontSize: 24, fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.03em", marginBottom: 10 }}>
          {isConfirmed ? "Donation confirmed!" : isFailed ? "Payment not completed" : "Payment received"}
        </div>

        <div style={{ fontSize: 14, color: "#6b7a8d", lineHeight: 1.7, marginBottom: 28 }}>
          {isConfirmed && donation ? (
            <>
              Thank you — your donation of{" "}
              <strong style={{ color: GREEN }}>{donation.amount.toLocaleString()} GMD</strong>{" "}
              to <strong style={{ color: "#f0f6ff" }}>{donation.campaign_title ?? "this campaign"}</strong> has been confirmed.
            </>
          ) : isFailed ? (
            <>The payment could not be completed. No funds have been taken. You can try again below.</>
          ) : (
            <>
              Your payment is on its way. We&apos;re waiting for confirmation from Wave — this usually takes a few seconds.
              If it doesn&apos;t reflect on the campaign shortly, please check your Wave app.
            </>
          )}
        </div>

        {donation?.status && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px",
            borderRadius: 20, marginBottom: 28, fontSize: 11, fontWeight: 700,
            letterSpacing: "0.07em", textTransform: "uppercase",
            background: `rgba(${isConfirmed ? "27,191,136" : isFailed ? "239,68,68" : "29,197,255"},0.1)`,
            color: statusColor,
            border: `1px solid rgba(${isConfirmed ? "27,191,136" : isFailed ? "239,68,68" : "29,197,255"},0.25)`,
          }}>
            {donation.status}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {campaignSlug && (
            <Link
              href={`/campaigns/${campaignSlug}`}
              style={{ display: "block", padding: "13px", borderRadius: 10, background: `linear-gradient(135deg, ${BLUE}, #079bd4)`, color: "#fff", fontSize: 14, fontWeight: 700, textDecoration: "none", boxShadow: "0 4px 20px rgba(29,197,255,0.3)" }}
            >
              {isPending ? "Back to campaign" : isConfirmed ? "See campaign" : "Back to campaign"}
            </Link>
          )}
          {(isFailed || isPending) && campaignSlug && (
            <Link
              href={`/quick-pay/${campaignSlug}`}
              style={{ display: "block", padding: "12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#8899aa", fontSize: 14, fontWeight: 600, textDecoration: "none" }}
            >
              {isFailed ? "Try again" : "Donate again"}
            </Link>
          )}
          {!campaignSlug && (
            <Link href="/campaigns" style={{ display: "block", padding: "13px", borderRadius: 10, background: `linear-gradient(135deg, ${BLUE}, #079bd4)`, color: "#fff", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
              Browse campaigns
            </Link>
          )}
        </div>

        {ref && (
          <div style={{ marginTop: 24, fontSize: 11, color: "#2d3748" }}>
            Ref: {ref}
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
