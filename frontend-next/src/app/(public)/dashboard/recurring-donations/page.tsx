"use client";

import { useMemo } from "react";
import Link from "next/link";

import {
  AppButton,
  AppCard,
  AppCol,
  AppRow,
  AppSpace,
  AppStatistic,
  AppTag,
  AppText,
  AppTitle,
} from "@/components/ui";
import {
  useUserRecurringDonations,
  useCancelRecurringDonation,
  useUpdateRecurringDonation,
} from "@/hooks/use-frontend-data";

export default function RecurringDonationsDashboardPage() {
  const { data, isLoading } = useUserRecurringDonations();
  const { mutate: cancelRecurring } = useCancelRecurringDonation();
  const { mutate: updateRecurring } = useUpdateRecurringDonation();

  const recurringDonations = data?.recurring_donations || [];

  // Calculate statistics
  const stats = useMemo(() => {
    return {
      total_recurring: recurringDonations.length,
      active_recurring: recurringDonations.filter((d) => d.is_active).length,
      monthly_commitment: recurringDonations
        .filter((d) => d.is_active)
        .reduce((sum, d) => sum + d.amount, 0),
    };
  }, [recurringDonations]);

  const handleCancel = (id: number) => {
    if (confirm("Are you sure you want to cancel this recurring donation?")) {
      cancelRecurring(id);
    }
  };

  const handlePause = (id: number, is_active: boolean) => {
    updateRecurring({
      recurring_donation_id: id,
      is_active: !is_active,
    });
  };

  return (
    <main style={{ padding: "24px", maxWidth: "1000px", margin: "0 auto" }}>
      <AppSpace direction="vertical" size={24} style={{ width: "100%" }}>
        {/* Header */}
        <div>
          <AppTitle level={1} style={{ margin: 0 }}>
            My Recurring Donations
          </AppTitle>
          <AppText type="secondary">
            Manage your automated monthly donations and commitments.
          </AppText>
        </div>

        {/* Statistics */}
        {recurringDonations.length > 0 && (
          <AppRow gutter={[16, 16]}>
            <AppCol xs={24} sm={8}>
              <AppCard>
                <AppStatistic
                  title="Active Donations"
                  value={stats.active_recurring}
                  valueStyle={{ color: "#1dc5ff" }}
                />
              </AppCard>
            </AppCol>
            <AppCol xs={24} sm={8}>
              <AppCard>
                <AppStatistic
                  title="Monthly Commitment"
                  value={`${stats.monthly_commitment.toFixed(2)} GMD`}
                  valueStyle={{ color: "#1dc5ff" }}
                />
              </AppCard>
            </AppCol>
            <AppCol xs={24} sm={8}>
              <AppCard>
                <AppStatistic
                  title="Total Campaigns"
                  value={stats.total_recurring}
                  valueStyle={{ color: "#1dc5ff" }}
                />
              </AppCard>
            </AppCol>
          </AppRow>
        )}

        {/* Donations List */}
        {isLoading ? (
          <AppCard>
            <AppText>Loading your recurring donations...</AppText>
          </AppCard>
        ) : recurringDonations.length === 0 ? (
          <AppCard style={{ textAlign: "center", padding: "40px 24px" }}>
            <AppTitle level={3} style={{ margin: "0 0 16px 0" }}>
              No Recurring Donations Yet
            </AppTitle>
            <AppText type="secondary" style={{ marginBottom: 24 }}>
              Set up an automated donation to a campaign to provide consistent support.
            </AppText>
            <Link href="/campaigns">
              <AppButton type="primary">Browse Campaigns</AppButton>
            </Link>
          </AppCard>
        ) : (
          <AppSpace direction="vertical" size={16} style={{ width: "100%" }}>
            {recurringDonations.map((donation) => (
              <AppCard key={donation.id} style={{ borderRadius: 0 }}>
                <AppRow gutter={[16, 16]} align="middle">
                  <AppCol xs={24} sm={12}>
                    <AppSpace direction="vertical" size={8} style={{ width: "100%" }}>
                      <AppText strong style={{ fontSize: 16 }}>
                        {donation.id ? `Campaign #${donation.campaign_id}` : "Recurring Donation"}
                      </AppText>

                      <AppSpace wrap size={8}>
                        <AppTag color={donation.is_active ? "green" : "orange"}>
                          {donation.is_active ? "Active" : "Paused"}
                        </AppTag>
                        <AppTag>{donation.frequency}</AppTag>
                      </AppSpace>

                      <AppText style={{ fontSize: 14 }}>
                        <strong>{donation.amount.toFixed(2)} GMD</strong> {donation.frequency.toLowerCase()}
                      </AppText>

                      <AppText type="secondary" style={{ fontSize: 12 }}>
                        Next charge: {new Date(donation.next_charge_date).toLocaleDateString()}
                      </AppText>

                      {donation.last_charge_date && (
                        <AppText type="secondary" style={{ fontSize: 12 }}>
                          Last charged: {new Date(donation.last_charge_date).toLocaleDateString()}
                        </AppText>
                      )}
                    </AppSpace>
                  </AppCol>

                  <AppCol xs={24} sm={12} style={{ textAlign: "right" }}>
                    <AppSpace size={8}>
                      <AppButton
                        size="small"
                        onClick={() => handlePause(donation.id, donation.is_active)}
                      >
                        {donation.is_active ? "Pause" : "Resume"}
                      </AppButton>
                      <AppButton
                        size="small"
                        danger
                        onClick={() => handleCancel(donation.id)}
                      >
                        Cancel
                      </AppButton>
                    </AppSpace>
                  </AppCol>
                </AppRow>
              </AppCard>
            ))}
          </AppSpace>
        )}

        {/* Info Section */}
        <AppCard style={{ background: "rgba(29,197,255,0.05)", border: "1px solid rgba(29,197,255,0.2)" }}>
          <AppSpace direction="vertical" size={12}>
            <AppTitle level={4} style={{ margin: 0, color: "#1dc5ff" }}>
              How Recurring Donations Work
            </AppTitle>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: "#666" }}>
              <li>You'll receive a reminder email on your donation anniversary date</li>
              <li>Each email includes a "Pay Now" button with your donation amount pre-filled</li>
              <li>Simply click to complete the payment via Wave or your preferred method</li>
              <li>You can pause, resume, or cancel anytime with no penalties</li>
            </ul>
          </AppSpace>
        </AppCard>
      </AppSpace>
    </main>
  );
}
