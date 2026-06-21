import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/LegalPage";

export const metadata: Metadata = {
  title: "Refund Policy — Kambeng",
  description: "Kambeng's policy on donation refunds and campaign cancellations.",
};

export default function RefundPolicyPage() {
  return (
    <LegalPage
      title="Refund Policy"
      subtitle="Kambeng is a crowdfunding platform. Please read this policy carefully before making a donation."
      lastUpdated="June 2026"
      sections={[
        {
          heading: "1. General Principle",
          body: (
            <p>
              Donations made on Kambeng are voluntary contributions to campaign creators. Because funds are typically
              transferred to campaign creators after processing, <strong style={{ color: "#f0f6ff" }}>donations are generally
              non-refundable</strong> once confirmed. We encourage donors to research campaigns carefully before giving.
            </p>
          ),
        },
        {
          heading: "2. When a Refund May Be Issued",
          body: (
            <>
              <p style={{ marginBottom: 12 }}>We will consider a refund in the following circumstances:</p>
              <ul style={{ paddingLeft: 20, margin: "0 0 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                <li>
                  <strong style={{ color: "#f0f6ff" }}>Duplicate payment:</strong> If you were charged more than once for the same donation due to a technical error, we will refund the duplicate charge in full.
                </li>
                <li>
                  <strong style={{ color: "#f0f6ff" }}>Payment processing error:</strong> If you were charged an incorrect amount due to a platform error, the difference will be refunded.
                </li>
                <li>
                  <strong style={{ color: "#f0f6ff" }}>Campaign found to be fraudulent:</strong> If Kambeng determines through investigation that a campaign was fraudulent and the funds have not yet been disbursed to the creator, we will attempt to refund affected donors.
                </li>
                <li>
                  <strong style={{ color: "#f0f6ff" }}>Campaign cancelled before payout:</strong> If a campaign creator cancels their campaign and requests funds be returned before any payout has been processed, we will refund donors where technically possible.
                </li>
              </ul>
              <p>
                Refunds are not guaranteed in fraud cases where funds have already been disbursed to the campaign creator.
                In those cases, we will cooperate with authorities to pursue recovery.
              </p>
            </>
          ),
        },
        {
          heading: "3. Recurring Donations",
          body: (
            <p>
              You may cancel a recurring donation at any time from your donor dashboard before the next billing date.
              Recurring donations that have already been processed and forwarded to a campaign creator are not refundable.
              If a recurring charge occurs after you cancel, contact us within 7 days and we will issue a full refund of
              that charge.
            </p>
          ),
        },
        {
          heading: "4. How to Request a Refund",
          body: (
            <>
              <p style={{ marginBottom: 12 }}>
                To request a refund, email <a href="mailto:support@hexai.gm" style={{ color: "#1dc5ff" }}>support@hexai.gm</a> with:
              </p>
              <ul style={{ paddingLeft: 20, margin: "0 0 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                <li>Your full name and account email address.</li>
                <li>The campaign name and the date and amount of the donation.</li>
                <li>The reason for your refund request.</li>
              </ul>
              <p>
                We will acknowledge your request within 2 business days and communicate our decision within 10 business days.
                Approved refunds are returned to the original payment method (your Wave Mobile Money account) and typically
                appear within 3–7 business days.
              </p>
            </>
          ),
        },
        {
          heading: "5. Platform Fees",
          body: (
            <p>
              Platform and service fees are non-refundable in all circumstances, as they cover the cost of processing,
              identity verification, and platform maintenance. If a donation is refunded, only the net donation amount
              (after deducting applicable fees) will be returned to the donor.
            </p>
          ),
        },
        {
          heading: "6. Disputes",
          body: (
            <p>
              If you believe a campaign creator has misused your donation, please use the Report button on the campaign
              page to flag the campaign for moderation review. Our team will investigate and take appropriate action,
              which may include suspending the campaign and initiating a refund process if funds are recoverable.
              Kambeng is not liable for the actions of campaign creators but we take misuse seriously and will act promptly.
            </p>
          ),
        },
      ]}
    />
  );
}
