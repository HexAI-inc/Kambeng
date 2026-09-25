"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { isAxiosError } from "axios";

import { AppButton, AppCard, AppForm, AppInput, AppSelect, useAppFeedback } from "@/components/ui";
import { useCreateCampaign } from "@/hooks/use-create-campaign";
import { CampaignClassificationFields } from "@/components/campaigns/campaign-classification-fields";
import { BeneficiaryFields } from "@/components/campaigns/beneficiary-fields";
import { useMyOrganizations } from "@/hooks/use-frontend-data";
import type { CampaignDiscoveryItem } from "@/types/frontend";

const BLUE = "#14784a";
const GREEN = "#1f9960";

function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.38, delay, ease: "easeOut" as const },
  };
}

const campaignSchema = z
  .object({
    title: z.string().trim().min(3, "Campaign title must be at least 3 characters").max(120, "Campaign title is too long"),
    description: z.string().trim().min(10, "Description must be at least 10 characters").max(2000, "Description is too long"),
    mode: z.enum(["TARGET", "ONGOING"]),
    // Whole dalasi only — the API rejects bututs.
    target_amount: z.number().int("Target must be a whole number of dalasi").positive("Target amount must be greater than zero").optional(),
    category: z.string({ error: "Pick a category so donors can find your campaign" }).min(1, "Pick a category so donors can find your campaign"),
    tags: z.array(z.string()).max(8, "Use at most 8 tags"),
    beneficiary_type: z.enum(["self", "someone_else", "organization"]),
    organization_id: z.number().int().optional(),
    // Undefined = let the server decide (on for schools and alumni associations).
    class_board_enabled: z.boolean().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.beneficiary_type === "organization" && typeof values.organization_id !== "number") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["organization_id"],
        message: "Choose the organization you're raising for",
      });
    }
    if (values.mode === "TARGET" && typeof values.target_amount !== "number") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["target_amount"],
        message: "Target amount is required for target campaigns",
      });
    }
  });

type CampaignFormValues = z.infer<typeof campaignSchema>;

type CampaignCreatePageProps = {
  variant: "user" | "admin";
};

type ValidationErrorItem = {
  loc?: Array<string | number>;
  msg?: string;
};

function getCampaignCreateErrorMessage(error: unknown) {
  if (!isAxiosError(error)) {
    return "We could not create the campaign. Please try again.";
  }

  const status = error.response?.status;
  if (status === 401) {
    return "You need to sign in again before creating a campaign.";
  }
  if (status === 403) {
    return "Your account is not yet allowed to create campaigns. Complete KYC and try again.";
  }

  const data = error.response?.data as { detail?: string | ValidationErrorItem[] } | undefined;
  const detail = data?.detail;

  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }

  if (Array.isArray(detail)) {
    const fieldErrors = detail
      .map((item) => {
        const field = item.loc?.[item.loc.length - 1];
        const message = item.msg?.trim();

        if (!message) {
          return null;
        }

        return typeof field === "string" ? `${field}: ${message}` : message;
      })
      .filter((value): value is string => Boolean(value));

    if (fieldErrors.length > 0) {
      return fieldErrors.join(" ");
    }
  }

  return "We could not create the campaign. Please try again.";
}

function getVariantCopy(variant: CampaignCreatePageProps["variant"]) {
  if (variant === "admin") {
    return {
      eyebrow: "Admin workspace",
      title: "Create campaign",
      description: "Launch a new campaign from the admin area and jump straight into the campaign record.",
      backHref: "/admin/campaigns",
      backLabel: "Back to campaigns",
      successMessage: (campaign: CampaignDiscoveryItem) => `Created ${campaign.title}. Opening the admin record now.`,
      successHref: (campaign: CampaignDiscoveryItem) => `/admin/campaigns/${campaign.id}/view`,
      submitLabel: "Create campaign",
    };
  }

  return {
    eyebrow: "Campaign creator",
    title: "Create campaign",
    description: "Build a new campaign, then continue to uploads and QR codes from your dashboard.",
    backHref: "/dashboard/my-campaigns",
    backLabel: "Back to my campaigns",
      successMessage: (campaign: CampaignDiscoveryItem) => `Created ${campaign.title}. Taking you to campaign images now.`,
    successHref: (campaign: CampaignDiscoveryItem) => `/dashboard/my-campaigns/${campaign.id}/images`,
    submitLabel: "Create campaign",
  };
}

