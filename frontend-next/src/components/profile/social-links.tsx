import type { SocialLinks as Links, SocialNetwork } from "@/lib/api";

export const SOCIAL_NETWORKS: { key: SocialNetwork; label: string; placeholder: string }[] = [
  { key: "website", label: "Website", placeholder: "https://example.gm" },
  { key: "facebook", label: "Facebook", placeholder: "https://facebook.com/yourpage" },
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/you" },
  { key: "x", label: "X (Twitter)", placeholder: "https://x.com/you" },
  { key: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@you" },
  { key: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/in/you" },
];

const ICON_PATHS: Record<SocialNetwork, string> = {
  website: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 0c2.5 2.7 4 6.2 4 10s-1.5 7.3-4 10m0-20C9.5 4.7 8 8.2 8 12s1.5 7.3 4 10M2 12h20",
  facebook: "M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z",
  instagram: "M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm9 5.5h.01M16 11.4A4 4 0 1 1 12.6 8 4 4 0 0 1 16 11.4z",
  x: "M4 4l16 16M20 4L4 20",
  tiktok: "M9 12a4 4 0 1 0 4 4V2c.5 2.5 2.5 4.5 5 5",
  linkedin: "M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2zM4 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4z",
};

/** Row of icon links for a public profile. Renders nothing when empty. */
export function SocialLinksRow({ links }: { links: Links }) {
  const present = SOCIAL_NETWORKS.filter(({ key }) => links[key]);
  if (!present.length) return null;
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {present.map(({ key, label }) => (
        <a
          key={key}
          href={links[key]}
          target="_blank"
          rel="noopener noreferrer nofollow ugc"
          title={label}
          aria-label={label}
          style={{ width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f6f3", border: "1px solid rgba(20,120,74,0.15)", color: "#14784a" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={ICON_PATHS[key]} />
          </svg>
        </a>
      ))}
    </div>
  );
}
