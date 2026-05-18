"use client";

import Link from "next/link";

import { AppAlert, AppButton, AppCard, AppCol, AppRow, AppSpace, AppTag, AppText, AppTitle } from "@/components/ui";
import { useMyCampaigns } from "@/hooks/use-frontend-data";

export default function MyCampaignsPage() {
  const { data: campaigns, isLoading, isError } = useMyCampaigns(true);

  return (
    <AppSpace direction="vertical" size={16} style={{ width: "100%" }}>
      <AppCard
        style={{
          borderRadius: 0,
          border: "1px solid var(--line)",
          boxShadow: "var(--shadow)",
        }}
      >
        <AppSpace direction="vertical" size={8}>
          <AppTitle level={2} style={{ margin: 0 }}>
            My Campaigns
          </AppTitle>
          <AppText type="secondary">
            Open a campaign to manage images, proofs, and goals.
          </AppText>
        </AppSpace>
      </AppCard>

      {isError ? <AppAlert type="error" title="Unable to load your campaigns." showIcon /> : null}

      {isLoading ? (
        <AppCard loading>
          <p>Loading campaigns...</p>
        </AppCard>
      ) : campaigns && campaigns.length > 0 ? (
        <AppRow gutter={[16, 16]}>
          {campaigns.map((campaign) => (
            <AppCol xs={24} md={12} key={campaign.id}>
              <AppCard
                style={{
                  borderRadius: 0,
                  border: "1px solid var(--line)",
                  boxShadow: "var(--shadow)",
                  height: "100%",
                }}
              >
                <AppSpace direction="vertical" size={10} style={{ width: "100%" }}>
                  <AppSpace wrap size={8}>
                    <AppTag color={campaign.status === "ACTIVE" ? "green" : "gold"}>
                      {campaign.status}
                    </AppTag>
                    <AppTag color="blue">{campaign.mode}</AppTag>
                  </AppSpace>

                  <div>
                    <AppTitle level={4} style={{ margin: 0 }}>
                      {campaign.title}
                    </AppTitle>
                    <AppText type="secondary">/{campaign.slug}</AppText>
                  </div>

                  <AppText style={{ lineHeight: 1.7 }}>
                    {campaign.description}
                  </AppText>

                  <AppText>
                    Raised {campaign.amount_raised.toLocaleString()} / {(campaign.target_amount ?? 0).toLocaleString()} GMD
                  </AppText>

                  <AppSpace wrap size={10}>
                    <Link href={`/dashboard/my-campaigns/${campaign.id}/images`}>
                      <AppButton type="primary">Manage uploads</AppButton>
                    </Link>
                    <Link href={`/dashboard/my-campaigns/${campaign.id}/goals`}>
                      <AppButton>Manage goals</AppButton>
                    </Link>
                    <Link href={`/campaigns/${campaign.slug}`}>
                      <AppButton type="default">Public page</AppButton>
                    </Link>
                  </AppSpace>
                </AppSpace>
              </AppCard>
            </AppCol>
          ))}
        </AppRow>
      ) : (
        <AppCard>
          <AppSpace direction="vertical" size={8}>
            <AppTitle level={4} style={{ margin: 0 }}>
              No campaigns found
            </AppTitle>
            <AppText type="secondary">
              Create a campaign first, then return here to upload images and proof.
            </AppText>
            <Link href="/campaigns">
              <AppButton type="primary">Browse campaigns</AppButton>
            </Link>
          </AppSpace>
        </AppCard>
      )}
    </AppSpace>
  );
}