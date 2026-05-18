"use client";

import { useMemo } from "react";
import Link from "next/link";
import dayjs, { Dayjs } from "dayjs";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";

import {
  useAdminAuditLogs,
  useAdminCampaigns,
  useAdminFinancialSummary,
  useAdminPayoutsOverview,
  useAdminSystemStats,
  useAdminTransactions,
} from "@/hooks/use-frontend-data";
import {
  AdminAuditLog,
  AdminPayoutOverview,
  AdminTransaction,
} from "@/types/frontend";
import {
  AppBreadcrumb,
  AppButton,
  AppCard,
  AppCol,
  AppDataTable,
  AppRangePicker,
  AppRow,
  AppSelect,
  AppSpace,
  AppStatistic,
  AppTag,
  AppText,
  AppTitle,
} from "@/components/ui";

export default function AdminReportsPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: summary } = useAdminFinancialSummary(true);
  const { data: systemStats } = useAdminSystemStats(true);
  const { data: transactions } = useAdminTransactions(true);
  const { data: campaigns } = useAdminCampaigns(true);
  const { data: payouts } = useAdminPayoutsOverview(true);
  const { data: auditLogs } = useAdminAuditLogs(true);

  const statusFilter = searchParams.get("status") ?? "ALL";
  const typeFilter = searchParams.get("type") ?? "ALL";
  const campaignFilter = searchParams.get("campaign") ?? "ALL";
  const fromDate = searchParams.get("from");
  const toDate = searchParams.get("to");

  const updateQueryParams = useMemo(
    () =>
      (updates: Record<string, string | null>) => {
        const params = new URLSearchParams(searchParams.toString());
        Object.entries(updates).forEach(([key, value]) => {
          if (!value || value === "ALL") {
            params.delete(key);
          } else {
            params.set(key, value);
          }
        });
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      },
    [pathname, router, searchParams],
  );

  const statusOptions = useMemo(() => {
    const values = Array.from(new Set((transactions ?? []).map((item) => String(item.status ?? "")))).filter(Boolean);
    return [{ label: "All statuses", value: "ALL" }, ...values.map((value) => ({ label: value, value }))];
  }, [transactions]);

  const typeOptions = useMemo(() => {
    const values = Array.from(new Set((transactions ?? []).map((item) => String(item.transaction_type ?? "")))).filter(Boolean);
    return [{ label: "All types", value: "ALL" }, ...values.map((value) => ({ label: value, value }))];
  }, [transactions]);

  const campaignOptions = useMemo(
    () => [
      { label: "All campaigns", value: "ALL" },
      ...((campaigns ?? []).map((campaign) => ({
        label: `${campaign.title} (#${campaign.id})`,
        value: String(campaign.id),
      }))),
    ],
    [campaigns],
  );

  const filteredTransactions = useMemo(() => {
    const fromBoundary = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const toBoundary = toDate ? new Date(`${toDate}T23:59:59`).getTime() : null;

    return (transactions ?? []).filter((item) => {
      if (statusFilter !== "ALL" && String(item.status) !== statusFilter) return false;
      if (typeFilter !== "ALL" && String(item.transaction_type) !== typeFilter) return false;
      if (campaignFilter !== "ALL" && String(item.campaign_id) !== campaignFilter) return false;

      const createdAt = new Date(item.created_at).getTime();
      if (fromBoundary && createdAt < fromBoundary) return false;
      if (toBoundary && createdAt > toBoundary) return false;
      return true;
    });
  }, [campaignFilter, fromDate, statusFilter, toDate, transactions, typeFilter]);

  const selectedDateRange = useMemo<[Dayjs, Dayjs] | null>(() => {
    if (!fromDate || !toDate) return null;
    const from = dayjs(fromDate, "YYYY-MM-DD", true);
    const to = dayjs(toDate, "YYYY-MM-DD", true);
    if (!from.isValid() || !to.isValid()) return null;
    return [from, to];
  }, [fromDate, toDate]);

  const transactionColumns = useMemo<ColumnDef<AdminTransaction>[]>(
    () => [
      { header: "ID", accessorKey: "id" },
      {
        header: "Campaign",
        cell: (info) => {
          const campaignId = info.row.original.campaign_id;
          return <Link href={`/admin/reports/campaign/${campaignId}`}>#{campaignId}</Link>;
        },
      },
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
      {
        header: "Actions",
        cell: (info) => {
          const campaignId = info.row.original.campaign_id;
          return (
            <Link href={`/admin/reports/campaign/${campaignId}`}>
              <AppButton size="small">View</AppButton>
            </Link>
          );
        },
      },
    ],
    [],
  );

  const payoutColumns = useMemo<ColumnDef<AdminPayoutOverview>[]>(
    () => [
      { header: "Payout", accessorKey: "payout_id" },
      { header: "Campaign", accessorKey: "campaign_title" },
      { header: "User", accessorKey: "user_name" },
      { header: "Gross", accessorKey: "gross_amount" },
      { header: "Net", accessorKey: "net_amount" },
      {
        header: "Status",
        cell: (info) => {
          const value = String(info.row.original.status ?? "");
          const color = value === "SUCCEEDED" ? "green" : value === "FAILED" ? "red" : "gold";
          return <AppTag color={color}>{value}</AppTag>;
        },
      },
      {
        header: "Created",
        cell: (info) => new Date(info.row.original.created_at).toLocaleString(),
      },
    ],
    [],
  );

  const auditColumns = useMemo<ColumnDef<AdminAuditLog>[]>(
    () => [
      { header: "ID", accessorKey: "id" },
      { header: "Action", accessorKey: "action_type" },
      { header: "Entity", accessorKey: "target_entity_type" },
      { header: "Description", accessorKey: "description" },
      {
        header: "When",
        cell: (info) => new Date(info.row.original.created_at).toLocaleString(),
      },
    ],
    [],
  );

  return (
    <AppSpace direction="vertical" size={16} style={{ width: "100%" }}>
      <AppBreadcrumb
        items={[
          { title: <Link href="/admin">Admin</Link> },
          { title: "Reports" },
        ]}
      />
      <AppTitle level={2} style={{ margin: 0 }}>
        Admin Reports
      </AppTitle>
      <AppText type="secondary">
        Pending donations appear here immediately after initiation and transition when webhook updates arrive.
      </AppText>

      <AppCard>
        <AppSpace wrap size={12} style={{ width: "100%" }}>
          <AppSelect
            value={statusFilter}
            options={statusOptions}
            onChange={(value) => updateQueryParams({ status: value })}
            style={{ minWidth: 170 }}
          />
          <AppSelect
            value={typeFilter}
            options={typeOptions}
            onChange={(value) => updateQueryParams({ type: value })}
            style={{ minWidth: 170 }}
          />
          <AppSelect
            showSearch
            value={campaignFilter}
            options={campaignOptions}
            onChange={(value) => updateQueryParams({ campaign: value })}
            style={{ minWidth: 280 }}
            optionFilterProp="label"
          />
          <AppRangePicker
            value={selectedDateRange}
            onChange={(values) => {
              if (!values || values.length !== 2) {
                updateQueryParams({ from: null, to: null });
                return;
              }
              updateQueryParams({
                from: values[0] ? values[0].format("YYYY-MM-DD") : null,
                to: values[1] ? values[1].format("YYYY-MM-DD") : null,
              });
            }}
          />
          <AppButton
            onClick={() => {
              updateQueryParams({
                status: null,
                type: null,
                campaign: null,
                from: null,
                to: null,
              });
            }}
          >
            Reset filters
          </AppButton>
          <AppText type="secondary">{filteredTransactions.length} transaction(s) shown</AppText>
          {campaignFilter !== "ALL" ? (
            <Link href={`/admin/reports/campaign/${campaignFilter}`}>
              <AppButton type="primary">Open campaign report</AppButton>
            </Link>
          ) : null}
        </AppSpace>
      </AppCard>

      <AppRow gutter={[16, 16]}>
        <AppCol xs={24} sm={12} lg={6}>
          <AppCard>
            <AppStatistic title="Transactions" value={summary?.transaction_count ?? 0} />
          </AppCard>
        </AppCol>
        <AppCol xs={24} sm={12} lg={6}>
          <AppCard>
            <AppStatistic title="Total Donations" value={summary?.total_donations ?? 0} precision={2} suffix="GMD" />
          </AppCard>
        </AppCol>
        <AppCol xs={24} sm={12} lg={6}>
          <AppCard>
            <AppStatistic title="Total Withdrawals" value={summary?.total_withdrawals ?? 0} precision={2} suffix="GMD" />
          </AppCard>
        </AppCol>
        <AppCol xs={24} sm={12} lg={6}>
          <AppCard>
            <AppStatistic title="Platform Revenue" value={systemStats?.total_platform_revenue ?? 0} precision={2} suffix="GMD" />
          </AppCard>
        </AppCol>
      </AppRow>

      <AppRow gutter={[16, 16]}>
        <AppCol xs={24} sm={12} lg={6}>
          <AppCard>
            <AppStatistic title="Users" value={systemStats?.total_users ?? 0} />
          </AppCard>
        </AppCol>
        <AppCol xs={24} sm={12} lg={6}>
          <AppCard>
            <AppStatistic title="Active Campaigns" value={systemStats?.active_campaigns ?? 0} />
          </AppCard>
        </AppCol>
        <AppCol xs={24} sm={12} lg={6}>
          <AppCard>
            <AppStatistic title="KYC Pending" value={systemStats?.kyc_pending_count ?? 0} />
          </AppCard>
        </AppCol>
        <AppCol xs={24} sm={12} lg={6}>
          <AppCard>
            <AppStatistic title="KYC Approved" value={systemStats?.kyc_approved_count ?? 0} />
          </AppCard>
        </AppCol>
      </AppRow>

      <AppDataTable
        title="Transactions"
        columns={transactionColumns}
        data={filteredTransactions}
        pageSize={10}
        emptyText="No transactions matched these filters. Open a campaign report to inspect one campaign end-to-end."
      />

      <AppDataTable
        title="Payouts Overview"
        columns={payoutColumns}
        data={payouts ?? []}
        pageSize={8}
      />

      <AppDataTable
        title="Audit Logs"
        columns={auditColumns}
        data={auditLogs ?? []}
        pageSize={8}
      />
    </AppSpace>
  );
}
