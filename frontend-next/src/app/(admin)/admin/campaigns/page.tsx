"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { AppButton, AppDataTable, AppSpace, AppTag, useAppFeedback } from "@/components/ui";
import { api } from "@/lib/api";
import { useAdminCampaigns } from "@/hooks/use-frontend-data";
import { AdminCampaign } from "@/types/frontend";

export default function AdminCampaignsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data } = useAdminCampaigns(true);
  const { message } = useAppFeedback();

  const updateStatus = useMutation({
    mutationFn: async ({ slug, status }: { slug: string; status: "ACTIVE" | "SUSPENDED" | "CLOSED" }) => {
      await api.patch(`/admin/campaigns/${slug}/status`, null, { params: { status } });
    },
    onSuccess: async () => {
      void message.success("Campaign status updated");
      await queryClient.invalidateQueries({ queryKey: ["admin-campaigns"] });
    },
    onError: () => {
      void message.error("Failed to update campaign status");
    },
  });

  const columns = useMemo<ColumnDef<AdminCampaign>[]>(
    () => [
      { header: "ID", accessorKey: "id" },
      { header: "Title", accessorKey: "title" },
      { header: "Slug", accessorKey: "slug" },
      {
        header: "Status",
        cell: (info) => {
          const value = String(info.row.original.status ?? "");
          const color = value === "ACTIVE" ? "green" : value === "SUSPENDED" ? "volcano" : "gold";
          return <AppTag color={color}>{value}</AppTag>;
        },
      },
      { header: "Raised", accessorKey: "amount_raised" },
      { header: "Target", accessorKey: "target_amount" },
      {
        header: "Actions",
        cell: (info) => {
          const row = info.row.original;
          const status = String(row.status);
          return (
            <AppSpace>
              <AppButton
                size="small"
                onClick={() => router.push(`/admin/campaigns/${row.id}/view`)}
              >
                View
              </AppButton>
              <AppButton
                size="small"
                disabled={status === "SUSPENDED" || updateStatus.isPending}
                onClick={() => updateStatus.mutate({ slug: row.slug, status: "SUSPENDED" })}
              >
                Suspend
              </AppButton>
              <AppButton
                size="small"
                disabled={status === "ACTIVE" || updateStatus.isPending}
                onClick={() => updateStatus.mutate({ slug: row.slug, status: "ACTIVE" })}
              >
                Activate
              </AppButton>
              <AppButton
                size="small"
                danger
                disabled={status === "CLOSED" || updateStatus.isPending}
                onClick={() => updateStatus.mutate({ slug: row.slug, status: "CLOSED" })}
              >
                Close
              </AppButton>
            </AppSpace>
          );
        },
      },
      {
        header: "Created",
        cell: (info) => new Date(info.row.original.created_at).toLocaleDateString(),
      },
    ],
    [updateStatus],
  );

  return <AppDataTable title="Admin Campaigns" columns={columns} data={data ?? []} pageSize={8} />;
}
