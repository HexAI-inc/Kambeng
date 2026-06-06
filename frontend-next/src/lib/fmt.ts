/** Convert SNAKE_CASE or SCREAMING_SNAKE to Title Case. */
export function humanize(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Format a number as "1,234.56 GMD". */
export function fmtGMD(n: number | string): string {
  return `${Number(n).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} GMD`;
}

/** Consistent date: "5 Jun 2026". */
export function fmtDate(d: string | Date): string {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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
