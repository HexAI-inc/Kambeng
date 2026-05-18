"use client";

import { useParams, useRouter } from "next/navigation";
import { Spin, Result, Button, Space } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";

import { useAdminCampaignDetail } from "@/hooks/use-frontend-data";
import { AppButton, AppCard, AppSpace, AppTag } from "@/components/ui";

export default function CampaignViewPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = Array.isArray(params?.id) ? parseInt(params.id[0]) : parseInt(params?.id as string);

  const { data: campaign, isLoading, error } = useAdminCampaignDetail(campaignId);

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "400px" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error || !campaign) {
    return <Result status="404" title="Campaign Not Found" subTitle="This campaign does not exist or was deleted." />;
  }

  const statusColor =
    campaign.status === "ACTIVE" ? "green" : campaign.status === "SUSPENDED" ? "volcano" : "gold";

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
          <h2 style={{ margin: 0 }}>Campaign Details</h2>
        </Space>

        <AppCard title="Campaign Information">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <label style={{ fontWeight: 600, color: "#666" }}>Campaign ID</label>
              <div>{campaign.id}</div>
            </div>
            <div>
              <label style={{ fontWeight: 600, color: "#666" }}>Title</label>
              <div>{campaign.title}</div>
            </div>
            <div>
              <label style={{ fontWeight: 600, color: "#666" }}>Slug</label>
              <div style={{ fontFamily: "monospace", fontSize: "12px" }}>{campaign.slug}</div>
            </div>
            <div>
              <label style={{ fontWeight: 600, color: "#666" }}>Status</label>
              <div>
                <AppTag color={statusColor}>{campaign.status}</AppTag>
              </div>
            </div>
            <div>
              <label style={{ fontWeight: 600, color: "#666" }}>Mode</label>
              <div>{campaign.mode || "N/A"}</div>
            </div>
            <div>
              <label style={{ fontWeight: 600, color: "#666" }}>Description</label>
              <div style={{ maxHeight: "100px", overflow: "auto" }}>{campaign.description || "N/A"}</div>
            </div>
            <div>
              <label style={{ fontWeight: 600, color: "#666" }}>Amount Raised</label>
              <div>GMD {campaign.amount_raised?.toFixed(2) ?? "0.00"}</div>
            </div>
            <div>
              <label style={{ fontWeight: 600, color: "#666" }}>Target Amount</label>
              <div>{campaign.target_amount ? `GMD ${campaign.target_amount.toFixed(2)}` : "No target"}</div>
            </div>
            <div>
              <label style={{ fontWeight: 600, color: "#666" }}>Created At</label>
              <div>{new Date(campaign.created_at).toLocaleString()}</div>
            </div>
          </div>
        </AppCard>

        <Space>
          <AppButton type="primary" onClick={() => router.push(`/admin/campaigns/${campaign.id}/edit`)}>
            Edit Campaign
          </AppButton>
          <AppButton onClick={() => router.back()}>Close</AppButton>
        </Space>
      </AppSpace>
    </div>
  );
}
