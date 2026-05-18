"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { useAdminPendingDonations, useApproveDonation, useRejectDonation } from "@/hooks/use-frontend-data";
import type { AdminDonation } from "@/types/frontend";
import { AppButton, AppCard, AppDataTable, AppSpace, AppTag, useAppFeedback } from "@/components/ui";
import styles from "./donations.module.css";

type DonationStatus = "pending" | "approved" | "rejected" | "completed";

const STATUS_META: Record<DonationStatus, { color?: string; text: string }> = {
  pending: { color: "orange", text: "Pending" },
  approved: { color: "green", text: "Approved" },
  rejected: { color: "red", text: "Rejected" },
  completed: { color: "blue", text: "Completed" },
};

function getStatusMeta(status: string) {
  const normalizedStatus = status.toLowerCase() as DonationStatus;

  return STATUS_META[normalizedStatus] ?? {
    text: status,
  };
}

export default function DonationReconciliationPage() {
  const router = useRouter();
  const { data: donations, isLoading } = useAdminPendingDonations();
  const approveDonation = useApproveDonation();
  const rejectDonation = useRejectDonation();
  const { message } = useAppFeedback();

  const [rejectingRef, setRejectingRef] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const donationRows = donations ?? [];
  const pendingCount = donationRows.filter(
    (donation) => !donation.reconciliation_source && donation.status.toLowerCase() === "pending",
  ).length;
  const reviewedCount = donationRows.length - pendingCount;

  const handleApprove = async (clientReference: string) => {
    try {
      await approveDonation.mutateAsync(clientReference);
      message.success("Donation approved");
    } catch {
      message.error("Failed to approve donation");
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectingRef || !rejectionReason.trim()) {
      message.error("Please provide a rejection reason");
      return;
    }

    try {
      await rejectDonation.mutateAsync({
        clientReference: rejectingRef,
        reason: rejectionReason,
      });
      message.success("Donation rejected");
      setRejectingRef(null);
      setRejectionReason("");
    } catch {
      message.error("Failed to reject donation");
    }
  };

  const columns: ColumnDef<AdminDonation>[] = [
    {
      accessorKey: "client_reference",
      header: "Reference",
      size: 120,
      cell: (info) => (
        <span className={styles.reference}>
          {info.row.original.client_reference}
        </span>
      ),
    },
    {
      accessorKey: "campaign_title",
      header: "Campaign",
      size: 150,
    },
    {
      accessorKey: "donor_name",
      header: "Donor",
      size: 130,
      cell: (info) => info.row.original.donor_name || "Anonymous",
    },
    {
      accessorKey: "amount",
      header: "Amount",
      size: 100,
      cell: (info) => (
        <span className={styles.amount}>
          ${(info.row.original.amount / 100).toFixed(2)}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      size: 100,
      cell: (info) => {
        const status = info.row.original.status;
        const config = getStatusMeta(status);

        return config.color ? (
          <AppTag color={config.color}>{config.text}</AppTag>
        ) : (
          <AppTag>{config.text}</AppTag>
        );
      },
    },
    {
      accessorKey: "created_at",
      header: "Date",
      size: 120,
      cell: (info) => new Date(info.row.original.created_at).toLocaleDateString(),
    },
    {
      accessorKey: "reconciliation_source",
      header: "Source",
      size: 100,
      cell: (info) => info.row.original.reconciliation_source || "—",
    },
    {
      header: "Actions",
      size: 200,
      cell: (info) => {
        const donation = info.row.original;
        const isProcessed =
          donation.reconciliation_source !== null ||
          donation.status.toLowerCase() !== "pending";

        if (isProcessed) {
          return (
            <div className={styles.processedStatus}>
              <span>Reconciled</span>
              {donation.reconciliation_source && (
                <span className={styles.source}>
                  ({donation.reconciliation_source})
                </span>
              )}
            </div>
          );
        }

        return (
          <div className={styles.actions}>
            <AppButton
              type="text"
              size="small"
              onClick={() => router.push(`/admin/campaigns/${donation.campaign_id}/view`)}
            >
              View
            </AppButton>
            <AppButton
              type="primary"
              size="small"
              onClick={() => handleApprove(donation.client_reference)}
              loading={approveDonation.isPending}
            >
              Approve
            </AppButton>
            <AppButton
              size="small"
              danger
              onClick={() => setRejectingRef(donation.client_reference)}
            >
              Reject
            </AppButton>
          </div>
        );
      },
    },
  ];

  return (
    <AppSpace direction="vertical" size="large" className={styles.container}>
      <div className={styles.hero}>
        <div>
          <p className={styles.kicker}>Payments queue</p>
          <h1>Donation Reconciliation</h1>
          <p className={styles.subtitle}>
            Review incoming donations, clear legitimate payments, and flag anything suspicious.
          </p>
        </div>

        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Pending review</span>
            <strong className={styles.summaryValue}>{pendingCount}</strong>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Reviewed</span>
            <strong className={styles.summaryValue}>{reviewedCount}</strong>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Total loaded</span>
            <strong className={styles.summaryValue}>{donationRows.length}</strong>
          </div>
        </div>
      </div>

      {rejectingRef && (
        <AppCard className={styles.rejectModal}>
          <AppSpace direction="vertical" size="medium">
            <h3>Reject Donation</h3>
            <p className={styles.modalSubtitle}>
              Add a short reason so the audit trail explains why the payment was rejected.
            </p>
            <div>
              <label className={styles.label}>Rejection Reason</label>
              <textarea
                className={styles.reasonInput}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why this donation is being rejected..."
                rows={4}
              />
            </div>
            <div className={styles.modalActions}>
              <AppButton onClick={handleRejectSubmit} danger loading={rejectDonation.isPending}>
                Confirm Rejection
              </AppButton>
              <AppButton
                onClick={() => {
                  setRejectingRef(null);
                  setRejectionReason("");
                }}
              >
                Cancel
              </AppButton>
            </div>
          </AppSpace>
        </AppCard>
      )}

      <AppCard className={styles.tableCard}>
        <AppDataTable
          data={donationRows}
          columns={columns}
          isLoading={isLoading}
          expandableRows
          renderExpandedRow={(row) => (
            <DonationDetailsPanel donation={row} />
          )}
          emptyText="No donations are waiting for review. Campaign detail pages show the underlying fundraising activity."
        />
      </AppCard>
    </AppSpace>
  );
}

interface DonationDetailsPanelProps {
  donation: AdminDonation;
}

function DonationDetailsPanel({ donation }: DonationDetailsPanelProps) {
  const statusMeta = getStatusMeta(donation.status);

  return (
    <div className={styles.detailsPanel}>
      <AppSpace direction="vertical" size="medium">
        <div className={styles.detailsGrid}>
          <div className={styles.detailItem}>
            <span className={styles.label}>Reference:</span>
            <span>{donation.client_reference}</span>
          </div>

          <div className={styles.detailItem}>
            <span className={styles.label}>Campaign:</span>
            <span>{donation.campaign_title}</span>
          </div>

          <div className={styles.detailItem}>
            <span className={styles.label}>Donor:</span>
            <span>{donation.donor_name || "Anonymous"}</span>
          </div>

          <div className={styles.detailItem}>
            <span className={styles.label}>Amount:</span>
            <span className={styles.amount}>
              ${(donation.amount / 100).toFixed(2)}
            </span>
          </div>

          <div className={styles.detailItem}>
            <span className={styles.label}>Status:</span>
            {statusMeta.color ? (
              <AppTag color={statusMeta.color}>{statusMeta.text}</AppTag>
            ) : (
              <AppTag>{statusMeta.text}</AppTag>
            )}
          </div>

          <div className={styles.detailItem}>
            <span className={styles.label}>Created:</span>
            <span>{new Date(donation.created_at).toLocaleString()}</span>
          </div>

          {donation.reconciliation_source && (
            <>
              <div className={styles.detailItem}>
                <span className={styles.label}>Reconciliation Source:</span>
                <span>{donation.reconciliation_source}</span>
              </div>

              <div className={styles.detailItem}>
                <span className={styles.label}>Reconciliation Reason:</span>
                <span>{donation.reconciliation_reason || "—"}</span>
              </div>

              <div className={styles.detailItem}>
                <span className={styles.label}>Reconciled At:</span>
                <span>
                  {donation.reconciled_at
                    ? new Date(donation.reconciled_at).toLocaleString()
                    : "—"}
                </span>
              </div>
            </>
          )}
        </div>
      </AppSpace>
    </div>
  );
}
