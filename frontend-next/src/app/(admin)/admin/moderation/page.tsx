"use client";

import { useMemo, useState, useEffect } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { AppButton, AppDataTable, AppSpace, AppTag, AppInput, useAppFeedback } from "@/components/ui";
import { Checkbox, Pagination } from "antd";
import { api } from "@/lib/api";
import { useAdminModerationQueue, useAdminGlobalSearch } from "@/hooks/use-frontend-data";
import { AdminModerationReport } from "@/types/frontend";
import type { AdminSearchResultItem } from "@/types/frontend";

export default function AdminModerationPage() {
  const queryClient = useQueryClient();
  const { data } = useAdminModerationQueue(true);
  const { message } = useAppFeedback();
  const MODELS = [
    "campaigns",
    "users",
    "donations",
    "reviews",
    "payouts",
    "kyc",
    "moderation",
  ];

  const [searchQ, setSearchQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedModels, setSelectedModels] = useState<string[]>(MODELS);

  // load saved filters from localStorage
  useEffect(() => {
    try {
      const v = localStorage.getItem("admin_search_models");
      if (v) {
        setSelectedModels(JSON.parse(v));
      } else {
        setSelectedModels(MODELS);
      }
    } catch (e) {
      setSelectedModels(MODELS);
    }
  }, []);

  // persist selected models
  useEffect(() => {
    try {
      localStorage.setItem("admin_search_models", JSON.stringify(selectedModels));
    } catch (e) {
      // ignore
    }
  }, [selectedModels]);

  const modelsParam = selectedModels.length > 0 ? selectedModels.join(",") : undefined;

  // debounce the search input to avoid rapid requests
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchQ.trim()), 400);
    return () => clearTimeout(t);
  }, [searchQ]);

  // reset to first page when query or filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedQ, modelsParam]);

  const search = useAdminGlobalSearch(debouncedQ || undefined, modelsParam, page, pageSize, true);

  const resolveReport = useMutation({
    mutationFn: async ({ id, actionTaken }: { id: number; actionTaken: string }) => {
      await api.post(`/moderation/reports/${id}/resolve`, {
        status: "RESOLVED",
        action_taken: actionTaken,
        moderation_note: "Resolved via React admin table",
      });
    },
    onSuccess: async () => {
      void message.success("Moderation report resolved");
      await queryClient.invalidateQueries({ queryKey: ["admin-moderation-queue"] });
    },
    onError: () => {
      void message.error("Failed to resolve moderation report");
    },
  });

  const columns = useMemo<ColumnDef<AdminModerationReport>[]>(
    () => [
      { header: "ID", accessorKey: "id" },
      { header: "Entity", accessorKey: "reported_entity_type" },
      { header: "Entity ID", accessorKey: "reported_entity_id" },
      { header: "Reason", accessorKey: "reason" },
      {
        header: "Status",
        cell: (info) => {
          const value = String(info.row.original.status ?? "");
          const color = value === "OPEN" ? "red" : value === "RESOLVED" ? "green" : "blue";
          return <AppTag color={color}>{value}</AppTag>;
        },
      },
      { header: "Description", accessorKey: "description" },
      {
        header: "Actions",
        cell: (info) => {
          const row = info.row.original;
          const isOpen = String(row.status) === "OPEN";
          return (
            <AppSpace>
              <AppButton
                size="small"
                disabled={!isOpen || resolveReport.isPending}
                onClick={() => resolveReport.mutate({ id: row.id, actionTaken: "dismissed" })}
              >
                Dismiss
              </AppButton>
              <AppButton
                size="small"
                danger
                disabled={!isOpen || resolveReport.isPending}
                onClick={() =>
                  resolveReport.mutate({ id: row.id, actionTaken: "campaign_suspended" })
                }
              >
                Suspend Campaign
              </AppButton>
            </AppSpace>
          );
        },
      },
      {
        header: "Created",
        cell: (info) => new Date(info.row.original.created_at).toLocaleString(),
      },
    ],
    [resolveReport],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <AppInput
          placeholder="Search across campaigns, users, donations, reviews, payouts, kyc, moderation..."
          value={searchQ}
          onChange={(e) => setSearchQ((e.target as HTMLInputElement).value)}
          style={{ width: "100%" }}
        />
        <AppButton onClick={() => setPage(1)}>Search</AppButton>
        <AppButton
          onClick={() => {
            setSearchQ("");
            setDebouncedQ("");
            setSelectedModels(MODELS);
            setPage(1);
            setPageSize(20);
            try {
              localStorage.removeItem("admin_search_models");
            } catch (e) {
              // ignore
            }
          }}
        >
          Clear filters
        </AppButton>
      </div>

      <div className="text-sm text-gray-500">
        Filters saved for this browser session.
      </div>

      <div className="py-2">
        <div className="text-sm text-gray-600 mb-2">Filter models:</div>
        <Checkbox.Group
          options={MODELS.map((m) => ({ label: m, value: m }))}
          value={selectedModels}
          onChange={(vals) => {
            const sel = vals as string[];
            setSelectedModels(sel);
            setPage(1);
          }}
        />
      </div>

      {searchQ && search.data ? (
        <div>
          <AppDataTable
            title={`Search Results (${search.data.total})`}
            columns={useMemo<ColumnDef<AdminSearchResultItem>[]>(
              () => [
                { header: "Model", accessorKey: "model" },
                { header: "Title", accessorKey: "title" },
                { header: "Subtitle", accessorKey: "subtitle" },
                { header: "Status", accessorKey: "status" },
                { header: "Entity ID", accessorKey: "entity_id" },
                {
                  header: "Created",
                  accessorKey: "created_at",
                  cell: (info) => new Date(info.getValue() as string).toLocaleString(),
                },
                {
                  header: "Actions",
                  cell: (info) => {
                    const row = info.row.original;
                    const openUrl = () => {
                      const id = row.entity_id;
                      const model = row.model;
                      const map: Record<string, string> = {
                          campaign: `/admin/campaigns/${id}/view`,
                          user: `/admin/users/${id}/view`,
                        donation: `/admin/donations/${id}`,
                        review: `/admin/moderation/reviews/${id}`,
                        payout: `/admin/reports/payouts/${id}`,
                          kyc: `/admin/kyc-queue/${id}/view`,
                          moderation: `/admin/moderation-reports`,
                      };
                      const url = map[model] ?? `/admin/${model}/${id}`;
                      window.open(url, "_blank");
                    };
                    return <AppButton size="small" onClick={openUrl}>Open</AppButton>;
                  },
                },
              ],
              [],
            )}
            data={search.data.items ?? []}
            pageSize={pageSize}
            emptyText="No search results. Try a different model filter or open a specific admin detail page directly."
          />

          <div className="pt-4 flex justify-end">
            <Pagination
              current={page}
              pageSize={pageSize}
              total={search.data.total}
              showSizeChanger
              onChange={(p, ps) => {
                setPage(p);
                setPageSize(ps);
              }}
              pageSizeOptions={[10, 20, 50, 100]}
            />
          </div>
        </div>
      ) : (
        <AppDataTable
          title="Moderation Queue"
          columns={columns}
          data={data ?? []}
          pageSize={8}
          emptyText="No moderation reports are open right now. Revisit campaign, user, or KYC detail pages if you need context."
        />
      )}
    </div>
  );
}
