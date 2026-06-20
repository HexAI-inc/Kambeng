"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useManageCampaignGoals,
  useCreateCampaignGoal,
  useUpdateCampaignGoal,
  useMyCampaigns,
} from "@/hooks/use-frontend-data";
import { useAppFeedback } from "@/components/ui";
import { StyledSelect } from "@/components/ui/styled-select";
import { CampaignGoalStatus } from "@/types/frontend";
import { motion } from "framer-motion";

const BLUE = "#1dc5ff";
const GREEN = "#1bbf88";

function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.38, delay, ease: "easeOut" as const },
  };
}

function GoalStatusChip({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    ACTIVE:    { color: GREEN,     bg: "rgba(27,191,136,0.12)" },
    DRAFT:     { color: "#fbbf24", bg: "rgba(251,191,36,0.10)" },
    PAUSED:    { color: "#8899aa", bg: "rgba(255,255,255,0.06)" },
    COMPLETED: { color: BLUE,      bg: "rgba(29,197,255,0.10)" },
  };
  const s = map[status] ?? map.PAUSED;
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const,
      padding: "2px 8px", borderRadius: 20, color: s.color, background: s.bg,
    }}>{status}</span>
  );
}

function fmt(n: number) {
  return n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : n.toLocaleString();
}

const STATUS_OPTIONS: CampaignGoalStatus[] = ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"];

