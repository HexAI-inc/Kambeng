"use client";

import { AppSelect } from "@/components/ui";
import { usePopularCampaignTags } from "@/hooks/use-frontend-data";
import {
  CAMPAIGN_CATEGORIES,
  MAX_CAMPAIGN_TAG_LENGTH,
  MAX_CAMPAIGN_TAGS,
  normalizeTags,
} from "@/lib/campaign-categories";

const labelStyle = { display: "block", marginBottom: 6, color: "#15201a", fontSize: 13, fontWeight: 600 } as const;
const hintStyle = { marginTop: 6, color: "#6e7872", fontSize: 12 } as const;
const errorStyle = { marginTop: 6, color: "#b42323", fontSize: 12 } as const;

type Props = {
  category: string | null | undefined;
  tags: string[];
  onCategoryChange: (value: string | null) => void;
  onTagsChange: (value: string[]) => void;
  categoryError?: string;
  tagsError?: string;
  categoryRequired?: boolean;
};

/** Category picker + free-form tag input, shared by create and edit screens. */
export function CampaignClassificationFields({
  category,
  tags,
  onCategoryChange,
  onTagsChange,
  categoryError,
  tagsError,
  categoryRequired = false,
}: Props) {
  const { data: popularTags } = usePopularCampaignTags();

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>
          Category {categoryRequired ? null : <span style={{ color: "#626d66", fontWeight: 400 }}>(optional)</span>}
        </label>
        <AppSelect
          value={category ?? undefined}
          onChange={(value) => onCategoryChange((value as string | undefined) ?? null)}
          allowClear={!categoryRequired}
          placeholder="Choose the best fit"
          options={CAMPAIGN_CATEGORIES.map((c) => ({
            value: c.value,
            label: (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <c.icon style={{ color: "#14784a" }} />
                {c.label}
              </span>
            ),
          }))}
          style={{ width: "100%" }}
          status={categoryError ? "error" : undefined}
        />
        {categoryError
          ? <div style={errorStyle}>{categoryError}</div>
          : <div style={hintStyle}>Donors use this to find your campaign on the campaigns page.</div>}
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>
          Tags <span style={{ color: "#626d66", fontWeight: 400 }}>(optional, up to {MAX_CAMPAIGN_TAGS})</span>
        </label>
        <AppSelect
          mode="tags"
          value={tags}
          onChange={(values) => onTagsChange(normalizeTags(values as string[]).slice(0, MAX_CAMPAIGN_TAGS))}
          tokenSeparators={[","]}
          maxCount={MAX_CAMPAIGN_TAGS}
          maxLength={MAX_CAMPAIGN_TAG_LENGTH}
          placeholder="E.g. brikama, school fees, orphans"
          options={(popularTags ?? []).map(({ tag }) => ({ value: tag, label: tag }))}
          style={{ width: "100%" }}
          status={tagsError ? "error" : undefined}
        />
        {tagsError
          ? <div style={errorStyle}>{tagsError}</div>
          : <div style={hintStyle}>Press Enter or comma after each tag, e.g. a town, a school or a cause.</div>}
      </div>
    </>
  );
}
