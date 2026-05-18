"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  useManageCampaignGoals,
  useCreateCampaignGoal,
  useUpdateCampaignGoal,
  useMyCampaigns,
} from "@/hooks/use-frontend-data";
import {
  AppButton,
  AppCard,
  AppSpace,
  AppInput,
  AppSelect,
  AppDatePicker,
  useAppFeedback,
} from "@/components/ui";
import { CampaignGoalStatus } from "@/types/frontend";

export default function CampaignGoalsManagePage() {
  const params = useParams();
  const campaignId = typeof params.campaignId === "string" ? params.campaignId : null;

  const { message } = useAppFeedback();

  const { data: myCampaigns } = useMyCampaigns(Boolean(campaignId));
  const campaignSlug = useMemo(() => {
    if (!campaignId || !myCampaigns) return null;
    const c = myCampaigns.find((it) => it.id === Number(campaignId));
    return c?.slug ?? null;
  }, [campaignId, myCampaigns]);

  const { data: goals, isLoading } = useManageCampaignGoals(campaignSlug || undefined);
  const createGoal = useCreateCampaignGoal();
  const updateGoal = useUpdateCampaignGoal();

  const [form, setForm] = useState({
    title: "",
    description: "",
    target_amount: "",
    due_date: null as string | null,
    status: "DRAFT",
  });

  const [editingId, setEditingId] = useState<number | null>(null);

  if (!campaignId) return <div>Invalid campaign ID</div>;

  const handleCreate = async () => {
    if (!campaignSlug) return message.error("Campaign not found");
    try {
      await createGoal.mutateAsync({ slug: campaignSlug, payload: {
        title: form.title,
        description: form.description || null,
        target_amount: Number(form.target_amount) || 0,
        due_date: form.due_date || null,
        status: form.status as CampaignGoalStatus,
      }});
      message.success("Goal created");
      setForm({ title: "", description: "", target_amount: "", due_date: null, status: "DRAFT" });
    } catch {
      message.error("Failed to create goal");
    }
  };

  const handleUpdate = async (goalId: number, updates: any) => {
    try {
      await updateGoal.mutateAsync({ goalId, payload: updates, slug: campaignSlug ?? undefined });
      message.success("Goal updated");
      setEditingId(null);
    } catch {
      message.error("Failed to update goal");
    }
  };

  return (
    <AppSpace direction="vertical" size="large">
      <div>
        <h1>Manage Goals</h1>
        <p>Create and edit goals for your campaign</p>
      </div>

      <AppCard>
        <AppSpace direction="vertical" size="large">
          <h3>Create New Goal</h3>
          <AppSpace>
            <AppInput
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
            />
            <AppInput
              placeholder="Target amount"
              value={form.target_amount}
              onChange={(e) => setForm((s) => ({ ...s, target_amount: e.target.value }))}
            />
            <AppDatePicker
              value={form.due_date}
              onChange={(d) => setForm((s) => ({ ...s, due_date: d as unknown as string }))}
            />
            <AppSelect
              value={form.status}
              onChange={(val) => setForm((s) => ({ ...s, status: String(val) }))}
              options={[{ label: "DRAFT", value: "DRAFT" }, { label: "ACTIVE", value: "ACTIVE" }, { label: "PAUSED", value: "PAUSED" }]}
            />
            <AppButton onClick={handleCreate} loading={createGoal.isPending}>Create</AppButton>
          </AppSpace>
        </AppSpace>
      </AppCard>

      <AppCard>
        <h3>Existing Goals</h3>
        {isLoading ? (
          <p>Loading goals...</p>
        ) : goals && goals.length > 0 ? (
          <AppSpace direction="vertical" size="medium">
            {goals.map((g) => (
              <div key={g.id}>
                {editingId === g.id ? (
                  <AppSpace>
                    <AppInput defaultValue={g.title} onChange={(e) => (g.title = e.target.value)} />
                    <AppInput defaultValue={String(g.target_amount)} onChange={(e) => (g.target_amount = Number(e.target.value))} />
                    <AppSelect defaultValue={g.status} options={[{ label: "DRAFT", value: "DRAFT" }, { label: "ACTIVE", value: "ACTIVE" }, { label: "PAUSED", value: "PAUSED" }, { label: "COMPLETED", value: "COMPLETED" }]} onChange={(v) => (g.status = String(v) as CampaignGoalStatus)} />
                    <AppButton onClick={() => handleUpdate(g.id, { title: g.title, target_amount: Number(g.target_amount), status: g.status })} loading={updateGoal.isPending}>Save</AppButton>
                    <AppButton type="text" onClick={() => setEditingId(null)}>Cancel</AppButton>
                  </AppSpace>
                ) : (
                  <AppSpace>
                    <div style={{ minWidth: 320 }}>
                      <strong>{g.title}</strong>
                      <div>{g.description}</div>
                      <div>Target: ₵{g.target_amount} • Raised: ₵{g.amount_raised}</div>
                      <div>Status: {g.status} • Due: {g.due_date ?? "—"}</div>
                    </div>
                    <AppButton onClick={() => setEditingId(g.id)}>Edit</AppButton>
                  </AppSpace>
                )}
              </div>
            ))}
          </AppSpace>
        ) : (
          <p>No goals created yet</p>
        )}
      </AppCard>
    </AppSpace>
  );
}