export default function CampaignGoalsPage() {
  const params = useParams();
  const campaignId = typeof params.campaignId === "string" ? params.campaignId : null;
  const { message } = useAppFeedback();

  const { data: myCampaigns } = useMyCampaigns(Boolean(campaignId));
  const campaign = useMemo(() => {
    if (!campaignId || !myCampaigns) return null;
    return myCampaigns.find((c) => c.id === Number(campaignId)) ?? null;
  }, [campaignId, myCampaigns]);
  const campaignSlug = campaign?.slug ?? null;

  const { data: goals, isLoading } = useManageCampaignGoals(campaignSlug || undefined);
  const createGoal = useCreateCampaignGoal();
  const updateGoal = useUpdateCampaignGoal();

  const [form, setForm] = useState({ title: "", description: "", target_amount: "", due_date: "", status: "DRAFT" as CampaignGoalStatus });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{ title: string; target_amount: string; status: CampaignGoalStatus }>({ title: "", target_amount: "", status: "DRAFT" });

  if (!campaignId) return <div style={{ color: "#f0f6ff", padding: 32 }}>Invalid campaign ID</div>;

  const handleCreate = async () => {
    if (!form.title.trim()) { message.error("Title is required"); return; }
    if (!campaignSlug) { message.error("Campaign not found"); return; }
    try {
      await createGoal.mutateAsync({
        slug: campaignSlug,
        payload: {
          title: form.title,
          description: form.description || null,
          target_amount: Number(form.target_amount) || 0,
          due_date: form.due_date || null,
          status: form.status,
        },
      });
      message.success("Goal created");
      setForm({ title: "", description: "", target_amount: "", due_date: "", status: "DRAFT" });
    } catch {
      message.error("Failed to create goal");
    }
  };

  const startEdit = (g: { id: number; title: string; target_amount: number; status: string }) => {
    setEditingId(g.id);
    setEditForm({ title: g.title, target_amount: String(g.target_amount), status: g.status as CampaignGoalStatus });
  };

  const handleUpdate = async (goalId: number) => {
    try {
      await updateGoal.mutateAsync({
        goalId,
        payload: { title: editForm.title, target_amount: Number(editForm.target_amount), status: editForm.status },
        slug: campaignSlug ?? undefined,
      });
      message.success("Goal updated");
      setEditingId(null);
    } catch {
      message.error("Failed to update goal");
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)",
    color: "#f0f6ff", fontSize: 13, outline: "none", boxSizing: "border-box",
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle, cursor: "pointer",
  };

  return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", padding: "28px clamp(16px, 4vw, 48px)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Header */}
        <motion.div {...fadeUp(0)}>
          <Link href="/dashboard/my-campaigns" style={{ fontSize: 12, color: "#4a5568", fontWeight: 500, display: "inline-block", marginBottom: 8 }}>
            ← My Campaigns
          </Link>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.03em", marginBottom: 4 }}>
            {campaign?.title ?? "Campaign"} — Goals
          </div>
          <div style={{ fontSize: 13, color: "#6b7a8d" }}>Create milestones to show donors what you&apos;re working toward.</div>
        </motion.div>

        {/* Create form */}
        <motion.div {...fadeUp(0.06)}>
          <div style={{
            background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 14, padding: "22px",
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f0f6ff", marginBottom: 16 }}>Create New Goal</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <input
                  style={inputStyle}
                  placeholder="Goal title (e.g. Buy school supplies)"
                  value={form.title}
                  onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
                />
              </div>
              <input
                style={inputStyle}
                placeholder="Target amount (GMD)"
                type="number"
                value={form.target_amount}
                onChange={(e) => setForm((s) => ({ ...s, target_amount: e.target.value }))}
              />
              <input
                style={inputStyle}
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((s) => ({ ...s, due_date: e.target.value }))}
              />
              <div style={{ gridColumn: "1 / -1" }}>
                <input
                  style={inputStyle}
                  placeholder="Description (optional)"
                  value={form.description}
                  onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                />
              </div>
              <StyledSelect
                value={form.status}
                onChange={(v) => setForm((s) => ({ ...s, status: v as CampaignGoalStatus }))}
                options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
              />
            </div>
            <button
              onClick={() => void handleCreate()}
              disabled={createGoal.isPending || !form.title.trim()}
              style={{
                padding: "11px 24px", borderRadius: 9, border: "none",
                background: form.title.trim() ? `linear-gradient(135deg, ${BLUE}, #079bd4)` : "rgba(255,255,255,0.06)",
                color: form.title.trim() ? "#fff" : "#4a5568",
                fontSize: 13, fontWeight: 700, cursor: form.title.trim() ? "pointer" : "not-allowed",
                boxShadow: form.title.trim() ? "0 4px 14px rgba(29,197,255,0.3)" : "none",
              }}
            >
              {createGoal.isPending ? "Creating…" : "Create goal"}
            </button>
          </div>
        </motion.div>

        {/* Goals list */}
        <motion.div {...fadeUp(0.12)}>
          <div style={{ fontSize: 11, color: "#4a5568", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 12 }}>
            {isLoading ? "Loading…" : `${goals?.length ?? 0} goal${goals?.length !== 1 ? "s" : ""}`}
          </div>

          {isLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[1,2].map((i) => <div key={i} style={{ height: 90, borderRadius: 12, background: "rgba(255,255,255,0.04)" }} />)}
            </div>
          ) : !goals || goals.length === 0 ? (
            <div style={{
              padding: "36px 24px", textAlign: "center",
              background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 14,
            }}>
              <div style={{ fontSize: 13, color: "#4a5568" }}>No goals yet — create your first one above.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {goals.map((g) => {
                const pct = g.target_amount > 0 ? Math.min(100, Math.round((g.amount_raised / g.target_amount) * 100)) : 0;
                const isEditing = editingId === g.id;
                return (
                  <div key={g.id} style={{
                    background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 12, padding: "16px 18px",
                    transition: "border-color 0.2s",
                  }}
                    onMouseEnter={(e) => { if (!isEditing) (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(29,197,255,0.15)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.07)"; }}
                  >
                    {isEditing ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: BLUE, marginBottom: 4 }}>Editing goal</div>
                        <input style={inputStyle} value={editForm.title} onChange={(e) => setEditForm((s) => ({ ...s, title: e.target.value }))} placeholder="Title" />
                        <div style={{ display: "flex", gap: 10 }}>
                          <input style={{ ...inputStyle, flex: 1 }} type="number" value={editForm.target_amount} onChange={(e) => setEditForm((s) => ({ ...s, target_amount: e.target.value }))} placeholder="Target (GMD)" />
                          <StyledSelect
                            value={editForm.status}
                            onChange={(v) => setEditForm((s) => ({ ...s, status: v as CampaignGoalStatus }))}
                            options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
                            style={{ flex: 1 }}
                          />
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => void handleUpdate(g.id)} disabled={updateGoal.isPending} style={{
                            padding: "8px 18px", borderRadius: 8, border: "none",
                            background: `linear-gradient(135deg, ${BLUE}, #079bd4)`,
                            color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
                          }}>
                            {updateGoal.isPending ? "Saving…" : "Save"}
                          </button>
                          <button onClick={() => setEditingId(null)} style={{
                            padding: "8px 16px", borderRadius: 8,
                            border: "1px solid rgba(255,255,255,0.1)", background: "transparent",
                            color: "#6b7a8d", fontSize: 12, fontWeight: 600, cursor: "pointer",
                          }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: "#f0f6ff" }}>{g.title}</span>
                            <GoalStatusChip status={g.status} />
                          </div>
                          {g.description && (
                            <div style={{ fontSize: 12, color: "#6b7a8d", marginBottom: 8, lineHeight: 1.6 }}>{g.description}</div>
                          )}
                          <div style={{ height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 99, overflow: "hidden", marginBottom: 5 }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${BLUE}, #079bd4)`, borderRadius: 99 }} />
                          </div>
                          <div style={{ fontSize: 11, color: "#4a5568" }}>
                            <span style={{ color: GREEN, fontWeight: 700 }}>{fmt(g.amount_raised)} GMD</span>
                            {" raised · "}
                            <span>{pct}% of {fmt(g.target_amount)} GMD</span>
                            {g.due_date && <span> · Due {new Date(g.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>}
                          </div>
                        </div>
                        <button onClick={() => startEdit(g)} style={{
                          padding: "7px 14px", borderRadius: 8, flexShrink: 0,
                          border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)",
                          color: "#8899aa", fontSize: 12, fontWeight: 600, cursor: "pointer",
                        }}>Edit</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
