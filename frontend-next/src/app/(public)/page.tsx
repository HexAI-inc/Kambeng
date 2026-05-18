"use client";

import Image from "next/image";
import { motion } from "framer-motion";

import { AppButton, AppCard, AppCol, AppRow, AppSpace, AppTag, AppText, AppTitle } from "@/components/ui";
import { useHomeFeed, useSessionProfile } from "@/hooks/use-frontend-data";

const COVER_PLACEHOLDER =
  "linear-gradient(145deg, rgba(29,197,255,0.2) 0%, rgba(255,255,255,0.94) 50%, rgba(216,245,255,0.78) 100%)";

export default function PublicHomePage() {
  const { data, isLoading } = useHomeFeed();
  const { data: session } = useSessionProfile(true);
  const isLoggedIn = Boolean(session?.id);

  return (
    <main style={{ padding: "clamp(16px, 4vw, 32px)" }}>
      <AppSpace direction="vertical" size={18} style={{ width: "100%" }}>
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
          <AppCard
            style={{
              border: "1px solid var(--line)",
              background:
                "linear-gradient(135deg, rgba(29,197,255,0.18) 0%, rgba(255,255,255,0.94) 50%, rgba(216,245,255,0.8) 100%)",
              boxShadow: "var(--shadow)",
              borderRadius: 0,
            }}
          >
            <AppTitle level={2} style={{ margin: 0, letterSpacing: "-0.03em" }}>
              Kambeng Crowdfunding
            </AppTitle>
            <AppText style={{ color: "var(--slate)" }}>
              Discover campaigns, track impact, and support causes you care about.
            </AppText>
            <div style={{ marginTop: 18 }}>
              <AppSpace wrap size={12}>
                <AppButton type="primary" href="/campaigns" size="large">
                  Browse Campaigns
                </AppButton>
                {isLoggedIn ? (
                  <AppButton href="/dashboard" size="large">
                    Go to Dashboard
                  </AppButton>
                ) : (
                  <>
                    <AppButton href="/auth/login" size="large">
                      Login
                    </AppButton>
                    <AppButton href="/auth/signup" size="large">
                      Sign Up
                    </AppButton>
                  </>
                )}
              </AppSpace>
            </div>
          </AppCard>
        </motion.div>

        <AppRow gutter={[16, 16]}>
          {(data?.featured_campaigns ?? []).slice(0, 6).map((campaign) => (
            <AppCol xs={24} sm={12} lg={8} key={campaign.id}>
              <AppCard loading={isLoading}>
                <div
                  style={{
                    margin: "-24px -24px 14px",
                    height: 180,
                    borderBottom: "1px solid var(--line)",
                    background: campaign.cover_image_url ? undefined : COVER_PLACEHOLDER,
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  {campaign.cover_image_url ? (
                    <Image
                      src={campaign.cover_image_url}
                      alt={`${campaign.title} cover image`}
                      fill
                      unoptimized
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      style={{ objectFit: "cover", display: "block" }}
                    />
                  ) : null}
                </div>
                <AppSpace direction="vertical" size={6}>
                  <AppTitle level={4} style={{ margin: 0 }}>
                    {campaign.title}
                  </AppTitle>
                  <AppSpace>
                    <AppTag color="blue">{campaign.status}</AppTag>
                    <AppTag color="cyan">{campaign.mode}</AppTag>
                  </AppSpace>
                  <AppText type="secondary">{campaign.slug}</AppText>
                  <AppText>
                    Raised {campaign.amount_raised.toLocaleString()} /{" "}
                    {(campaign.target_amount ?? 0).toLocaleString()} GMD
                  </AppText>
                </AppSpace>
              </AppCard>
            </AppCol>
          ))}
        </AppRow>
      </AppSpace>
    </main>
  );
}
