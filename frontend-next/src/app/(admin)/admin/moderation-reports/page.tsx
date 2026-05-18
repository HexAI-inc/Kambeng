"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useAdminModerationQueue,
  useResolveModerationReport,
} from "@/hooks/use-frontend-data";
import { AppButton, AppCard, AppDataTable, AppSpace, AppTag, useAppFeedback } from "@/components/ui";
import styles from "./moderation-reports.module.css";

type ResolutionAction = "content_removed" | "content_reinstated" | "user_warned" | "user_suspended";

const RESOLUTION_ACTIONS: Record<ResolutionAction, string> = {
  content_removed: "Remove Content",
  content_reinstated: "Reinstate Content",
  user_warned: "Warn User",
  user_suspended: "Suspend User",
};

export default function ModerationReportsPage() {
  const router = useRouter();
  const { data: reports, isLoading } = useAdminModerationQueue();
  const resolveReport = useResolveModerationReport();
  const { message } = useAppFeedback();

  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [selectedAction, setSelectedAction] = useState<ResolutionAction | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");

  const handleResolveSubmit = async () => {
    if (!resolvingId || !selectedAction) {
      message.error("Please select an action");
      return;
    }

    try {
      await resolveReport.mutateAsync({
        reportId: resolvingId,
        action: selectedAction,
        note: resolutionNote,
      });
      message.success("Report resolved successfully");
      setResolvingId(null);
      setSelectedAction(null);
      setResolutionNote("");
    } catch (error) {
      message.error("Failed to resolve report");
    }
  };

  const columns = [
    {
      accessorKey: "id",
      header: "ID",
      size: 60,
    },
    {
      accessorKey: "reason",
      header: "Reason",
      size: 140,
    },
    {
      accessorKey: "reported_entity_type",
      header: "Entity Type",
      size: 120,
    },
    {
      accessorKey: "status",
      header: "Status",
      size: 100,
      cell: (info: any) => {
        const status = info.row.original.status;
        const statusConfig: Record<string, { color: string; text: string }> = {
          open: { color: "orange", text: "Open" },
          in_progress: { color: "blue", text: "In Progress" },
          resolved: { color: "green", text: "Resolved" },
        };
        const config = statusConfig[status.toLowerCase()] || { color: "default", text: status };
        return <AppTag color={config.color as any}>{config.text}</AppTag>;
      },
    },
    {
      accessorKey: "created_at",
      header: "Reported",
      size: 120,
      cell: (info: any) => new Date(info.row.original.created_at).toLocaleDateString(),
    },
    {
      header: "Actions",
      size: 180,
      cell: (info: any) => {
        const report = info.row.original;
        const isResolved = report.status.toLowerCase() === "resolved";

        if (isResolved) {
          return (
            <div className={styles.resolvedStatus}>
              <span>Resolved</span>
              {report.action_taken && (
                <span className={styles.action}>
                  ({RESOLUTION_ACTIONS[report.action_taken as ResolutionAction] || report.action_taken})
                </span>
              )}
            </div>
          );
        }

        return (
          <div className={styles.actions}>
            <AppButton
              size="small"
              onClick={() => setResolvingId(report.id)}
            >
              Review
            </AppButton>
            <AppButton
              type="text"
              size="small"
              onClick={() => {
                if (report.campaign_id) {
                  router.push(`/admin/campaigns/${report.campaign_id}/view`);
                  return;
                }

                if (report.reported_by_user_id) {
                  router.push(`/admin/users/${report.reported_by_user_id}/view`);
                }
              }}
              disabled={!report.campaign_id && !report.reported_by_user_id}
            >
              View
            </AppButton>
          </div>
        );
      },
    },
  ];

  return (
    <AppSpace direction="vertical" size="large" className={styles.container}>
      <div>
        <h1>Moderation Reports</h1>
        <p className={styles.subtitle}>
          Review and resolve user-reported content ({reports?.length || 0} total)
        </p>
      </div>

      {resolvingId && (
        <AppCard className={styles.resolutionModal}>
          <AppSpace direction="vertical" size="large">
            <div>
              <h3>Resolve Report #{resolvingId}</h3>
              <p className={styles.modalHint}>
                Choose an action and add notes about your decision
              </p>
            </div>

            <div className={styles.actionGrid}>
              {(Object.keys(RESOLUTION_ACTIONS) as ResolutionAction[]).map((action) => (
                <button
                  key={action}
                  className={styles.actionButton + (selectedAction === action ? " " + styles.selected : "")}
                  onClick={() => setSelectedAction(action)}
                >
                  <span className={styles.actionLabel}>
                    {RESOLUTION_ACTIONS[action]}
                  </span>
                </button>
              ))}
            </div>

            <div>
              <label className={styles.label}>Resolution Notes (Optional)</label>
              <textarea
                className={styles.noteInput}
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="Document your reasoning for this action..."
                rows={4}
              />
            </div>

            <div className={styles.modalActions}>
              <AppButton
                type="primary"
                onClick={handleResolveSubmit}
                disabled={!selectedAction}
                loading={resolveReport.isPending}
              >
                Confirm Resolution
              </AppButton>
              <AppButton
                onClick={() => {
                  setResolvingId(null);
                  setSelectedAction(null);
                  setResolutionNote("");
                }}
              >
                Cancel
              </AppButton>
            </div>
          </AppSpace>
        </AppCard>
      )}

      <AppCard>
        <AppDataTable
          data={reports || []}
          columns={columns}
          isLoading={isLoading}
          expandableRows
          renderExpandedRow={(row) => (
            <ReportDetailsPanel report={row} />
          )}
          emptyText="No moderation reports are waiting. Campaign and user detail pages provide the surrounding context if needed."
        />
      </AppCard>
    </AppSpace>
  );
}

