import { TractionReport } from "@/components/admin/traction-report";

const WINDOWS = new Set([6, 12, 24]);

export default async function TractionReportPage({ searchParams }: { searchParams: Promise<{ months?: string }> }) {
  const requested = Number((await searchParams).months);
  return <TractionReport months={WINDOWS.has(requested) ? requested : 12} />;
}
