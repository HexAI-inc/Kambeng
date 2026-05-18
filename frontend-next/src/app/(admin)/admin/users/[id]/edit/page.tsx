"use client";

import { useParams, useRouter } from "next/navigation";
import { Spin, Result, Form, Input, Select, Button, Space } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";

import { useAdminUserDetail, useUpdateAdminUserStatus } from "@/hooks/use-frontend-data";
import { AppButton, AppCard, AppSpace, useAppFeedback } from "@/components/ui";

export default function UserEditPage() {
  const params = useParams();
  const router = useRouter();
  const { message } = useAppFeedback();
  const [form] = Form.useForm();

  const userId = Array.isArray(params?.id) ? parseInt(params.id[0]) : parseInt(params?.id as string);
  const { data: user, isLoading, error } = useAdminUserDetail(userId);
  const updateStatus = useUpdateAdminUserStatus();

  const handleSubmit = async (values: any) => {
    try {
      await updateStatus.mutateAsync({
        userId,
        status: values.status,
      });
      message.success("User updated successfully");
      router.back();
    } catch (err) {
      message.error("Failed to update user");
    }
  };

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
          <h2 style={{ margin: 0 }}>Edit User</h2>
        </Space>

        <AppCard title="User Management">
          <Form
            form={form}
            layout="vertical"
            initialValues={{
              user_id: user.id,
              full_name: user.full_name,
              email: user.email,
              wave_number: user.wave_number,
              role: user.role,
              status: user.is_active ? "ACTIVE" : "SUSPENDED",
              kyc_status: user.kyc_status,
            }}
            onFinish={handleSubmit}
          >
            <Form.Item label="User ID">
              <Input disabled value={user.id} />
            </Form.Item>

            <Form.Item label="Full Name">
              <Input disabled value={user.full_name} />
            </Form.Item>

            <Form.Item label="Email">
              <Input disabled value={user.email} />
            </Form.Item>

            <Form.Item label="Wave Number">
              <Input disabled value={user.wave_number} />
            </Form.Item>

            <Form.Item label="Role">
              <Input disabled value={user.role} />
            </Form.Item>

            <Form.Item label="KYC Status">
              <Input disabled value={user.kyc_status} />
            </Form.Item>

            <Form.Item
              label="Account Status"
              name="status"
              rules={[{ required: true, message: "Please select a status" }]}
            >
              <Select
                options={[
                  { label: "Active", value: "ACTIVE" },
                  { label: "Suspended", value: "SUSPENDED" },
                ]}
              />
            </Form.Item>

            <Space>
              <Button type="primary" htmlType="submit" loading={updateStatus.isPending}>
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
