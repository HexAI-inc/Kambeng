import { OnboardingCard } from "@/components/auth/onboarding-card";

type OnboardingPageProps = {
  searchParams: Promise<{ full_name?: string; email?: string; wave_number?: string }>;
};

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const resolvedSearchParams = await searchParams;

  return (
    <main style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "24px" }}>
      <OnboardingCard
        fullName={resolvedSearchParams.full_name}
        email={resolvedSearchParams.email}
        waveNumber={resolvedSearchParams.wave_number}
      />
    </main>
  );
}