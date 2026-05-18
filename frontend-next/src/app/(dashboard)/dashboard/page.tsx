"use client";

import Link from "next/link";

import { AppAlert, AppButton, AppCard, AppCol, AppPageHeader, AppRow, AppSpace, AppStatistic, AppText, AppTitle } from "@/components/ui";
import { useSessionProfile } from "@/hooks/use-frontend-data";

export default function DashboardPage() {
  const { data: me, isLoading, isError } = useSessionProfile(true);

  return (
    <AppSpace direction="vertical" size={16} style={{ width: "100%" }}>
      <AppPageHeader
        title="User Dashboard"
        description="Your account overview and quick actions."
        actions={
          <Link href="/dashboard/ui-kit">
            <AppButton>Open UI Kit</AppButton>
          </Link>
        }
      />

      {isError ? <AppAlert type="error" title="Unable to load profile." /> : null}

      <AppRow gutter={[16, 16]}>
        <AppCol xs={24} md={12} lg={8}>
          <AppCard loading={isLoading}>
            <AppStatistic title="User ID" value={me?.id ?? 0} />
          </AppCard>
        </AppCol>
        <AppCol xs={24} md={12} lg={8}>
          <AppCard loading={isLoading}>
            <AppStatistic title="Email Verified" value={me?.is_email_verified ? "Yes" : "No"} />
          </AppCard>
        </AppCol>
        <AppCol xs={24} md={12} lg={8}>
          <AppCard loading={isLoading}>
            <AppStatistic title="Role" value={me?.role ?? "-"} />
          </AppCard>
        </AppCol>
      </AppRow>

      <AppCard title="Profile">
        <p><b>Name:</b> {me?.full_name ?? "-"}</p>
        <p><b>Email:</b> {me?.email ?? "-"}</p>
        <p><b>Wave:</b> {me?.wave_number ?? "-"}</p>
      </AppCard>

      <AppRow gutter={[16, 16]}>
        <AppCol xs={24} md={8}>
          <AppCard style={{ borderRadius: 0, boxShadow: "var(--shadow)" }}>
            <AppSpace direction="vertical" size={8}>
              <AppTitle level={4} style={{ margin: 0 }}>
                Campaign uploads
              </AppTitle>
              <AppText type="secondary">
                Manage campaign images and proof uploads from one place.
              </AppText>
              <Link href="/dashboard/my-campaigns">
                <AppButton type="primary">Open my campaigns</AppButton>
              </Link>
            </AppSpace>
          </AppCard>
        </AppCol>
        <AppCol xs={24} md={8}>
          <AppCard style={{ borderRadius: 0, boxShadow: "var(--shadow)" }}>
            <AppSpace direction="vertical" size={8}>
              <AppTitle level={4} style={{ margin: 0 }}>
                KYC upload
              </AppTitle>
              <AppText type="secondary">
                Submit identity documents for verification and withdrawals.
              </AppText>
              <Link href="/dashboard/kyc">
                <AppButton type="primary">Upload KYC</AppButton>
              </Link>
            </AppSpace>
          </AppCard>
        </AppCol>
        <AppCol xs={24} md={8}>
          <AppCard style={{ borderRadius: 0, boxShadow: "var(--shadow)" }}>
            <AppSpace direction="vertical" size={8}>
              <AppTitle level={4} style={{ margin: 0 }}>
                Public proof uploads
              </AppTitle>
              <AppText type="secondary">
                Upload campaign evidence and supporting documents.
              </AppText>
              <Link href="/dashboard/my-campaigns">
                <AppButton type="default">Open uploads</AppButton>
              </Link>
            </AppSpace>
          </AppCard>
        </AppCol>
      </AppRow>
    </AppSpace>
  );
}
