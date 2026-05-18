"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { AppButton, AppSpace, AppText, AppForm, AppInputField } from "@/components/ui";
import { AppAlert } from "@/components/ui/app-alert";
import { useSubmitCampaignReview } from "@/hooks/use-frontend-data";

const reviewSchema = z.object({
  rating: z.number().min(1).max(5),
  comment: z.string().min(10, "Comment must be at least 10 characters").max(500),
  donor_name: z.string().optional(),
});

type ReviewFormValues = z.infer<typeof reviewSchema>;

interface ReviewFormProps {
  slug: string;
  onSuccess?: () => void;
}

export function ReviewForm({ slug, onSuccess }: ReviewFormProps) {
  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const { mutate: submitReview, isPending } = useSubmitCampaignReview();

  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      rating: 0,
      comment: "",
      donor_name: "",
    },
  });

  const onSubmit = async (data: ReviewFormValues) => {
    submitReview(
      {
        slug,
        rating: data.rating,
        comment: data.comment,
        donor_name: data.donor_name,
      },
      {
        onSuccess: () => {
          form.reset();
          setRating(0);
          if (onSuccess) {
            onSuccess();
          }
        },
      },
    );
  };

  return (
    <AppForm layout="vertical" onFinish={() => void onSubmit(form.getValues())} style={{ width: "100%" }}>
      <AppSpace direction="vertical" size={12} style={{ width: "100%" }}>
        {/* Star Rating Picker */}
        <div>
          <AppText strong style={{ display: "block", marginBottom: 8 }}>
            Rate this campaign
          </AppText>
          <div style={{ display: "flex", gap: 4 }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => {
                  setRating(star);
                  form.setValue("rating", star);
                }}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 28,
                  cursor: "pointer",
                  padding: 0,
                  color: (hoveredRating || rating) >= star ? "#ffc069" : "#d9d9d9",
                  transition: "color 0.2s",
                }}
              >
                ★
              </button>
            ))}
          </div>
          {form.formState.errors.rating && (
            <AppText type="danger" style={{ fontSize: 12, marginTop: 4 }}>
              Please select a rating
            </AppText>
          )}
        </div>

        {/* Comment Textarea */}
        <div>
          <AppText strong style={{ display: "block", marginBottom: 8 }}>
            Share your experience
          </AppText>
          <textarea
            {...form.register("comment")}
            placeholder="Tell other donors what you think about this campaign (min 10 chars)"
            style={{
              width: "100%",
              minHeight: 80,
              padding: 12,
              border: "1px solid var(--line)",
              borderRadius: 0,
              fontFamily: "inherit",
              fontSize: 14,
              resize: "vertical",
            }}
          />
          {form.formState.errors.comment && (
            <AppText type="danger" style={{ fontSize: 12, marginTop: 4 }}>
              {form.formState.errors.comment.message}
            </AppText>
          )}
        </div>

        {/* Optional Donor Name */}
        <div>
          <AppText strong style={{ display: "block", marginBottom: 8 }}>
            Your name (optional)
          </AppText>
          <input
            {...form.register("donor_name")}
            type="text"
            placeholder="Leave blank to post as Anonymous"
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid var(--line)",
              borderRadius: 0,
              fontSize: 14,
            }}
          />
        </div>

        {/* Submit Button */}
        <AppButton
          type="primary"
          size="large"
          htmlType="submit"
          loading={isPending}
          block
          style={{ marginTop: 8 }}
        >
          Post Review
        </AppButton>

        {form.formState.errors.root && (
          <AppAlert type="error" title={form.formState.errors.root.message} showIcon />
        )}

        <AppText type="secondary" style={{ fontSize: 12 }}>
          Your review helps others make informed decisions. Be respectful and honest.
        </AppText>
      </AppSpace>
    </AppForm>
  );
}
