/** Convert SNAKE_CASE or SCREAMING_SNAKE to Title Case. */
export function humanize(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Format a number as "1,234 GMD".
 *
 * Kambeng deals in whole dalasi — no bututs anywhere, including on screen.
 * Showing two decimals implied a precision the payment rail doesn't accept
 * and the ledger no longer stores.
 */
export function fmtGMD(n: number | string): string {
  return `${Math.round(Number(n)).toLocaleString("en-GB", {
    maximumFractionDigits: 0,
  })} GMD`;
}

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/** Short form for tight spaces: 950, 3K, 12.5K, 1.2M, 3.4B. */
export function fmtCompact(n: number): string {
  return compact.format(Math.round(n));
}

/** Full figure until it stops fitting, compact from a million up. */
export function fmtGMDShort(n: number): string {
  return Math.abs(n) >= 1_000_000 ? `${fmtCompact(n)} GMD` : fmtGMD(n);
}

/** Consistent date: "5 Jun 2026". */
export function fmtDate(d: string | Date): string {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "just now", "5m ago", "3h ago", "12d ago", then a date. */
export function timeAgo(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(iso);
}

const RAIL_LABELS: Record<string, string> = {
  wave: "Wave",
  aps: "APS Mobile Money",
  waychit_card: "Card",
  unknown: "Unknown",
};

/** Payment rail as donors know it: "aps" → "APS Mobile Money", "waychit_card" → "Card". */
export function railLabel(rail?: string | null): string {
  if (!rail) return "—";
  return RAIL_LABELS[rail.toLowerCase()] ?? humanize(rail);
}

/** Human label for KYC status enums. */
export function kycLabel(status?: string | null): string {
  switch ((status ?? "").toUpperCase()) {
    case "APPROVED":     return "Approved";
    case "SUBMITTED":    return "Under review";
    case "REVIEWING":    return "Under review";
    case "REJECTED":     return "Rejected";
    default:             return "Not submitted";
  }
}
