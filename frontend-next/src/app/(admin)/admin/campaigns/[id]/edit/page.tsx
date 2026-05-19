"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAdminCampaignDetail } from "@/hooks/use-frontend-data";
import { api } from "@/lib/api";

const BLUE = "#1dc5ff";
const GREEN = "#1bbf88";

function Field({ label, value, mono }: { label: string; value: string | number | null | undefined; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{label}</div>
      <div style={{ padding: "10px 14px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.03)", color: "#8899aa", fontSize: 13, fontFamily: mono ? "monospace" : undefined }}>{value ?? "—"}</div>
    </div>
  );
}

const STATUSES = ["ACTIVE", "SUSPENDED", "CLOSED"] as const;
type CampaignStatus = typeof STATUSES[number];

const STATUS_COLORS: Record<CampaignStatus, { color: string; bg: string; border: string }> = {
  ACTIVE:    { color: GREEN,      bg: "rgba(27,191,136,0.12)",  border: "rgba(27,191,136,0.4)" },
  SUSPENDED: { color: "#f97316", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.4)" },
  CLOSED:    { color: "#8899aa", bg: "rgba(255,255,255,0.08)", border: "rgba(255,255,255,0.2)" },
};

export default function CampaignEditPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const campaignId = Array.isArray(params?.id) ? parseInt(params.id[0]) : parseInt(params?.id as string);
  const { data: campaign, isLoading, error } = useAdminCampaignDetail(campaignId);

  const [status, setStatus] = useState<CampaignStatus | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  const updateMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      await api.patch(`/admin/campaigns/${campaign?.slug}/status`, null, { params: { status: newStatus } });
    },
    onSuccess: async () => {
      showToast("Campaign updated", true);
      await queryClient.invalidateQueries({ queryKey: ["admin-campaigns"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-campaign-detail", campaignId] });
      setTimeout(() => router.back(), 800);
    },
    onError: () => showToast("Failed to update campaign", false),
  });

  const effectiveStatus = (status ?? String(campaign?.status ?? "ACTIVE")) as CampaignStatus;

  if (isLoading) {
    return (
      <div style={{ background: "#0a0f1a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, border: `2px solid ${BLUE}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div style={{ background: "#0a0f1a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>😕</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#f0f6ff", marginBottom: 8 }}>Campaign not found</div>
          <button onClick={() => router.back()} style={{ padding: "9px 20px", borderRadius: 9, border: "none", background: `linear-gradient(135deg, ${BLUE}, #079bd4)`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Go back</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", padding: "28px clamp(16px,4vw,48px)" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

        {toast && (
          <div style={{ position: "fixed", top: 24, right: 24, zIndex: 999, padding: "12px 20px", borderRadius: 10, background: toast.ok ? "rgba(27,191,136,0.15)" : "rgba(239,68,68,0.15)", border: `1px solid ${toast.ok ? "rgba(27,191,136,0.3)" : "rgba(239,68,68,0.3)"}`, color: toast.ok ? GREEN : "#ef4444", fontSize: 13, fontWeight: 600, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>{toast.msg}</div>
        )}

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => router.back()} style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#8899aa", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>←</button>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.03em" }}>Edit Campaign #{campaignId}</div>
          </div>
        </motion.div>

        <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "24px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ gridColumn: "1 / -1" }}><Field label="Title" value={campaign.title} /></div>
            <Field label="Slug" value={campaign.slug} mono />
            <Field label="Mode" value={String(campaign.mode ?? "—")} />
            <Field label="Amount Raised" value={`${Number(campaign.amount_raised ?? 0).toLocaleString()} GMD`} />
            <Field label="Target Amount" value={campaign.target_amount ? `${Number(campaign.target_amount).toLocaleString()} GMD` : "No target"} />
          </div>

          {/* Editable: status */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#8899aa", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Campaign Status</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {STATUSES.map((s) => {
                const c = STATUS_COLORS[s];
                const isSelected = effectiveStatus === s;
                return (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    style={{
                      padding: "9px 22px", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer",
                      border: `1px solid ${isSelected ? c.border : "rgba(255,255,255,0.1)"}`,
                      background: isSelected ? c.bg : "rgba(255,255,255,0.04)",
                      color: isSelected ? c.color : "#8899aa",
                    }}
                  >{s}</button>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => { if (status) updateMutation.mutate(status); else router.back(); }}
            disabled={updateMutation.isPending}
            style={{ padding: "11px 24px", borderRadius: 9, border: "none", background: `linear-gradient(135deg, ${BLUE}, #079bd4)`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px rgba(29,197,255,0.3)" }}
          >
            {updateMutation.isPending ? "Saving…" : "Save Changes"}
          </button>
          <button onClick={() => router.back()} style={{ padding: "11px 22px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#8899aa", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
