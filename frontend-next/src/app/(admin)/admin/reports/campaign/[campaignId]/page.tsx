"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";

import {
  useAdminCampaignFinancialReport,
  useAdminCampaigns,
  useAdminTransactions,
} from "@/hooks/use-frontend-data";
import { AdminTransaction } from "@/types/frontend";
import {
  AppAlert,
  AppCard,
  AppCol,
  AppDataTable,
  AppRow,
  AppSpace,
  AppStatistic,
  AppTag,
  AppText,
  AppTitle,
} from "@/components/ui";

export default function CampaignReportDetailPage() {
  const params = useParams<{ campaignId: string }>();
  const campaignId = Number(params?.campaignId ?? 0);

  const { data: campaigns } = useAdminCampaigns(true);
  const { data: summary, isLoading, isError } = useAdminCampaignFinancialReport(campaignId, true);
  const { data: transactions } = useAdminTransactions(true);

  const campaign = useMemo(
    () => (campaigns ?? []).find((item) => item.id === campaignId),
    [campaignId, campaigns],
  );

  const campaignTransactions = useMemo(
    () => (transactions ?? []).filter((item) => item.campaign_id === campaignId),
    [transactions, campaignId],
  );

  const transactionColumns = useMemo<ColumnDef<AdminTransaction>[]>(
    () => [
      { header: "ID", accessorKey: "id" },
      {
        header: "Type",
        cell: (info) => <AppTag color="blue">{String(info.row.original.transaction_type)}</AppTag>,
      },
      {
        header: "Status",
        cell: (info) => {
          const value = String(info.row.original.status ?? "");
          const color = value === "SUCCEEDED" ? "green" : value === "FAILED" ? "red" : "gold";
          return <AppTag color={color}>{value}</AppTag>;
        },
      },
      { header: "Gross", accessorKey: "gross_amount" },
      { header: "Net", accessorKey: "net_amount" },
      { header: "Reference", accessorKey: "external_reference" },
      {
        header: "Created",
        cell: (info) => new Date(info.row.original.created_at).toLocaleString(),
      },
    ],
    [],
  );

  if (!campaignId) {
    return <AppAlert type="error" title="Invalid campaign identifier" showIcon />;
  }

  return (
    <AppSpace direction="vertical" size={16} style={{ width: "100%" }}>
      <AppSpace direction="vertical" size={4} style={{ width: "100%" }}>
        <Link href="/admin/reports">Back to reports</Link>
        <AppTitle level={2} style={{ margin: 0 }}>
          Campaign Report #{campaignId}
        </AppTitle>
        <AppText type="secondary">{campaign?.title ?? "Campaign title unavailable"}</AppText>
      </AppSpace>

      {isError ? (
        <AppAlert
          type="error"
          description="This campaign may not exist, or your session does not have access."
          title="Unable to load campaign report"
          showIcon
        />
      ) : null}

      <AppRow gutter={[16, 16]}>
        <AppCol xs={24} sm={12} lg={6}>
          <AppCard loading={isLoading}>
            <AppStatistic title="Transactions" value={summary?.transaction_count ?? 0} />
          </AppCard>
        </AppCol>
        <AppCol xs={24} sm={12} lg={6}>
          <AppCard loading={isLoading}>
            <AppStatistic title="Total Donations" value={summary?.total_donations ?? 0} precision={2} suffix="GMD" />
          </AppCard>
        </AppCol>
        <AppCol xs={24} sm={12} lg={6}>
          <AppCard loading={isLoading}>
            <AppStatistic title="Total Withdrawals" value={summary?.total_withdrawals ?? 0} precision={2} suffix="GMD" />
          </AppCard>
        </AppCol>
        <AppCol xs={24} sm={12} lg={6}>
          <AppCard loading={isLoading}>
            <AppStatistic title="Net Total" value={summary?.net_total ?? 0} precision={2} suffix="GMD" />
          </AppCard>
        </AppCol>
      </AppRow>

      <AppDataTable
        title="Campaign Transactions"
        columns={transactionColumns}
        data={campaignTransactions}
        pageSize={10}
      />
    </AppSpace>
  );
}
