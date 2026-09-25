import type { ComponentType, CSSProperties } from "react";
import {
  BankOutlined,
  CloudOutlined,
  EllipsisOutlined,
  GlobalOutlined,
  HeartOutlined,
  MedicineBoxOutlined,
  MoonOutlined,
  ReadOutlined,
  ShopOutlined,
  SunOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
} from "@ant-design/icons";

type IconComp = ComponentType<{ style?: CSSProperties }>;

export type CampaignCategory = { value: string; label: string; icon: IconComp };

// Must match CAMPAIGN_CATEGORIES in backend/app/models/campaign.py — the API
// rejects any other value.
export const CAMPAIGN_CATEGORIES: CampaignCategory[] = [
  { value: "education",   label: "Education",          icon: ReadOutlined },
  { value: "health",      label: "Health & Medical",   icon: MedicineBoxOutlined },
  { value: "emergency",   label: "Emergency & Relief", icon: ThunderboltOutlined },
  { value: "community",   label: "Community",          icon: TeamOutlined },
  { value: "faith",       label: "Faith",              icon: MoonOutlined },
  { value: "water",       label: "Water & Sanitation", icon: CloudOutlined },
  { value: "agriculture", label: "Agriculture",        icon: SunOutlined },
  { value: "environment", label: "Environment",        icon: GlobalOutlined },
  { value: "business",    label: "Small Business",     icon: ShopOutlined },
  { value: "sports",      label: "Sports",             icon: TrophyOutlined },
  { value: "arts",        label: "Arts & Culture",     icon: BankOutlined },
  { value: "memorial",    label: "Memorial & Funeral", icon: HeartOutlined },
  { value: "other",       label: "Other",              icon: EllipsisOutlined },
];

export const MAX_CAMPAIGN_TAGS = 8;
export const MAX_CAMPAIGN_TAG_LENGTH = 32;

export function getCampaignCategory(value?: string | null) {
  return CAMPAIGN_CATEGORIES.find((c) => c.value === value);
}

/** Same normalisation the API applies, so the UI shows what will be saved. */
export function normalizeTag(raw: string) {
  return raw.toLowerCase().replace(/[^a-z0-9 &-]+/g, " ").split(/\s+/).filter(Boolean).join(" ");
}

export function normalizeTags(values: string[]) {
  return Array.from(new Set(values.map(normalizeTag).filter(Boolean)));
}
