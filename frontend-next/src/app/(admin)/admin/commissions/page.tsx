"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import {
  useAdminCommissionsSummary,
  useAdminCommissionSources,
  useWithdrawCommissions,
} from "@/hooks/use-frontend-data";
import type { CommissionSourceItem } from "@/types/frontend";
import { AppDataTable } from "@/components/ui/data/data-table";
import { AppButton } from "@/components/ui/primitives/button";
import { AppPageHeader } from "@/components/ui/layout/page-header";
import { AppCard, AppStatistic, AppSpace } from "@/components/ui";
import { message, Modal, Input, Form, InputNumber } from "antd";

export default function AdminCommissionsPage() {
  const router = useRouter();
  const { data: summary } = useAdminCommissionsSummary(true);
  const { data: sources } = useAdminCommissionSources(0, 100, true);
  const withdrawMutation = useWithdrawCommissions();
  
  const [isWithdrawalModalOpen, setIsWithdrawalModalOpen] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState<number | null>(null);
  const [withdrawalReason, setWithdrawalReason] = useState("");

  const handleWithdraw = async () => {
    if (!withdrawalAmount || withdrawalAmount <= 0) {
      message.error("Please enter a valid withdrawal amount");
      return;
    }

    try {
      await withdrawMutation.mutateAsync({
        amount: withdrawalAmount,
        reason: withdrawalReason || undefined,
      });
      message.success("Commission withdrawal request created successfully");
      setIsWithdrawalModalOpen(false);
      setWithdrawalAmount(null);
      setWithdrawalReason("");
    } catch (error) {
      message.error("Failed to create withdrawal request");
    }
  };

  const sourceColumns = useMemo<ColumnDef<CommissionSourceItem>[]>(
    () => [
      {
        header: "Campaign",
        cell: ({ row }) => (
          <div>
            <div className="font-semibold">{row.original.campaign_title}</div>
            <div className="text-sm text-gray-500">#{row.original.campaign_id}</div>
          </div>
        ),
      },
      {
        header: "User",
        cell: ({ row }) => (
          <div>
            <div className="font-semibold">{row.original.user_name}</div>
            <div className="text-sm text-gray-500">#{row.original.user_id}</div>
          </div>
        ),
      },
      {
        header: "Gross Amount",
        accessorKey: "gross_amount",
        cell: ({ getValue }) => `${getValue<number>().toFixed(2)} GMD`,
      },
      {
        header: "Commission",
        accessorKey: "platform_commission",
        cell: ({ getValue }) => (
          <span className="font-semibold text-green-600">
            +{getValue<number>().toFixed(2)} GMD
          </span>
        ),
      },
      {
        header: "Status",
        accessorKey: "status",
        cell: ({ getValue }) => {
          const status = String(getValue());
          const colors: Record<string, string> = {
            PENDING: "bg-yellow-100 text-yellow-800",
            SUCCEEDED: "bg-green-100 text-green-800",
            FAILED: "bg-red-100 text-red-800",
          };
          return (
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${colors[status] || "bg-gray-100 text-gray-800"}`}>
              {status}
            </span>
          );
        },
      },
      {
        header: "Date",
        accessorKey: "created_at",
        cell: ({ getValue }) => new Date(String(getValue())).toLocaleDateString(),
      },
      {
        header: "Actions",
        cell: ({ row }) => (
          <AppButton size="small" onClick={() => router.push(`/admin/campaigns/${row.original.campaign_id}/view`)}>
            View Campaign
          </AppButton>
        ),
      },
    ],
    [router]
  );

  return (
    <div className="space-y-6">
      <AppPageHeader 
        title="Commissions & Revenue" 
        description="Manage platform commissions and withdraw your revenue"
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <AppCard>
          <AppStatistic 
            title="Total Commissions" 
            value={summary?.total_commissions ?? 0}
            suffix=" GMD"
            precision={2}
          />
        </AppCard>
        <AppCard>
          <AppStatistic 
            title="Available" 
            value={summary?.available_commissions ?? 0}
            suffix=" GMD"
            precision={2}
            valueStyle={{ color: '#52c41a' }}
          />
        </AppCard>
        <AppCard>
          <AppStatistic 
            title="Withdrawn" 
            value={summary?.withdrawn_commissions ?? 0}
            suffix=" GMD"
            precision={2}
            valueStyle={{ color: '#1890ff' }}
          />
        </AppCard>
        <AppCard>
          <AppStatistic 
            title="Pending" 
            value={summary?.pending_commissions ?? 0}
            suffix=" GMD"
            precision={2}
            valueStyle={{ color: '#faad14' }}
          />
        </AppCard>
      </div>

      {/* Withdrawal Actions */}
      <div className="flex gap-4">
        <AppButton
          type="primary"
          onClick={() => setIsWithdrawalModalOpen(true)}
          disabled={(summary?.available_commissions ?? 0) <= 0}
          loading={withdrawMutation.isPending}
        >
          Withdraw Available Commissions
        </AppButton>
      </div>

      {/* Commission Sources Table */}
      <AppDataTable<CommissionSourceItem>
        title="Commission Sources"
        columns={sourceColumns}
        data={sources ?? []}
        pageSize={20}
        emptyText="No commission sources yet. Open a campaign detail page to review campaign activity."
      />

      {/* Withdrawal Modal */}
      <Modal
        title="Withdraw Commissions"
        open={isWithdrawalModalOpen}
        onOk={handleWithdraw}
        onCancel={() => {
          setIsWithdrawalModalOpen(false);
          setWithdrawalAmount(null);
          setWithdrawalReason("");
        }}
        confirmLoading={withdrawMutation.isPending}
      >
        <Form layout="vertical" className="mt-4">
          <Form.Item label="Amount (GMD)">
            <InputNumber
              min={0}
              max={summary?.available_commissions ?? 0}
              step={0.01}
              precision={2}
              value={withdrawalAmount}
              onChange={setWithdrawalAmount}
              placeholder={`Max: ${(summary?.available_commissions ?? 0).toFixed(2)} GMD`}
              style={{ width: "100%" }}
            />
          </Form.Item>
          <Form.Item label="Reason (Optional)">
            <Input.TextArea
              value={withdrawalReason}
              onChange={(e) => setWithdrawalReason(e.target.value)}
              placeholder="Why are you withdrawing these commissions?"
              rows={3}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
