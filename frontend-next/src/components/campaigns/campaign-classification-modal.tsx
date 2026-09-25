"use client";

import { useState } from "react";
import { isAxiosError } from "axios";

import { AppModal, useAppFeedback } from "@/components/ui";
import { CampaignClassificationFields } from "@/components/campaigns/campaign-classification-fields";
import { useUpdateCampaignClassification } from "@/hooks/use-frontend-data";
import type { CampaignDiscoveryItem } from "@/types/frontend";

type Props = {
  campaign: Pick<CampaignDiscoveryItem, "slug" | "title" | "category" | "tags">;
  open: boolean;
  onClose: () => void;
};

/** Edit an existing campaign's category and tags. Mount only while open so
 *  the fields start from the campaign's current values each time. */
export function CampaignClassificationModal({ campaign, open, onClose }: Props) {
  const { message } = useAppFeedback();
  const update = useUpdateCampaignClassification();
  const [category, setCategory] = useState<string | null>(campaign.category ?? null);
  const [tags, setTags] = useState<string[]>(campaign.tags ?? []);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    try {
      await update.mutateAsync({ slug: campaign.slug, category, tags });
      message.success("Category and tags saved");
      onClose();
    } catch (err) {
      const detail = isAxiosError(err) ? err.response?.data?.detail : null;
      setError(
        Array.isArray(detail)
          ? detail.map((d: { msg?: string }) => d.msg?.replace(/^Value error, /, "")).filter(Boolean).join(" ")
          : typeof detail === "string" ? detail : "Could not save. Please try again.",
      );
    }
  };

  return (
    <AppModal
      open={open}
      onCancel={onClose}
      onOk={save}
      okText="Save"
      confirmLoading={update.isPending}
      title={`Category & tags · ${campaign.title}`}
      destroyOnHidden
    >
      <div style={{ paddingTop: 8 }}>
        <CampaignClassificationFields
          category={category}
          tags={tags}
          onCategoryChange={setCategory}
          onTagsChange={setTags}
        />
        {error && (
          <div style={{ padding: "10px 12px", borderRadius: 10, background: "#fef0f0", border: "1px solid rgba(239,68,68,0.22)", color: "#b42323", fontSize: 13 }}>
            {error}
          </div>
        )}
      </div>
    </AppModal>
  );
}
