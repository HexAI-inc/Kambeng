"use client";

import { useParams, useRouter } from "next/navigation";
import { Spin, Result, Form, Input, Select, Button, Space } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAdminCampaignDetail } from "@/hooks/use-frontend-data";
import { AppButton, AppCard, AppSpace, useAppFeedback } from "@/components/ui";
import { api } from "@/lib/api";

export default function CampaignEditPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { message } = useAppFeedback();
  const [form] = Form.useForm();

  const campaignId = Array.isArray(params?.id) ? parseInt(params.id[0]) : parseInt(params?.id as string);
  const { data: campaign, isLoading, error } = useAdminCampaignDetail(campaignId);

  const updateMutation = useMutation({
    mutationFn: async (values: any) => {
      await api.patch(`/admin/campaigns/${campaign?.slug}/status`, null, {
        params: { status: values.status },
      });
    },
    onSuccess: () => {
      message.success("Campaign updated successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["admin-campaign-detail", campaignId] });
      router.back();
    },
    onError: () => {
      message.error("Failed to update campaign");
    },
  });

  const handleSubmit = async (values: any) => {
    await updateMutation.mutateAsync(values);
  };

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
          <h2 style={{ margin: 0 }}>Edit Campaign</h2>
        </Space>

        <AppCard title="Campaign Details">
          <Form
            form={form}
            layout="vertical"
            initialValues={{
              title: campaign.title,
              slug: campaign.slug,
              status: campaign.status,
              mode: campaign.mode,
              amount_raised: campaign.amount_raised,
              target_amount: campaign.target_amount,
            }}
            onFinish={handleSubmit}
          >
            <Form.Item label="Campaign ID" name="id">
              <Input disabled value={campaign.id} />
            </Form.Item>

            <Form.Item label="Title" name="title">
              <Input disabled />
            </Form.Item>

            <Form.Item label="Slug" name="slug">
              <Input disabled />
            </Form.Item>

            <Form.Item label="Status" name="status" rules={[{ required: true }]}>
              <Select
                options={[
                  { label: "Active", value: "ACTIVE" },
                  { label: "Suspended", value: "SUSPENDED" },
                  { label: "Closed", value: "CLOSED" },
                ]}
              />
            </Form.Item>

            <Form.Item label="Mode" name="mode">
              <Input disabled />
            </Form.Item>

            <Form.Item label="Amount Raised (GMD)" name="amount_raised">
              <Input disabled />
            </Form.Item>

            <Form.Item label="Target Amount (GMD)" name="target_amount">
              <Input disabled />
            </Form.Item>

            <Space>
              <Button type="primary" htmlType="submit" loading={updateMutation.isPending}>
                Save Changes
              </Button>
              <Button onClick={() => router.back()}>Cancel</Button>
            </Space>
          </Form>
        </AppCard>
      </AppSpace>
    </div>
  );
}
