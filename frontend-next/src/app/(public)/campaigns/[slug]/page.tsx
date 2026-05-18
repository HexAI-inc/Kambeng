"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  AppButton,
  AppCard,
  AppCol,
  AppProgress,
  AppRow,
  AppSpace,
  AppStatistic,
  AppTag,
  AppText,
  AppTitle,
  AppParagraph,
} from "@/components/ui";
import { ReviewForm } from "@/components/reviews/review-form";
import { ProofList } from "@/components/ProofList";
import {
  useCampaignGoals,
  usePublicCampaignImages,
  useCampaignProofs,
  usePublicCampaignReviews,
  useSessionProfile,
} from "@/hooks/use-frontend-data";
import { api } from "@/lib/api";
import type { CampaignDiscoveryItem, CampaignGoal, CampaignReview, PublicCampaignImage } from "@/types/frontend";

const COVER_PLACEHOLDER =
  "linear-gradient(145deg, rgba(29,197,255,0.2) 0%, rgba(255,255,255,0.94) 50%, rgba(216,245,255,0.78) 100%)";

function renderStars(rating: number) {
  return Array.from({ length: 5 }, (_, index) => (index < rating ? "★" : "☆")).join("");
}

function ratingLabel(average: number) {
  if (average >= 4.5) return "Excellent";
  if (average >= 4) return "Very good";
  if (average >= 3) return "Good";
  return "Needs support";
}

