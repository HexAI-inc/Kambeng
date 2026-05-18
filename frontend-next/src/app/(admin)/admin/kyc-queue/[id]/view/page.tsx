"use client";

import { useParams, useRouter } from "next/navigation";
import { Spin, Result, Button, Space, Image } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";

import { useAdminKYCDetail } from "@/hooks/use-frontend-data";
import { AppButton, AppCard, AppSpace, AppTag } from "@/components/ui";

export default function KYCViewPage() {
  const params = useParams();
  const router = useRouter();
  const submissionId = Array.isArray(params?.id) ? parseInt(params.id[0]) : parseInt(params?.id as string);

  const { data: submission, isLoading, error } = useAdminKYCDetail(submissionId);

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "400px" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error || !submission) {
    return (
      <Result
        status="404"
        title="KYC Submission Not Found"
        subTitle="This KYC submission does not exist or was deleted."
      />
    );
  }

  const statusColor =
    submission.status === "APPROVED"
      ? "green"
      : submission.status === "REJECTED"
        ? "red"
        : submission.status === "SUBMITTED"
          ? "blue"
          : "orange";

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto" }}>
      <AppSpace direction="vertical" style={{ width: "100%" }} size="large">
        <Space>
          <AppButton
            icon={<ArrowLeftOutlined />}
            onClick={() => router.back()}
            type="default"
          >
            Back
          </AppButton>
          <h2 style={{ margin: 0 }}>KYC Submission Details</h2>
        </Space>

        <AppCard title="Submission Information">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <label style={{ fontWeight: 600, color: "#666" }}>Submission ID</label>
              <div>{submission.id}</div>
            </div>
            <div>
              <label style={{ fontWeight: 600, color: "#666" }}>User ID</label>
              <div>{submission.user_id}</div>
            </div>
            <div>
              <label style={{ fontWeight: 600, color: "#666" }}>Document Type</label>
              <div>{submission.document_type}</div>
            </div>
            <div>
              <label style={{ fontWeight: 600, color: "#666" }}>Status</label>
              <div>
                <AppTag color={statusColor}>{submission.status}</AppTag>
              </div>
            </div>
            <div>
              <label style={{ fontWeight: 600, color: "#666" }}>Document</label>
              <div>
                {submission.document_file_url ? (
                  <a href={submission.document_file_url} target="_blank" rel="noopener noreferrer">
                    View Document
                  </a>
                ) : (
                  "N/A"
                )}
              </div>
            </div>
            <div>
              <label style={{ fontWeight: 600, color: "#666" }}>Submitted At</label>
              <div>{new Date(submission.created_at).toLocaleString()}</div>
            </div>
            {submission.reviewed_at && (
              <>
                <div>
                  <label style={{ fontWeight: 600, color: "#666" }}>Reviewed At</label>
                  <div>{new Date(submission.reviewed_at).toLocaleString()}</div>
                </div>
                <div>
                  <label style={{ fontWeight: 600, color: "#666" }}>Reviewed By Admin ID</label>
                  <div>{submission.reviewed_by_admin_id}</div>
                </div>
              </>
            )}
            {submission.rejection_reason && (
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontWeight: 600, color: "#666" }}>Rejection Reason</label>
                <div
                  style={{
                    padding: "8px",
                    backgroundColor: "#fff7e6",
                    borderRadius: "4px",
                    border: "1px solid #ffd591",
                  }}
                >
                  {submission.rejection_reason}
                </div>
              </div>
            )}
          </div>
        </AppCard>

        <Space>
          <AppButton type="primary" onClick={() => router.push(`/admin/kyc-queue/${submission.id}/review`)}>
            Review Submission
          </AppButton>
          <AppButton onClick={() => router.back()}>Close</AppButton>
        </Space>
      </AppSpace>
    </div>
  );
}
