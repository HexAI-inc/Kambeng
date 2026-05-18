"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  AppAlert,
  AppBadge,
  AppButton,
  AppCard,
  AppCol,
  AppDataTable,
  AppForm,
  AppInputField,
  AppPageHeader,
  AppRow,
  AppSelectField,
  AppSpace,
  AppTag,
  AppText,
  useAppFeedback,
} from "@/components/ui";

const campaignSchema = z.object({
  title: z.string().min(3, "Title should be at least 3 characters."),
  category: z.enum(["education", "health", "emergency"]),
});

type CampaignFormValues = z.infer<typeof campaignSchema>;

type CampaignRow = {
  id: number;
  title: string;
  category: string;
  status: "open" | "draft" | "closed";
};

const seedRows: CampaignRow[] = [
  { id: 1, title: "Community Borehole", category: "Health", status: "open" },
  { id: 2, title: "Girls STEM Workshop", category: "Education", status: "draft" },
  { id: 3, title: "Flood Recovery Kits", category: "Emergency", status: "closed" },
];

export default function UIKitPage() {
  const [rows, setRows] = useState<CampaignRow[]>(seedRows);
  const { message } = useAppFeedback();

  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      title: "",
      category: "education",
    },
  });

  const columns = useMemo<ColumnDef<CampaignRow>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Campaign",
      },
      {
        accessorKey: "category",
        header: "Category",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = row.original.status;
          const color = status === "open" ? "green" : status === "draft" ? "gold" : "red";
          return <AppTag color={color}>{status.toUpperCase()}</AppTag>;
        },
      },
    ],
    [],
  );

  const submit = form.handleSubmit((values) => {
    setRows((prev) => [
      {
        id: prev.length + 1,
        title: values.title,
        category: values.category[0].toUpperCase() + values.category.slice(1),
        status: "draft",
      },
      ...prev,
    ]);

    form.reset({ title: "", category: "education" });
    void message.success("Campaign added with shared UI components.");
  });

  return (
    <AppSpace direction="vertical" size={16} style={{ width: "100%" }}>
      <AppPageHeader
        title="UI Kit"
        description="Approved building blocks for all frontend flows."
        actions={<AppBadge count={rows.length} showZero color="#1dc5ff" />}
      />

      <AppAlert
        type="info"
        showIcon
        title="This page is the component contract"
        description="New flows should compose from components in src/components/ui instead of direct local one-off markup."
      />

      <AppRow gutter={[16, 16]}>
        <AppCol xs={24} lg={10}>
          <AppCard title="Create Campaign (Sample Form)">
            <AppForm layout="vertical" onFinish={submit}>
              <AppInputField
                name="title"
                control={form.control}
                label="Campaign title"
                inputProps={{ placeholder: "E.g. Village Clinic Upgrade" }}
              />
              <AppSelectField
                name="category"
                control={form.control}
                label="Category"
                selectProps={{
                  options: [
                    { value: "education", label: "Education" },
                    { value: "health", label: "Health" },
                    { value: "emergency", label: "Emergency" },
                  ],
                }}
              />
              <AppSpace size={10}>
                <AppButton htmlType="submit" type="primary">
                  Submit
                </AppButton>
                <AppButton onClick={() => form.reset()}>Reset</AppButton>
              </AppSpace>
            </AppForm>
          </AppCard>
        </AppCol>

        <AppCol xs={24} lg={14}>
          <AppDataTable title="Campaign Dataset" columns={columns} data={rows} pageSize={5} />
        </AppCol>
      </AppRow>

      <AppText type="secondary">Route: /dashboard/ui-kit</AppText>
    </AppSpace>
  );
}
