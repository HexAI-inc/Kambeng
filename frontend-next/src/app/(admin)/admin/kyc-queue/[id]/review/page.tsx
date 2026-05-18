"use client";

import { useParams, useRouter } from "next/navigation";
import { Spin, Result, Form, Input, Button, Space, Modal } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useState } from "react";

import { useAdminKYCDetail, useApproveKYC, useRejectKYC } from "@/hooks/use-frontend-data";
import { AppButton, AppCard, AppSpace, useAppFeedback } from "@/components/ui";

export default function KYCReviewPage() {
  const params = useParams();
  const router = useRouter();
  const { message } = useAppFeedback();
  const [form] = Form.useForm();
  const [rejectModal, setRejectModal] = useState(false);

  const submissionId = Array.isArray(params?.id) ? parseInt(params.id[0]) : parseInt(params?.id as string);
  const { data: submission, isLoading, error } = useAdminKYCDetail(submissionId);
  const approve = useApproveKYC();
  const reject = useRejectKYC();

  const handleApprove = async () => {
    Modal.confirm({
      title: "Approve KYC Submission",
      content: "Are you sure you want to approve this KYC submission?",
      okText: "Approve",
      cancelText: "Cancel",
      onOk: async () => {
        try {
          await approve.mutateAsync(submissionId);
          message.success("KYC submission approved successfully");
          router.back();
        } catch (err) {
          message.error("Failed to approve KYC submission");
        }
      },
    });
  };

  const handleReject = async (values: any) => {
    if (!values.rejection_reason || !values.rejection_reason.trim()) {
      message.error("Please provide a rejection reason");
      return;
    }

    try {
      await reject.mutateAsync({
        submissionId,
        reason: values.rejection_reason,
      });
      message.success("KYC submission rejected successfully");
      setRejectModal(false);
      router.back();
    } catch (err) {
      message.error("Failed to reject KYC submission");
    }
  };

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
          <h2 style={{ margin: 0 }}>Review KYC Submission</h2>
        </Space>

        <AppCard title="Submission Details">
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
              <div>{submission.status}</div>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
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
          </div>
        </AppCard>

        <AppCard title="Decision">
          <Space direction="vertical" style={{ width: "100%" }}>
            <AppButton
              type="primary"
              onClick={handleApprove}
              loading={approve.isPending}
              disabled={submission.status !== "SUBMITTED" && submission.status !== "REVIEWING"}
            >
              Approve Submission
            </AppButton>
            <AppButton
              danger
              onClick={() => setRejectModal(true)}
              loading={reject.isPending}
              disabled={submission.status !== "SUBMITTED" && submission.status !== "REVIEWING"}
            >
              Reject Submission
            </AppButton>
            <AppButton onClick={() => router.back()}>Cancel</AppButton>
          </Space>
        </AppCard>
      </AppSpace>

      <Modal
        title="Reject KYC Submission"
        open={rejectModal}
        onCancel={() => setRejectModal(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleReject}
        >
          <Form.Item
            label="Rejection Reason"
            name="rejection_reason"
            rules={[
              { required: true, message: "Please provide a rejection reason" },
              { min: 10, message: "Reason must be at least 10 characters" },
            ]}
          >
            <Input.TextArea
              placeholder="Explain why this KYC submission is being rejected..."
              rows={4}
            />
          </Form.Item>

          <Space>
            <Button type="primary" htmlType="submit" loading={reject.isPending} danger>
              Reject
            </Button>
            <Button onClick={() => setRejectModal(false)}>Cancel</Button>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}