export default function CampaignDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const { data: session } = useSessionProfile(true);
  const isLoggedIn = Boolean(session?.id);

  const { data, isLoading, error } = useQuery({
    queryKey: ["campaign-detail", slug],
    enabled: Boolean(slug),
    queryFn: async () => {
      const response = await api.get<CampaignDiscoveryItem>(`/campaigns/${slug}`);
      return response.data;
    },
  });

  const campaign = data;
  const { data: reviews, isLoading: reviewsLoading } = usePublicCampaignReviews(slug, Boolean(slug));
  const { data: images, isLoading: imagesLoading } = usePublicCampaignImages(slug, Boolean(slug));
  const { data: goals, isLoading: goalsLoading } = useCampaignGoals(slug, Boolean(slug));
  const { data: proofs, isLoading: proofsLoading } = useCampaignProofs(slug, Boolean(slug));
  const publicImages = useMemo(() => images ?? [], [images]);
  const publicReviews = useMemo(() => reviews ?? [], [reviews]);
  const publicGoals = useMemo(() => goals ?? [], [goals]);
  const publicProofs = useMemo(() => proofs ?? [], [proofs]);

  const progress = campaign?.target_amount
    ? Math.min((campaign.amount_raised / campaign.target_amount) * 100, 100)
    : 0;

  const reviewSummary = useMemo(() => {
    if (publicReviews.length === 0) {
      return { average: 0, count: 0, distribution: [0, 0, 0, 0, 0] };
    }

    const total = publicReviews.reduce((sum, review) => sum + review.rating, 0);
    const distribution = [5, 4, 3, 2, 1].map(
      (rating) => publicReviews.filter((review) => review.rating === rating).length,
    );

    return {
      average: total / publicReviews.length,
      count: publicReviews.length,
      distribution,
    };
  }, [publicReviews]);

  return (
    <main style={{ padding: "clamp(16px, 4vw, 32px)" }}>
      <AppSpace direction="vertical" size={18} style={{ width: "100%" }}>
        <AppSpace wrap size={12}>
          <Link href="/campaigns">
            <AppButton>Back to Campaigns</AppButton>
          </Link>
          {campaign ? (
            <Link href={`/quick-pay/${campaign.slug}`}>
              <AppButton type="primary">Donate with Wave</AppButton>
            </Link>
          ) : null}
        </AppSpace>

        <AppCard loading={isLoading} style={{ borderRadius: 0, boxShadow: "var(--shadow)" }}>
          {error ? (
            <AppText type="danger">Campaign could not be loaded.</AppText>
          ) : campaign ? (
            <AppSpace direction="vertical" size={18} style={{ width: "100%" }}>
              <AppCard
                style={{
                  borderRadius: 0,
                  boxShadow: "var(--shadow)",
                  border: "1px solid var(--line)",
                  overflow: "hidden",
                }}
              >
                <AppRow gutter={[24, 24]} align="middle">
                  <AppCol xs={24} lg={14}>
                    <AppSpace direction="vertical" size={14} style={{ width: "100%" }}>
                      <AppSpace wrap size={10}>
                        <AppTag color="blue">{campaign.status}</AppTag>
                        <AppTag color="cyan">{campaign.mode}</AppTag>
                        {campaign.target_amount ? <AppTag color="gold">Goal campaign</AppTag> : null}
                      </AppSpace>
                      <AppTitle level={2} style={{ margin: 0, letterSpacing: "-0.03em" }}>
                        {campaign.title}
                      </AppTitle>
                      <AppText type="secondary">/{campaign.slug}</AppText>
                      <AppParagraph style={{ fontSize: 16, lineHeight: 1.8, marginBottom: 0 }}>
                        {campaign.description}
                      </AppParagraph>
                      <AppSpace wrap size={12}>
                        <AppStatistic title="Progress" value={`${Math.round(progress)}%`} />
                        <AppStatistic title="Supporters' rating" value={reviewSummary.count > 0 ? reviewSummary.average.toFixed(1) : "0.0"} />
                        <AppStatistic title="Comments" value={reviewSummary.count} />
                      </AppSpace>
                    </AppSpace>
                  </AppCol>

                  <AppCol xs={24} lg={10}>
                    <AppCard
                      style={{
                        borderRadius: 0,
                        border: "1px solid var(--line)",
                        background:
                          "linear-gradient(135deg, rgba(29,197,255,0.12), rgba(255,255,255,0.92))",
                      }}
                    >
                      <AppSpace direction="vertical" size={14} style={{ width: "100%" }}>
                        <div>
                          <AppText type="secondary">Funding progress</AppText>
                          <AppTitle level={3} style={{ margin: "4px 0 0" }}>
                            {campaign.amount_raised.toLocaleString()} / {campaign.target_amount?.toLocaleString() ?? "0"} GMD
                          </AppTitle>
                        </div>
                        <AppProgress percent={progress} showInfo strokeColor="#1dc5ff" />
                        <AppSpace direction="vertical" size={8} style={{ width: "100%" }}>
                          <Link href={`/quick-pay/${campaign.slug}`}>
                            <AppButton block type="primary" size="large">
                              Donate with Wave
                            </AppButton>
                          </Link>
                          {isLoggedIn ? (
                            <Link href="/dashboard">
                              <AppButton block size="large">Go to Dashboard</AppButton>
                            </Link>
                          ) : (
                            <Link href="/auth/signup">
                              <AppButton block size="large">Create account to track donations</AppButton>
                            </Link>
                          )}
                        </AppSpace>
                      </AppSpace>
                    </AppCard>
                  </AppCol>
                </AppRow>
              </AppCard>

              <AppRow gutter={[18, 18]}>
                <AppCol xs={24} md={8}>
                  <AppCard>
                    <AppStatistic title="Average rating" value={reviewSummary.count > 0 ? reviewSummary.average.toFixed(1) : "0.0"} suffix="/ 5" />
                    <AppText type="secondary">{ratingLabel(reviewSummary.average)}</AppText>
                  </AppCard>
                </AppCol>
                <AppCol xs={24} md={8}>
                  <AppCard>
                    <AppStatistic title="Comments" value={reviewSummary.count} />
                    <AppText type="secondary">Public donor feedback on this campaign</AppText>
                  </AppCard>
                </AppCol>
                <AppCol xs={24} md={8}>
                  <AppCard>
                    <AppStatistic title="Evidence images" value={publicImages.length} />
                    <AppText type="secondary">Photo proof shared by the campaign owner</AppText>
                  </AppCard>
                </AppCol>
              </AppRow>

              <AppCard title="Campaign Goals" loading={goalsLoading} style={{ borderRadius: 0, boxShadow: "var(--shadow)" }}>
                {publicGoals.length > 0 ? (
                  <AppRow gutter={[16, 16]}>
                    {publicGoals.map((goal: CampaignGoal) => {
                      const percent = Math.min((goal.amount_raised / goal.target_amount) * 100, 100);

                      return (
                        <AppCol xs={24} md={12} key={goal.id}>
                          <AppCard style={{ borderRadius: 0, border: "1px solid var(--line)" }}>
                            <AppSpace direction="vertical" size={10} style={{ width: "100%" }}>
                              <AppSpace wrap size={8}>
                                <AppTag color="gold">{goal.status}</AppTag>
                                {goal.due_date ? <AppTag color="blue">Due {new Date(goal.due_date).toLocaleDateString()}</AppTag> : null}
                              </AppSpace>
                              <AppTitle level={4} style={{ margin: 0 }}>{goal.title}</AppTitle>
                              {goal.description ? <AppText type="secondary">{goal.description}</AppText> : null}
                              <AppProgress percent={percent} showInfo strokeColor="#1dc5ff" />
                              <AppText>
                                {goal.amount_raised.toLocaleString()} / {goal.target_amount.toLocaleString()} GMD
                              </AppText>
                              {goal.status === "ACTIVE" ? (
                                <Link href={`/quick-pay/${campaign.slug}?goalId=${goal.id}`}>
                                  <AppButton type="primary" block>
                                    Fund this goal
                                  </AppButton>
                                </Link>
                              ) : (
                                <AppButton block disabled>
                                  {goal.status === "COMPLETED" ? "Goal completed" : "Goal paused"}
                                </AppButton>
                              )}
                            </AppSpace>
                          </AppCard>
                        </AppCol>
                      );
                    })}
                  </AppRow>
                ) : (
                  <AppText type="secondary">The campaign owner has not published goals yet.</AppText>
                )}
              </AppCard>
            </AppSpace>
          ) : (
            <AppText type="secondary">Loading campaign...</AppText>
          )}
        </AppCard>

        {isLoggedIn ? (
          <AppRow gutter={[18, 18]}>
            <AppCol xs={24} lg={14}>
              <AppCard title="Campaign Gallery" loading={imagesLoading} style={{ borderRadius: 0, boxShadow: "var(--shadow)" }}>
                {publicImages.length > 0 ? (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                      gap: 12,
                    }}
                  >
                    {publicImages.map((image: PublicCampaignImage, index: number) => (
                      <a
                        key={`${image.file_name}-${index}`}
                        href={image.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: "block", textDecoration: "none" }}
                      >
                        <div
                          style={{
                            position: "relative",
                            border: "1px solid var(--line)",
                            background: COVER_PLACEHOLDER,
                            overflow: "hidden",
                            aspectRatio: "4 / 3",
                          }}
                        >
                          <Image
                            src={image.url}
                            alt={image.original_name ?? image.file_name}
                            fill
                            unoptimized
                            sizes="(max-width: 768px) 100vw, 33vw"
                            style={{ objectFit: "cover" }}
                          />
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <AppText type="secondary">
                    The campaign owner has not uploaded public proof images yet.
                  </AppText>
                )}
              </AppCard>
            </AppCol>

            <AppCol xs={24} lg={10}>
              <AppCard title="Rating Breakdown" loading={reviewsLoading} style={{ borderRadius: 0, boxShadow: "var(--shadow)" }}>
                {reviewSummary.count > 0 ? (
                  <AppSpace direction="vertical" size={10} style={{ width: "100%" }}>
                    {[5, 4, 3, 2, 1].map((rating, index) => {
                      const count = reviewSummary.distribution[index];
                      const percent = Math.round((count / reviewSummary.count) * 100);

                      return (
                        <div key={rating} style={{ display: "grid", gridTemplateColumns: "40px 1fr 40px", gap: 8, alignItems: "center" }}>
                          <AppText>{rating}★</AppText>
                          <div style={{ height: 8, background: "#eef4f1", borderRadius: 999, overflow: "hidden" }}>
                            <div style={{ width: `${percent}%`, height: "100%", background: "#1dc5ff" }} />
                          </div>
                          <AppText type="secondary">{count}</AppText>
                        </div>
                      );
                    })}
                  </AppSpace>
                ) : (
                  <AppText type="secondary">No public reviews yet.</AppText>
                )}
              </AppCard>
            </AppCol>
          </AppRow>
        ) : (
          <AppCard style={{ borderRadius: 0, boxShadow: "var(--shadow)", background: "linear-gradient(135deg, rgba(29,197,255,0.12), rgba(255,255,255,0.92))" }}>
            <AppSpace direction="vertical" size={12} style={{ width: "100%", textAlign: "center" }}>
              <AppTitle level={3} style={{ margin: 0 }}>Want to see donor feedback and share your own review?</AppTitle>
              <AppText type="secondary">Create an account in 30 seconds to join the community and help others make informed decisions.</AppText>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
                <Link href="/auth/signup">
                  <AppButton type="primary" size="large">Create Free Account</AppButton>
                </Link>
                <Link href="/auth/login">
                  <AppButton size="large">Already have an account? Login</AppButton>
                </Link>
              </div>
            </AppSpace>
          </AppCard>
        )}

        {isLoggedIn && (
          <AppCard title="Donor Comments" loading={reviewsLoading} style={{ borderRadius: 0, boxShadow: "var(--shadow)" }}>
            {publicReviews.length > 0 ? (
              <AppSpace direction="vertical" size={12} style={{ width: "100%" }}>
                {publicReviews.map((review: CampaignReview) => (
                  <div
                    key={review.id}
                    style={{
                      padding: 16,
                      border: "1px solid var(--line)",
                      borderRadius: 0,
                      background: "rgba(255,255,255,0.8)",
                    }}
                  >
                    <AppSpace direction="vertical" size={6} style={{ width: "100%" }}>
                      <AppSpace wrap size={8}>
                        <AppTag color="gold">{renderStars(review.rating)}</AppTag>
                        <AppText strong>{review.donor_name || "Anonymous"}</AppText>
                      </AppSpace>
                      <AppText>{review.comment}</AppText>
                      <AppText type="secondary" style={{ fontSize: 13 }}>
                        {new Date(review.created_at).toLocaleString()}
                      </AppText>
                    </AppSpace>
                  </div>
                ))}
              </AppSpace>
            ) : (
              <AppText type="secondary">No comments yet. Be the first to share your experience!</AppText>
            )}
          </AppCard>
        )}

        <AppCard title="Evidence & Proof" loading={proofsLoading} style={{ borderRadius: 0, boxShadow: "var(--shadow)" }}>
          {publicProofs.length > 0 ? (
            <ProofList proofs={publicProofs} />
          ) : (
            <AppText type="secondary">No public proof documents have been shared yet.</AppText>
          )}
        </AppCard>

        {isLoggedIn && slug && (
          <AppCard title="Share Your Review" style={{ borderRadius: 0, boxShadow: "var(--shadow)" }}>
            <ReviewForm slug={slug} />
          </AppCard>
        )}
      </AppSpace>
    </main>
  );
}
