import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/LegalPage";

export const metadata: Metadata = {
  title: "Terms & Conditions — Kambeng",
  description: "The rules governing your use of the Kambeng crowdfunding platform.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms & Conditions"
      subtitle="Please read these terms carefully before using Kambeng. By creating an account you agree to be bound by them."
      lastUpdated="June 2026"
      sections={[
        {
          heading: "1. Acceptance of Terms",
          body: (
            <p>
              These Terms & Conditions (&ldquo;Terms&rdquo;) govern your access to and use of Kambeng, a crowdfunding platform
              operated by HexAI (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;). By registering for an account, launching
              a campaign, or making a donation, you confirm that you have read, understood, and agree to these Terms.
              If you do not agree, you may not use the platform.
            </p>
          ),
        },
        {
          heading: "2. Eligibility",
          body: (
            <>
              <p style={{ marginBottom: 12 }}>To use Kambeng you must:</p>
              <ul style={{ paddingLeft: 20, margin: "0 0 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                <li>Be at least 18 years of age.</li>
                <li>Have a valid Wave Mobile Money account registered in your name.</li>
                <li>Provide accurate and complete registration information.</li>
                <li>Not have been previously suspended or banned from Kambeng.</li>
              </ul>
              <p>
                Campaign creators must additionally complete our Know Your Customer (KYC) identity verification before a campaign
                can accept donations or process payouts.
              </p>
            </>
          ),
        },
        {
          heading: "3. Campaigns and Fundraising",
          body: (
            <>
              <p style={{ marginBottom: 12 }}>As a campaign creator, you agree to:</p>
              <ul style={{ paddingLeft: 20, margin: "0 0 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                <li>Only raise funds for lawful purposes consistent with Kambeng&apos;s community guidelines.</li>
                <li>Provide truthful, accurate, and non-misleading campaign descriptions and updates.</li>
                <li>Use donated funds solely for the stated campaign purpose.</li>
                <li>Respond to donor questions and provide progress updates in a timely manner.</li>
                <li>Comply with all applicable Gambian laws, including those relating to fundraising and financial transactions.</li>
              </ul>
              <p>
                Kambeng does not guarantee that any campaign will reach its target or that donated funds will be used as stated by the creator.
                Donors give at their own discretion and risk.
              </p>
            </>
          ),
        },
        {
          heading: "4. Prohibited Content and Conduct",
          body: (
            <>
              <p style={{ marginBottom: 12 }}>You may not use Kambeng to:</p>
              <ul style={{ paddingLeft: 20, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                <li>Raise funds for illegal activities, violence, terrorism, or hate groups.</li>
                <li>Post false, misleading, or defamatory content.</li>
                <li>Impersonate any person, organisation, or charity.</li>
                <li>Harass, threaten, or abuse other users.</li>
                <li>Circumvent or attempt to circumvent our KYC or fraud-prevention systems.</li>
                <li>Use the platform for money laundering or other financial crimes.</li>
                <li>Scrape, reverse-engineer, or interfere with the platform&apos;s technical operation.</li>
              </ul>
            </>
          ),
        },
        {
          heading: "5. Fees",
          body: (
            <>
              <p style={{ marginBottom: 12 }}>
                Kambeng charges a platform fee on each successful donation. The current fee structure is displayed on the campaign
                payout page and may be updated with 14 days&apos; notice. Fees are deducted from the donation amount before
                disbursement to the campaign creator and are not refundable.
              </p>
              <p>
                HexAI may also apply a service fee for certain payout methods. All applicable fees are disclosed before you confirm
                a withdrawal. Wave Mobile Money may apply its own transfer charges which are outside our control.
              </p>
            </>
          ),
        },
        {
          heading: "6. Payments and Payouts",
          body: (
            <>
              <p style={{ marginBottom: 12 }}>
                Donations are processed via Wave Mobile Money. By donating, you authorise Kambeng to receive the specified
                amount on behalf of the campaign creator.
              </p>
              <p style={{ marginBottom: 12 }}>
                Campaign payouts are initiated by the creator from their dashboard. We aim to process payout requests within
                3–5 business days, subject to KYC approval status and fraud checks. We reserve the right to delay or withhold
                payouts if we suspect fraudulent activity or a breach of these Terms.
              </p>
              <p>
                Recurring donations are charged automatically at the selected interval until cancelled. You may cancel a
                recurring donation at any time from your donor dashboard.
              </p>
            </>
          ),
        },
        {
          heading: "7. Intellectual Property",
          body: (
            <p>
              The Kambeng name, logo, and platform software are owned by HexAI. Content you upload (campaign text, images,
              updates) remains yours; by posting it you grant us a worldwide, royalty-free licence to display, reproduce, and
              distribute it in connection with operating the platform. This licence ends when you delete the content or close
              your account, except where copies have been made for backup or legal compliance purposes.
            </p>
          ),
        },
        {
          heading: "8. Disclaimers and Limitation of Liability",
          body: (
            <>
              <p style={{ marginBottom: 12 }}>
                Kambeng is provided &ldquo;as is&rdquo; without warranties of any kind. We do not guarantee uninterrupted
                service, the accuracy of campaign content, or that fundraising goals will be met.
              </p>
              <p>
                To the fullest extent permitted by law, HexAI&apos;s liability to you for any claim arising from your use of
                Kambeng is limited to the fees you paid to us in the 12 months preceding the claim. We are not liable for
                indirect, consequential, or punitive damages, loss of profits, or loss of data.
              </p>
            </>
          ),
        },
        {
          heading: "9. Account Suspension and Termination",
          body: (
            <p>
              We may suspend or terminate your account at any time if we reasonably believe you have violated these Terms,
              engaged in fraudulent activity, or pose a risk to other users. Where possible, we will notify you before taking
              action. You may close your account at any time by contacting <a href="mailto:support@hexai.gm" style={{ color: "#1dc5ff" }}>support@hexai.gm</a>.
              Pending payout requests will be reviewed and processed or returned on a case-by-case basis.
            </p>
          ),
        },
        {
          heading: "10. Governing Law",
          body: (
            <p>
              These Terms are governed by the laws of The Republic of The Gambia. Any disputes shall first be referred to
              mediation. If mediation fails, disputes shall be resolved in the courts of Banjul, The Gambia.
            </p>
          ),
        },
        {
          heading: "11. Changes to These Terms",
          body: (
            <p>
              We may modify these Terms at any time. We will give at least 14 days&apos; notice of material changes by email
              and by posting a notice on the platform. Continued use of Kambeng after the effective date of changes constitutes
              acceptance.
            </p>
          ),
        },
      ]}
    />
  );
}
