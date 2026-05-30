"use client";

import React from "react";
import { useAdminPayoutsOverview } from "@/hooks/use-frontend-data";

export default function PayoutsPage() {
  const { data: payouts } = useAdminPayoutsOverview(true);

  return (
    <div style={{ padding: "28px clamp(16px,4vw,48px)", minHeight: "100vh", background: "#0a0f1a" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: "#f0f6ff" }}>Payouts</h1>
        <div style={{ marginTop: 12 }}>
          <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 13, fontWeight: 700, color: "#f0f6ff" }}>Recent payouts</div>
            <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 140px 110px 110px 110px 90px", padding: "10px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 10, fontWeight: 700, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.07em" }}>
              {["Payout", "Campaign", "User", "Gross", "Net", "Status", "Date"].map((h) => <div key={h}>{h}</div>)}
            </div>
            {(payouts ?? []).length === 0 ? (
              <div style={{ padding: "36px 24px", textAlign: "center", color: "#4a5568", fontSize: 14 }}>No payouts yet</div>
            ) : (payouts ?? []).map((p, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "80px 1fr 140px 110px 110px 110px 90px", padding: "12px 18px", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.04)", transition: "background 0.15s" }}>
                <div style={{ fontSize: 12, color: "#4a5568" }}>#{p.payout_id}</div>
                <div style={{ fontSize: 13, color: "#f0f6ff", fontWeight: 600 }}>{p.campaign_title}</div>
                <div style={{ fontSize: 12, color: "#8899aa" }}>{p.user_name}</div>
                <div style={{ fontSize: 13, color: "#f0f6ff" }}>{p.gross_amount}</div>
                <div style={{ fontSize: 13, color: "#1bbf88" }}>{p.net_amount}</div>
                <div style={{ fontSize: 12 }}>{p.status}</div>
                <div style={{ fontSize: 11, color: "#4a5568" }}>{new Date(p.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