interface ReportDetailsPanelProps {
  report: any;
}

function ReportDetailsPanel({ report }: ReportDetailsPanelProps) {
  return (
    <div className={styles.detailsPanel}>
      <AppSpace direction="vertical" size="medium">
        <div className={styles.detailsGrid}>
          <div className={styles.detailItem}>
            <span className={styles.label}>Report ID:</span>
            <span>{report.id}</span>
          </div>

          <div className={styles.detailItem}>
            <span className={styles.label}>Reason:</span>
            <span>{report.reason}</span>
          </div>

          <div className={styles.detailItem}>
            <span className={styles.label}>Entity Type:</span>
            <span>{report.reported_entity_type}</span>
          </div>

          <div className={styles.detailItem}>
            <span className={styles.label}>Entity ID:</span>
            <span>{report.reported_entity_id}</span>
          </div>

          <div className={styles.detailItem}>
            <span className={styles.label}>Status:</span>
            <AppTag>{report.status}</AppTag>
          </div>

          <div className={styles.detailItem}>
            <span className={styles.label}>Reported:</span>
            <span>{new Date(report.created_at).toLocaleString()}</span>
          </div>

          {report.description && (
            <div className={styles.detailItemFull}>
              <span className={styles.label}>Description:</span>
              <p className={styles.description}>{report.description}</p>
            </div>
          )}

          {report.status.toLowerCase() === "resolved" && (
            <>
              <div className={styles.detailItem}>
                <span className={styles.label}>Action Taken:</span>
                <span>
                  {RESOLUTION_ACTIONS[report.action_taken as ResolutionAction] || report.action_taken}
                </span>
              </div>

              {report.moderation_note && (
                <div className={styles.detailItemFull}>
                  <span className={styles.label}>Resolution Note:</span>
                  <p className={styles.note}>{report.moderation_note}</p>
                </div>
              )}

              <div className={styles.detailItem}>
                <span className={styles.label}>Resolved:</span>
                <span>
                  {report.resolved_at ? new Date(report.resolved_at).toLocaleString() : "—"}
                </span>
              </div>
            </>
          )}
        </div>
      </AppSpace>
    </div>
  );
}
