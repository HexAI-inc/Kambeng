"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useSubmitCampaignReview } from "@/hooks/use-frontend-data";

const BLUE = "#1dc5ff";
const RED = "#ef4444";
const GOLD = "#fbbf24";

const reviewSchema = z.object({
  rating: z.number().min(1, "Please select a rating").max(5),
  comment: z.string().min(10, "Comment must be at least 10 characters").max(500),
  donor_name: z.string().optional(),
});
type ReviewFormValues = z.infer<typeof reviewSchema>;

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.05)",
  color: "#f0f6ff",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
  transition: "border-color 0.2s",
};

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <div style={{ fontSize: 11, color: RED, marginTop: 4 }}>{msg}</div>;
}

interface ReviewFormProps {
  slug: string;
  onSuccess?: () => void;
}

export function ReviewForm({ slug, onSuccess }: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const { mutate: submitReview, isPending } = useSubmitCampaignReview();

  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { rating: 0, comment: "", donor_name: "" },
  });

  const onSubmit = form.handleSubmit((data) => {
    submitReview(
      { slug, rating: data.rating, comment: data.comment, donor_name: data.donor_name },
      {
        onSuccess: () => {
          form.reset();
          setRating(0);
          setSubmitted(true);
          onSuccess?.();
        },
      },
    );
  });

  if (submitted) {
    return (
      <div style={{ padding: "16px 18px", borderRadius: 12, background: "rgba(27,191,136,0.08)", border: "1px solid rgba(27,191,136,0.2)", color: "#1bbf88", fontSize: 14, fontWeight: 600, textAlign: "center" }}>
        Thanks for your review!
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Star rating */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#8899aa", display: "block", marginBottom: 8 }}>
          Your rating
        </label>
        <div style={{ display: "flex", gap: 4 }}>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => { setRating(star); form.setValue("rating", star, { shouldValidate: true }); }}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              style={{
                background: "none", border: "none", padding: 2, cursor: "pointer",
                fontSize: 26, lineHeight: 1,
                color: (hovered || rating) >= star ? GOLD : "rgba(255,255,255,0.15)",
                transition: "color 0.15s",
              }}
              aria-label={`Rate ${star} star${star !== 1 ? "s" : ""}`}
            >★</button>
          ))}
        </div>
        <FieldError msg={form.formState.errors.rating?.message} />
      </div>

      {/* Comment */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#8899aa", display: "block", marginBottom: 6 }}>
          Your experience
        </label>
        <textarea
          {...form.register("comment")}
          placeholder="Tell other donors what you think about this campaign (min 10 characters)"
          rows={4}
          style={{ ...fieldStyle, resize: "vertical", minHeight: 90 }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(29,197,255,0.4)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
        />
        <FieldError msg={form.formState.errors.comment?.message} />
      </div>

      {/* Donor name */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#8899aa", display: "block", marginBottom: 6 }}>
          Your name <span style={{ fontWeight: 400, color: "#4a5568" }}>(optional)</span>
        </label>
        <input
          {...form.register("donor_name")}
          type="text"
          placeholder="Leave blank to post as Anonymous"
          style={fieldStyle}
          onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(29,197,255,0.4)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        style={{
          width: "100%", padding: "12px", borderRadius: 10, border: "none",
          background: `linear-gradient(135deg, ${BLUE}, #079bd4)`,
          color: "#fff", fontSize: 14, fontWeight: 700, cursor: isPending ? "not-allowed" : "pointer",
          opacity: isPending ? 0.7 : 1,
          boxShadow: "0 4px 16px rgba(29,197,255,0.25)",
          transition: "opacity 0.2s",
        }}
      >
        {isPending ? "Posting…" : "Post Review"}
      </button>

      <p style={{ fontSize: 12, color: "#4a5568", margin: 0 }}>
        Be respectful and honest — your review helps others make informed decisions.
      </p>
    </form>
  );
}
