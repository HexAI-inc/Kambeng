"use client";

import { useParams, useRouter } from "next/navigation";
import { Spin, Result, Button, Space } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";

import { useAdminUserDetail } from "@/hooks/use-frontend-data";
import { AppButton, AppCard, AppSpace, AppTag } from "@/components/ui";

export default function UserViewPage() {
  const params = useParams();
  const router = useRouter();
  const userId = Array.isArray(params?.id) ? parseInt(params.id[0]) : parseInt(params?.id as string);

  const { data: user, isLoading, error } = useAdminUserDetail(userId);

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "400px" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error || !user) {
    return <Result status="404" title="User Not Found" subTitle="This user does not exist or was deleted." />;
  }

  const kycStatusColor =
    user.kyc_status === "APPROVED" ? "green" : user.kyc_status === "REJECTED" ? "red" : "orange";
  const roleTag = user.role === "ADMIN" ? "volcano" : "blue";
  const statusTag = user.is_active ? "green" : "red";

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
          <h2 style={{ margin: 0 }}>User Details</h2>
        </Space>

        <AppCard title="User Information">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <label style={{ fontWeight: 600, color: "#666" }}>User ID</label>
              <div>{user.id}</div>
            </div>
            <div>
              <label style={{ fontWeight: 600, color: "#666" }}>Full Name</label>
              <div>{user.full_name}</div>
            </div>
            <div>
              <label style={{ fontWeight: 600, color: "#666" }}>Email</label>
              <div style={{ fontFamily: "monospace", fontSize: "12px" }}>{user.email}</div>
            </div>
            <div>
              <label style={{ fontWeight: 600, color: "#666" }}>Wave Number</label>
              <div style={{ fontFamily: "monospace", fontSize: "12px" }}>{user.wave_number}</div>
            </div>
            <div>
              <label style={{ fontWeight: 600, color: "#666" }}>Role</label>
              <div>
                <AppTag color={roleTag}>{user.role}</AppTag>
              </div>
            </div>
            <div>
              <label style={{ fontWeight: 600, color: "#666" }}>Status</label>
              <div>
                <AppTag color={statusTag}>{user.is_active ? "Active" : "Suspended"}</AppTag>
              </div>
            </div>
            <div>
              <label style={{ fontWeight: 600, color: "#666" }}>KYC Status</label>
              <div>
                <AppTag color={kycStatusColor}>{user.kyc_status}</AppTag>
              </div>
            </div>
            <div>
              <label style={{ fontWeight: 600, color: "#666" }}>Campaigns</label>
              <div>{user.campaign_count}</div>
            </div>
            <div>
              <label style={{ fontWeight: 600, color: "#666" }}>Total Raised (GMD)</label>
              <div>{user.total_raised?.toFixed(2) ?? "0.00"}</div>
            </div>
            <div>
              <label style={{ fontWeight: 600, color: "#666" }}>Created At</label>
              <div>{new Date(user.created_at).toLocaleString()}</div>
            </div>
            {user.last_activity && (
              <div>
                <label style={{ fontWeight: 600, color: "#666" }}>Last Activity</label>
                <div>{new Date(user.last_activity).toLocaleString()}</div>
              </div>
            )}
          </div>
        </AppCard>

        <Space>
          <AppButton type="primary" onClick={() => router.push(`/admin/users/${user.id}/edit`)}>
            Edit User
          </AppButton>
          <AppButton onClick={() => router.back()}>Close</AppButton>
        </Space>
      </AppSpace>
    </div>
  );
}
