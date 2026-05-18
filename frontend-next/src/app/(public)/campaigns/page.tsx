"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { AppButton, AppCard, AppCol, AppInput, AppRow, AppSpace, AppTag, AppText, AppTitle } from "@/components/ui";
import { usePublicCampaignDiscovery } from "@/hooks/use-frontend-data";

const COVER_PLACEHOLDER =
  "linear-gradient(145deg, rgba(29,197,255,0.2) 0%, rgba(255,255,255,0.94) 50%, rgba(216,245,255,0.78) 100%)";

type BrowseFilter = "all" | "schools" | "health" | "emergency";

const FILTERS: Array<{ value: BrowseFilter; label: string; keywords?: string[] }> = [
  { value: "all", label: "All campaigns" },
  { value: "schools", label: "Schools", keywords: ["school", "education", "classroom", "student"] },
  { value: "health", label: "Health", keywords: ["health", "clinic", "medical", "hospital"] },
  { value: "emergency", label: "Emergency", keywords: ["flood", "relief", "emergency", "disaster"] },
];

function matchesFilter(
  item: { title: string; slug: string; description: string; mode: string },
  filter: BrowseFilter,
) {
  if (filter === "all") return true;

  const keywords = FILTERS.find((entry) => entry.value === filter)?.keywords ?? [];
  const haystack = [item.title, item.slug, item.description, item.mode].join(" ").toLowerCase();
  return keywords.some((keyword) => haystack.includes(keyword));
}

export default function CampaignDiscoveryPage() {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<BrowseFilter>("all");
  const { data, isLoading } = usePublicCampaignDiscovery();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter((item) => {
      const matchesQuery =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.slug.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q);

      return matchesQuery && matchesFilter(item, activeFilter);
    });
  }, [activeFilter, data, query]);

  return (
    <main style={{ padding: 24 }}>
      <AppSpace direction="vertical" size={16} style={{ width: "100%" }}>
        <div>
          <AppTitle level={2} style={{ margin: 0 }}>
            Campaign Discovery
          </AppTitle>
          <AppText type="secondary">
            Browse campaigns from a shared feed, then jump into the story that matters to you.
          </AppText>
        </div>

        <AppInput
          placeholder="Search campaigns by title, slug, or description..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <AppSpace wrap size={10}>
          {FILTERS.map((filter) => (
            <AppButton
              key={filter.value}
              type={activeFilter === filter.value ? "primary" : "default"}
              onClick={() => setActiveFilter(filter.value)}
            >
              {filter.label}
            </AppButton>
          ))}
        </AppSpace>

        <AppText type="secondary">
          {filtered.length} campaign{filtered.length === 1 ? "" : "s"} shown
        </AppText>

        <AppRow gutter={[16, 16]}>
          {filtered.map((campaign) => {
            const isSchoolCampaign = matchesFilter(campaign, "schools");

            return (
              <AppCol xs={24} md={12} lg={8} key={campaign.id}>
                <AppCard loading={isLoading} style={{ borderRadius: 0, boxShadow: "var(--shadow)" }}>
                  <div
                    style={{
                      margin: "-24px -24px 14px",
                      height: 190,
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
                    <AppSpace wrap size={8}>
                      <AppTag color="blue">{campaign.status}</AppTag>
                      <AppTag color="blue">{campaign.mode}</AppTag>
                      {isSchoolCampaign ? <AppTag color="gold">Schools</AppTag> : null}
                    </AppSpace>
                    <AppTitle level={4} style={{ margin: 0 }}>
                      {campaign.title}
                    </AppTitle>
                    <AppText type="secondary">{campaign.slug}</AppText>
                    <AppText>{campaign.description}</AppText>
                    <AppText>
                      Raised {campaign.amount_raised.toLocaleString()} /{" "}
                      {(campaign.target_amount ?? 0).toLocaleString()} GMD
                    </AppText>
                    <AppSpace wrap size={12} style={{ marginTop: 8 }}>
                      <Link href={`/campaigns/${campaign.slug}`}>
                        <AppButton>View</AppButton>
                      </Link>
                      <Link href={`/quick-pay/${campaign.slug}`}>
                        <AppButton type="primary">Donate with Wave</AppButton>
                      </Link>
                    </AppSpace>
                  </AppSpace>
                </AppCard>
              </AppCol>
            );
          })}
        </AppRow>

        {filtered.length === 0 ? (
          <AppCard>
            <AppSpace direction="vertical" size={8}>
              <AppTitle level={4} style={{ margin: 0 }}>
                No campaigns found
              </AppTitle>
              <AppText type="secondary">
                Try a different keyword or switch back to all campaigns.
              </AppText>
            </AppSpace>
          </AppCard>
        ) : null}
      </AppSpace>
    </main>
  );
}
