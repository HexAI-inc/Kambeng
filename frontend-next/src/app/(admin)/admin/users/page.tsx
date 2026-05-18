"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";

import { AppButton, AppDataTable, AppSpace, AppTag, useAppFeedback } from "@/components/ui";
import { useAdminUsers, useUpdateAdminUserStatus } from "@/hooks/use-frontend-data";
import { AdminUserOverview } from "@/types/frontend";

export default function AdminUsersPage() {
  const router = useRouter();
  const { data } = useAdminUsers(true);
  const { message } = useAppFeedback();
  const updateUserStatus = useUpdateAdminUserStatus();

  const columns = useMemo<ColumnDef<AdminUserOverview>[]>(
    () => [
      { header: "ID", accessorKey: "id" },
      { header: "Name", accessorKey: "full_name" },
      { header: "Email", accessorKey: "email" },
      { header: "Wave", accessorKey: "wave_number" },
      {
        header: "Role",
        cell: (info) => {
          const value = String(info.row.original.role ?? "");
          return <AppTag color={value === "ADMIN" ? "volcano" : "blue"}>{value}</AppTag>;
        },
      },
      {
        header: "Account",
        cell: (info) => {
          const value = info.row.original.is_active ? "ACTIVE" : "SUSPENDED";
          const color = value === "ACTIVE" ? "green" : "volcano";
          return <AppTag color={color}>{value}</AppTag>;
        },
      },
      {
        header: "KYC",
        cell: (info) => {
          const value = String(info.row.original.kyc_status ?? "");
          const color = value === "APPROVED" ? "green" : value === "REJECTED" ? "red" : "orange";
          return <AppTag color={color}>{value}</AppTag>;
        },
      },
      { header: "Campaigns", accessorKey: "campaign_count" },
      { header: "Raised", accessorKey: "total_raised" },
      {
        header: "Actions",
        cell: (info) => {
          const row = info.row.original;
          return (
            <AppSpace>
              <AppButton
                size="small"
                onClick={() => router.push(`/admin/users/${row.id}/view`)}
              >
                View
              </AppButton>
              <AppButton
                size="small"
                danger={row.is_active}
                disabled={updateUserStatus.isPending}
                onClick={() =>
                  updateUserStatus.mutate(
                    { userId: row.id, status: row.is_active ? "SUSPENDED" : "ACTIVE" },
                    {
                      onSuccess: () => {
                        void message.success(row.is_active ? "User suspended" : "User reactivated");
                      },
                      onError: () => {
                        void message.error("Failed to update user status");
                      },
                    },
                  )
                }
              >
                {row.is_active ? "Suspend" : "Reactivate"}
              </AppButton>
            </AppSpace>
          );
        },
      },
    ],
    [message, updateUserStatus, router],
  );

  return <AppDataTable title="Admin Users" columns={columns} data={data ?? []} pageSize={8} />;
}