export function CampaignCreatePage({ variant }: CampaignCreatePageProps) {
  const router = useRouter();
  const createCampaign = useCreateCampaign();
  const { message } = useAppFeedback();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const copy = getVariantCopy(variant);

  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      title: "",
      description: "",
      mode: "TARGET",
      target_amount: undefined,
      category: undefined,
      tags: [],
      beneficiary_type: "self",
      organization_id: undefined,
      class_board_enabled: undefined,
    },
  });
  const { data: organizations = [] } = useMyOrganizations(true);

  const mode = useWatch({ control: form.control, name: "mode" });
  const beneficiaryType = useWatch({ control: form.control, name: "beneficiary_type" });
  const organizationId = useWatch({ control: form.control, name: "organization_id" });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    const payload = {
      title: values.title.trim(),
      description: values.description.trim(),
      mode: values.mode,
      category: values.category,
      tags: values.tags,
      beneficiary_type: values.beneficiary_type,
      ...(values.beneficiary_type === "organization" ? { organization_id: values.organization_id } : {}),
      ...(values.class_board_enabled !== undefined ? { class_board_enabled: values.class_board_enabled } : {}),
      ...(values.mode === "TARGET" && typeof values.target_amount === "number"
        ? { target_amount: values.target_amount }
        : {}),
    };

    try {
      const created = await createCampaign.mutateAsync(payload);
      message.success(copy.successMessage(created));
      router.replace(copy.successHref(created), { scroll: false });
    } catch (error) {
      setSubmitError(getCampaignCreateErrorMessage(error));

      if (isAxiosError(error) && error.response?.status === 422) {
        const detail = error.response.data?.detail;

        if (Array.isArray(detail)) {
          detail.forEach((item) => {
            const field = item.loc?.[item.loc.length - 1];
            const message = item.msg?.trim();

            if (typeof field === "string" && message && field in values) {
              form.setError(field as keyof CampaignFormValues, { type: "server", message });
            }
          });
        }
      }
    }
  });

  return (
    <div style={{ minHeight: "100vh", padding: "28px clamp(16px, 4vw, 48px)" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
        <motion.div {...fadeUp(0)} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: BLUE, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>{copy.eyebrow}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#15201a", letterSpacing: "-0.04em", marginTop: 6 }}>{copy.title}</div>
            <div style={{ fontSize: 13, color: "#626d66", marginTop: 6, maxWidth: 640, lineHeight: 1.65 }}>{copy.description}</div>
          </div>
          <Link href={copy.backHref} style={{ textDecoration: "none" }}>
            <button style={{
              padding: "9px 16px",
              borderRadius: 9,
              border: "1px solid rgba(21,32,26,0.1)",
              background: "#fff",
              color: "#56625b",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}>
              {copy.backLabel}
            </button>
          </Link>
        </motion.div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(320px, 0.9fr)", gap: 16, alignItems: "start" }}>
          <motion.div {...fadeUp(0.06)} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <AppCard
              title="Why this flow works"
              style={{ background: "#ffffff", borderColor: "rgba(21,32,26,0.07)", color: "#15201a" }}
            >
              <div style={{ display: "grid", gap: 12 }}>
                {[
                  ["Fast launch", "Create the campaign now and continue to the next management step immediately."],
                  ["Shared logic", "Admins and users use the same form and the same backend create endpoint."],
                  ["Campaign ready", "Choose a target or ongoing mode and set a target amount only when needed."],
                ].map(([title, text]) => (
                  <div key={title} style={{ padding: 14, borderRadius: 12, background: "#fff", border: "1px solid rgba(21,32,26,0.05)" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#15201a", marginBottom: 4 }}>{title}</div>
                    <div style={{ fontSize: 12, color: "#626d66", lineHeight: 1.6 }}>{text}</div>
                  </div>
                ))}
              </div>
            </AppCard>

            <AppCard
              title="Next steps"
              style={{ background: "#f1f8f4", borderColor: "rgba(20,120,74,0.14)", color: "#15201a" }}
            >
              <div style={{ fontSize: 13, color: "#626d66", lineHeight: 1.7 }}>
                After saving, you can add images, manage goals, or jump to the public campaign page depending on where you started.
              </div>
            </AppCard>
          </motion.div>

          <motion.div {...fadeUp(0.1)}>
            <AppCard title="Campaign details" style={{ background: "#ffffff", borderColor: "rgba(21,32,26,0.07)" }}>
              <AppForm layout="vertical" onFinish={onSubmit}>
                <Controller
                  name="title"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: "block", marginBottom: 6, color: "#15201a", fontSize: 13, fontWeight: 600 }}>Campaign title</label>
                      <AppInput
                        {...field}
                        value={field.value ?? ""}
                        placeholder="E.g. Village Clinic Upgrade"
                        style={{ background: "#fff", borderColor: fieldState.error ? "rgba(239,68,68,0.35)" : "rgba(21,32,26,0.1)", color: "#15201a", borderRadius: 10, padding: "10px 12px" }}
                      />
                      {fieldState.error && <div style={{ marginTop: 6, color: "#b42323", fontSize: 12 }}>{fieldState.error.message}</div>}
                    </div>
                  )}
                />

                <Controller
                  name="description"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: "block", marginBottom: 6, color: "#15201a", fontSize: 13, fontWeight: 600 }}>Description</label>
                      <AppInput.TextArea
                        {...field}
                        value={field.value ?? ""}
                        rows={6}
                        placeholder="Describe what the campaign is for, who it helps, and what the funds will support."
                        style={{ background: "#fff", borderColor: fieldState.error ? "rgba(239,68,68,0.35)" : "rgba(21,32,26,0.1)", color: "#15201a", borderRadius: 10, padding: 12 }}
                      />
                      {fieldState.error && <div style={{ marginTop: 6, color: "#b42323", fontSize: 12 }}>{fieldState.error.message}</div>}
                    </div>
                  )}
                />

                <Controller
                  name="beneficiary_type"
                  control={form.control}
                  render={({ field: typeField }) => (
                    <Controller
                      name="organization_id"
                      control={form.control}
                      render={({ field: orgField, fieldState: orgState }) => (
                        <BeneficiaryFields
                          value={typeField.value}
                          onChange={typeField.onChange}
                          organizationId={orgField.value}
                          onOrganizationChange={orgField.onChange}
                          organizations={organizations}
                          error={orgState.error?.message}
                          showWithdrawalNote={variant === "user"}
                        />
                      )}
                    />
                  )}
                />

                <Controller
                  name="class_board_enabled"
                  control={form.control}
                  render={({ field }) => {
                    const org = organizations.find((o) => o.id === organizationId);
                    const defaultOn = beneficiaryType === "organization"
                      && (org?.org_type === "SCHOOL" || org?.org_type === "ALUMNI_ASSOCIATION");
                    const checked = field.value ?? defaultOn;
                    return (
                      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 16, cursor: "pointer" }}>
                        <input type="checkbox" checked={checked} onChange={(e) => field.onChange(e.target.checked)} style={{ marginTop: 3, accentColor: BLUE }} />
                        <span>
                          <span style={{ display: "block", color: "#15201a", fontSize: 13, fontWeight: 600 }}>Show a giving-by-class board</span>
                          <span style={{ display: "block", color: "#626d66", fontSize: 12, marginTop: 2, lineHeight: 1.5 }}>
                            Donors can add their graduating class, and classes compete on the campaign page. Great for alumni.
                          </span>
                        </span>
                      </label>
                    );
                  }}
                />

                <Controller
                  name="mode"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: "block", marginBottom: 6, color: "#15201a", fontSize: 13, fontWeight: 600 }}>Campaign mode</label>
                      <AppSelect
                        value={field.value}
                        onChange={(value) => field.onChange(value)}
                        onBlur={field.onBlur}
                        options={[
                          { value: "TARGET", label: "Target campaign" },
                          { value: "ONGOING", label: "Ongoing campaign" },
                        ]}
                        style={{ width: "100%" }}
                      />
                      {fieldState.error && <div style={{ marginTop: 6, color: "#b42323", fontSize: 12 }}>{fieldState.error.message}</div>}
                    </div>
                  )}
                />

                <Controller
                  name="target_amount"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <div style={{ marginBottom: 18 }}>
                      <label style={{ display: "block", marginBottom: 6, color: "#15201a", fontSize: 13, fontWeight: 600 }}>
                        Target amount {mode === "TARGET" ? <span style={{ color: GREEN }}>(required)</span> : <span style={{ color: "#626d66" }}>(optional)</span>}
                      </label>
                      <AppInput
                        type="number"
                        min={0}
                        step="1"
                        value={field.value ?? ""}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          field.onChange(nextValue === "" ? undefined : Number(nextValue));
                        }}
                        onBlur={field.onBlur}
                        placeholder="5000"
                        style={{ background: "#fff", borderColor: fieldState.error ? "rgba(239,68,68,0.35)" : "rgba(21,32,26,0.1)", color: "#15201a", borderRadius: 10, padding: "10px 12px" }}
                      />
                      {fieldState.error && <div style={{ marginTop: 6, color: "#b42323", fontSize: 12 }}>{fieldState.error.message}</div>}
                    </div>
                  )}
                />

                <Controller
                  name="category"
                  control={form.control}
                  render={({ field: categoryField, fieldState: categoryState }) => (
                    <Controller
                      name="tags"
                      control={form.control}
                      render={({ field: tagsField, fieldState: tagsState }) => (
                        <CampaignClassificationFields
                          category={categoryField.value}
                          tags={tagsField.value ?? []}
                          onCategoryChange={(value) => categoryField.onChange(value ?? undefined)}
                          onTagsChange={tagsField.onChange}
                          categoryError={categoryState.error?.message}
                          tagsError={tagsState.error?.message}
                          categoryRequired
                        />
                      )}
                    />
                  )}
                />

                {(submitError || createCampaign.isError) && (
                  <div style={{ marginBottom: 14, padding: "12px 14px", borderRadius: 10, background: "#fef0f0", border: "1px solid rgba(239,68,68,0.22)", color: "#b42323", fontSize: 13 }}>
                    {submitError ?? "We could not create the campaign. Please try again."}
                  </div>
                )}

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <AppButton htmlType="submit" type="primary" loading={createCampaign.isPending} style={{ background: `${BLUE}`, border: "none", color: "#fff", fontWeight: 700 }}>
                    {copy.submitLabel}
                  </AppButton>
                  <AppButton htmlType="button" onClick={() => form.reset()} disabled={createCampaign.isPending} style={{ background: "#fff", borderColor: "rgba(21,32,26,0.1)", color: "#56625b", fontWeight: 600 }}>
                    Reset
                  </AppButton>
                </div>
              </AppForm>
            </AppCard>
          </motion.div>
        </div>
      </div>
    </div>
  );
}