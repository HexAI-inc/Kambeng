"use client";

import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAdminCampaignDetail } from "@/hooks/use-frontend-data";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";

const BLUE = "#1dc5ff";
const GREEN = "#1bbf88";

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, color: "#f0f6ff", fontFamily: mono ? "monospace" : undefined }}>{value ?? "—"}</div>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string; border: string }> = {
    ACTIVE:    { color: GREEN, bg: "rgba(27,191,136,0.12)", border: "rgba(27,191,136,0.25)" },
    SUSPENDED: { color: "#f97316", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.25)" },
    CLOSED:    { color: "#8899aa", bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.1)" },
  };
  const s = map[status] ?? map.CLOSED;
  return <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", padding: "4px 12px", borderRadius: 20, color: s.color, background: s.bg, border: `1px solid ${s.border}` }}>{status}</span>;
}

export default function CampaignViewPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const campaignId = Array.isArray(params?.id) ? parseInt(params.id[0]) : parseInt(params?.id as string);
  const { data: campaign, isLoading, error } = useAdminCampaignDetail(campaignId);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      await api.patch(`/admin/campaigns/${campaign?.slug}/status`, null, { params: { status } });
    },
    onSuccess: async () => {
      showToast("Status updated", true);
      await queryClient.invalidateQueries({ queryKey: ["admin-campaign-detail", campaignId] });
    },
    onError: () => showToast("Failed to update status", false),
  });

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
      <div style={{ background: "#0a0f1a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>😕</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#f0f6ff", marginBottom: 8 }}>Campaign not found</div>
          <button onClick={() => router.back()} style={{ padding: "9px 20px", borderRadius: 9, border: "none", background: `linear-gradient(135deg, ${BLUE}, #079bd4)`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Go back</button>
        </div>
      </div>
    );
  }

  const progress = campaign.target_amount ? Math.min((campaign.amount_raised / campaign.target_amount) * 100, 100) : 0;

  return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", padding: "28px clamp(16px,4vw,48px)" }}>
      <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
        {toast && (
          <div style={{ position: "fixed", top: 24, right: 24, zIndex: 999, padding: "12px 20px", borderRadius: 10, background: toast.ok ? "rgba(27,191,136,0.15)" : "rgba(239,68,68,0.15)", border: `1px solid ${toast.ok ? "rgba(27,191,136,0.3)" : "rgba(239,68,68,0.3)"}`, color: toast.ok ? GREEN : "#ef4444", fontSize: 13, fontWeight: 600, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>{toast.msg}</div>
        )}

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <button onClick={() => router.back()} style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#8899aa", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>←</button>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.03em" }}>Campaign #{campaignId}</div>
            <StatusChip status={String(campaign.status)} />
          </div>
          <div style={{ fontSize: 13, color: "#6b7a8d", marginLeft: 46 }}>{campaign.slug}</div>
        </motion.div>

        {/* Info card */}
        <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <Field label="Title" value={<span style={{ fontSize: 18, fontWeight: 800 }}>{campaign.title}</span>} />
            </div>
            <Field label="Status" value={<StatusChip status={String(campaign.status)} />} />
            <Field label="Mode" value={campaign.mode ?? "—"} />
            <Field label="Amount Raised" value={<span style={{ color: GREEN, fontWeight: 700 }}>{Number(campaign.amount_raised ?? 0).toLocaleString()} GMD</span>} />
            <Field label="Target Amount" value={campaign.target_amount ? `${Number(campaign.target_amount).toLocaleString()} GMD` : "No target"} />
            <Field label="Slug" value={campaign.slug} mono />
            <Field label="Created At" value={new Date(campaign.created_at).toLocaleString()} />
            {campaign.target_amount && (
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Progress</div>
                <div style={{ height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${progress}%`, background: `linear-gradient(90deg, ${BLUE}, ${GREEN})`, borderRadius: 4, transition: "width 0.5s" }} />
                </div>
                <div style={{ fontSize: 12, color: "#4a5568", marginTop: 4 }}>{Math.round(progress)}% of goal</div>
              </div>
            )}
            {campaign.description && (
              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="Description" value={<p style={{ color: "#8899aa", lineHeight: 1.7, margin: 0 }}>{campaign.description}</p>} />
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => router.push(`/admin/campaigns/${campaign.id}/edit`)} style={{ padding: "10px 20px", borderRadius: 9, border: "none", background: `linear-gradient(135deg, ${BLUE}, #079bd4)`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Edit Campaign</button>
          {String(campaign.status) !== "ACTIVE" && (
            <button onClick={() => updateStatus.mutate("ACTIVE")} disabled={updateStatus.isPending} style={actionBtn("green")}>Activate</button>
          )}
          {String(campaign.status) !== "SUSPENDED" && (
            <button onClick={() => updateStatus.mutate("SUSPENDED")} disabled={updateStatus.isPending} style={actionBtn("orange")}>Suspend</button>
          )}
          {String(campaign.status) !== "CLOSED" && (
            <button onClick={() => updateStatus.mutate("CLOSED")} disabled={updateStatus.isPending} style={actionBtn("red")}>Close</button>
          )}
          <button onClick={() => router.back()} style={actionBtn("default")}>Back</button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function actionBtn(v: "default" | "green" | "orange" | "red"): React.CSSProperties {
  const m = {
    default: { c: "#8899aa", b: "rgba(255,255,255,0.1)", bg: "rgba(255,255,255,0.04)" },
    green:   { c: "#1bbf88", b: "rgba(27,191,136,0.25)", bg: "rgba(27,191,136,0.08)" },
    orange:  { c: "#f97316", b: "rgba(249,115,22,0.25)", bg: "rgba(249,115,22,0.08)" },
    red:     { c: "#ef4444", b: "rgba(239,68,68,0.25)", bg: "rgba(239,68,68,0.08)" },
  }[v];
  return { padding: "10px 20px", borderRadius: 9, border: `1px solid ${m.b}`, background: m.bg, color: m.c, fontSize: 13, fontWeight: 700, cursor: "pointer" };
}
