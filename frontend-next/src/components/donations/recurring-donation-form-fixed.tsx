"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { AppButton, AppCard, AppSpace, AppText, AppTitle } from "@/components/ui";
import { useCreateRecurringDonation } from "@/hooks/use-frontend-data";

const recurringDonationSchema = z.object({
  amount: z.number().min(1, "Amount must be at least 1 GMD"),
  frequency: z.enum(["WEEKLY", "MONTHLY", "QUARTERLY", "ANNUAL"]),
  anchor_date: z.string().optional(),
});

type RecurringDonationFormValues = z.infer<typeof recurringDonationSchema>;

interface RecurringDonationFormProps {
  slug: string;
  campaign_id: number;
  campaign_title: string;
  onSuccess?: () => void;
}

export function RecurringDonationForm({
  slug,
  campaign_id,
  campaign_title,
  onSuccess,
}: RecurringDonationFormProps) {
  const { mutate: createRecurring, isPending } = useCreateRecurringDonation();
  const [showForm, setShowForm] = useState(false);

  const form = useForm<RecurringDonationFormValues>({
    resolver: zodResolver(recurringDonationSchema),
    defaultValues: {
      amount: 50,
      frequency: "MONTHLY",
      anchor_date: undefined,
    },
  });

  const onSubmit = async (data: RecurringDonationFormValues) => {
    createRecurring(
      {
        campaign_id,
        amount: data.amount,
        frequency: data.frequency,
        anchor_date: data.anchor_date,
      },
      {
        onSuccess: () => {
          form.reset();
          setShowForm(false);
          if (onSuccess) {
            onSuccess();
          }
        },
      },
    );
  };

  const frequencyLabels: Record<string, string> = {
    WEEKLY: "Weekly",
    MONTHLY: "Monthly",
    QUARTERLY: "Quarterly (every 3 months)",
    ANNUAL: "Annual",
  };

  const frequencyOptions = Object.entries(frequencyLabels).map(([key, label]) => ({
    value: key,
    label,
  }));

  return (
    <AppCard style={{ borderRadius: 0, boxShadow: "var(--shadow)" }}>
      <AppSpace direction="vertical" size={16} style={{ width: "100%" }}>
        {!showForm ? (
          <>
            <AppTitle level={3} style={{ margin: 0 }}>
              Support {campaign_title} Every Month
            </AppTitle>
            <AppText type="secondary">
              Set up an automated donation to provide consistent support. You&apos;ll get a reminder email each month with a payment link.
            </AppText>
            <AppButton
              type="primary"
              onClick={() => setShowForm(true)}
              style={{ alignSelf: "flex-start" }}
            >
              Set Up Recurring Donation
            </AppButton>
          </>
        ) : (
          <>
            <AppTitle level={4} style={{ margin: 0 }}>
              Recurring Donation Setup
            </AppTitle>

            <form onSubmit={form.handleSubmit(onSubmit)} style={{ width: "100%" }}>
              <AppSpace direction="vertical" size={12} style={{ width: "100%" }}>
                {/* Amount Input */}
                <div>
                  <AppText strong style={{ display: "block", marginBottom: 8 }}>
                    Amount (GMD)
                  </AppText>
                  <input
                    type="number"
                    {...form.register("amount", { valueAsNumber: true })}
                    placeholder="50"
                    min="1"
                    step="1"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "1px solid var(--line)",
                      borderRadius: 0,
                      fontSize: 14,
                    }}
                  />
                  {form.formState.errors.amount && (
                    <AppText type="danger" style={{ fontSize: 12, marginTop: 4 }}>
                      {form.formState.errors.amount.message}
                    </AppText>
                  )}
                </div>

                {/* Frequency Select */}
                <div>
                  <AppText strong style={{ display: "block", marginBottom: 8 }}>
                    Frequency
                  </AppText>
                  <Controller
                    name="frequency"
                    control={form.control}
                    render={({ field }) => (
                      <select
                        {...field}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          border: "1px solid var(--line)",
                          borderRadius: 0,
                          fontSize: 14,
                        }}
                      >
                        {frequencyOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    )}
                  />
                </div>

                {/* Anchor Date Input (Optional) */}
                <div>
                  <AppText strong style={{ display: "block", marginBottom: 8 }}>
                    Start Date (Optional)
                  </AppText>
                  <AppText type="secondary" style={{ fontSize: 12, marginBottom: 8 }}>
                    Leave blank to start today. Charges will occur on this date each {form.watch("frequency").toLowerCase()}
                  </AppText>
                  <input
                    type="date"
                    {...form.register("anchor_date")}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "1px solid var(--line)",
                      borderRadius: 0,
                      fontSize: 14,
                    }}
                  />
                </div>

                {/* Summary */}
                <div
                  style={{
                    background: "rgba(29,197,255,0.05)",
                    padding: 12,
                    borderRadius: 4,
                    border: "1px solid rgba(29,197,255,0.2)",
                  }}
                >
                  <AppText strong style={{ marginBottom: 4 }}>
                    You&apos;ll donate:
                  </AppText>
                  <AppText style={{ fontSize: 16, color: "#1dc5ff", marginBottom: 8 }}>
                    {form.watch("amount")} GMD {form.watch("frequency").toLowerCase()}
                  </AppText>
                  <AppText type="secondary" style={{ fontSize: 12 }}>
                    You&apos;ll receive a reminder email each {form.watch("frequency").toLowerCase()} with a payment button to complete the donation.
                  </AppText>
                </div>

                {/* Submit and Cancel Buttons */}
                <AppSpace size={12}>
                  <AppButton
                    type="primary"
                    htmlType="submit"
                    loading={isPending}
                  >
                    Confirm Recurring Donation
                  </AppButton>
                  <AppButton
                    htmlType="button"
                    onClick={() => {
                      setShowForm(false);
                      form.reset();
                    }}
                    disabled={isPending}
                  >
                    Cancel
                  </AppButton>
                </AppSpace>

                <AppText type="secondary" style={{ fontSize: 12 }}>
                  You can manage or cancel your recurring donations anytime from your dashboard.
                </AppText>
              </AppSpace>
            </form>
          </>
        )}
      </AppSpace>
    </AppCard>
  );
}
