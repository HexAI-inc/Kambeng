"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminKYCQueue, useApproveKYC, useRejectKYC } from "@/hooks/use-frontend-data";
import { AppButton, AppCard, AppDataTable, AppSpace, AppTag, useAppFeedback } from "@/components/ui";
import styles from "./kyc-queue.module.css";

export default function KYCQueuePage() {
  const router = useRouter();
  const { data: kycQueue, isLoading } = useAdminKYCQueue();
  const approveKYC = useApproveKYC();
  const rejectKYC = useRejectKYC();
  const { message } = useAppFeedback();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const handleApprove = async (submissionId: number) => {
    try {
      await approveKYC.mutateAsync(submissionId);
      message.success("KYC submission approved");
    } catch (error) {
      message.error("Failed to approve KYC submission");
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectingId || !rejectionReason.trim()) {
      message.error("Please provide a rejection reason");
      return;
    }

    try {
      await rejectKYC.mutateAsync({
        submissionId: rejectingId,
        reason: rejectionReason,
      });
      message.success("KYC submission rejected");
      setRejectingId(null);
      setRejectionReason("");
    } catch (error) {
      message.error("Failed to reject KYC submission");
    }
  };

  const columns = [
    {
      accessorKey: "id",
      header: "ID",
      size: 60,
    },
    {
      accessorKey: "user_name",
      header: "User",
      size: 150,
      cell: (info: any) => (
        <div>
          <div className={styles.userName}>{info.row.original.user_name}</div>
          <div className={styles.userEmail}>{info.row.original.user_email}</div>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      size: 120,
      cell: (info: any) => {
        const status = info.row.original.status;
        const statusConfig: Record<string, { color: string; text: string }> = {
          SUBMITTED: { color: "blue", text: "Submitted" },
          REVIEWING: { color: "orange", text: "Reviewing" },
          APPROVED: { color: "green", text: "Approved" },
          REJECTED: { color: "red", text: "Rejected" },
        };
        const config = statusConfig[status] || { color: "default", text: status };
        return <AppTag color={config.color as any}>{config.text}</AppTag>;
      },
    },
    {
      accessorKey: "submitted_at",
      header: "Submitted",
      size: 140,
      cell: (info: any) => new Date(info.row.original.submitted_at).toLocaleDateString(),
    },
    {
      accessorKey: "documents",
      header: "Documents",
      size: 100,
      cell: (info: any) => {
        const docCount = (info.row.original.documents || []).length;
        return <span>{docCount} document(s)</span>;
      },
    },
    {
      header: "Actions",
      size: 200,
      cell: (info: any) => {
        const submission = info.row.original;
        const isProcessed = submission.status === "APPROVED" || submission.status === "REJECTED";
        
        if (isProcessed) {
          return <span className={styles.processed}>Processed</span>;
        }

        return (
          <div className={styles.actions}>
            <AppButton
              type="primary"
              size="small"
              onClick={() => router.push(`/admin/kyc-queue/${submission.id}/review`)}
            >
              Review
            </AppButton>
            <AppButton
              type="text"
              size="small"
              onClick={() => router.push(`/admin/kyc-queue/${submission.id}/view`)}
            >
              View
            </AppButton>
          </div>
        );
      },
    },
  ];

  const handleExpandRow = (row: any) => {
    setSelectedId(selectedId === row.id ? null : row.id);
  };

  return (
    <AppSpace direction="vertical" size="large" className={styles.container}>
      <div>
        <h1>KYC Queue</h1>
        <p className={styles.subtitle}>
          Review and approve/reject KYC submissions ({kycQueue?.length || 0} pending)
        </p>
      </div>

      {rejectingId && (
        <AppCard className={styles.rejectModal}>
          <AppSpace direction="vertical" size="medium">
            <h3>Reject KYC Submission</h3>
            <div>
              <label className={styles.label}>Rejection Reason</label>
              <textarea
                className={styles.reasonInput}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why this KYC submission is being rejected..."
                rows={4}
              />
            </div>
            <div className={styles.modalActions}>
              <AppButton onClick={handleRejectSubmit} danger loading={rejectKYC.isPending}>
                Confirm Rejection
              </AppButton>
              <AppButton onClick={() => {
                setRejectingId(null);
                setRejectionReason("");
              }}>
                Cancel
              </AppButton>
            </div>
          </AppSpace>
        </AppCard>
      )}

      <AppCard>
        <AppDataTable
          data={kycQueue || []}
          columns={columns}
          isLoading={isLoading}
          expandableRows
          renderExpandedRow={(row) => (
            <KYCDetailsPanel submission={row} />
          )}
        />
      </AppCard>
    </AppSpace>
  );
}

interface KYCDetailsPanelProps {
  submission: any;
}

function KYCDetailsPanel({ submission }: KYCDetailsPanelProps) {
  return (
    <div className={styles.detailsPanel}>
      <AppSpace direction="vertical" size="medium">
        <div className={styles.detailRow}>
          <span className={styles.label}>Submission ID:</span>
          <span>{submission.id}</span>
        </div>
        
        <div className={styles.detailRow}>
          <span className={styles.label}>User:</span>
          <span>{submission.user_name} ({submission.user_email})</span>
        </div>

        <div className={styles.detailRow}>
          <span className={styles.label}>Status:</span>
          <AppTag>{submission.status}</AppTag>
        </div>

        <div className={styles.detailRow}>
          <span className={styles.label}>Submitted:</span>
          <span>{new Date(submission.submitted_at).toLocaleString()}</span>
        </div>

        {submission.rejection_reason && (
          <div className={styles.detailRow}>
            <span className={styles.label}>Rejection Reason:</span>
            <span className={styles.rejectionReason}>{submission.rejection_reason}</span>
          </div>
        )}

        <div>
          <h4>Documents</h4>
          <div className={styles.documentsList}>
            {submission.documents.map((doc: any) => (
              <div key={doc.id} className={styles.documentItem}>
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                  {doc.document_type}
                </a>
                <span className={styles.uploadDate}>
                  {new Date(doc.upload_date).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </AppSpace>
    </div>
  );
}
