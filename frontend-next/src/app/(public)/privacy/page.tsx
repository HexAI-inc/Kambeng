import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy — Kambeng",
  description: "How Kambeng collects, uses, and protects your personal information.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      subtitle="How we collect, use, and protect your personal information on the Kambeng platform."
      lastUpdated="June 2026"
      sections={[
        {
          heading: "1. Who We Are",
          body: (
            <p>
              Kambeng is a crowdfunding platform operated by HexAI, a technology company incorporated in The Gambia.
              We connect campaign creators with donors to fund charitable, personal, and community projects.
              References to &ldquo;Kambeng&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo; in this policy refer to HexAI and its Kambeng platform.
              Our registered contact email is <a href="mailto:legal@hexai.gm" style={{ color: "#1dc5ff" }}>legal@hexai.gm</a>.
            </p>
          ),
        },
        {
          heading: "2. Information We Collect",
          body: (
            <>
              <p style={{ marginBottom: 12 }}>We collect information you provide directly to us, including:</p>
              <ul style={{ paddingLeft: 20, margin: "0 0 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                <li><strong style={{ color: "#f0f6ff" }}>Account data:</strong> full name, email address, and Wave Mobile Money number when you register.</li>
                <li><strong style={{ color: "#f0f6ff" }}>Identity documents (KYC):</strong> government-issued ID and supporting documents submitted for campaign creator verification.</li>
                <li><strong style={{ color: "#f0f6ff" }}>Campaign content:</strong> titles, descriptions, images, and updates you post.</li>
                <li><strong style={{ color: "#f0f6ff" }}>Payment information:</strong> Wave transaction references and donation amounts. We do not store card numbers or Wave PINs.</li>
                <li><strong style={{ color: "#f0f6ff" }}>Communications:</strong> messages you send to our support team.</li>
              </ul>
              <p>We also collect data automatically when you use the platform, including IP address, browser type, pages visited, and referral source for security and analytics purposes.</p>
            </>
          ),
        },
        {
          heading: "3. How We Use Your Information",
          body: (
            <>
              <p style={{ marginBottom: 12 }}>We use the information we collect to:</p>
              <ul style={{ paddingLeft: 20, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                <li>Create and maintain your account and verify your identity.</li>
                <li>Process donations and campaign payouts via Wave Mobile Money.</li>
                <li>Send transactional emails such as donation confirmations, payout notices, and KYC decisions.</li>
                <li>Display campaign pages and updates to donors.</li>
                <li>Detect and prevent fraud, abuse, and violations of our Terms.</li>
                <li>Respond to your support requests and legal inquiries.</li>
                <li>Improve the platform through aggregate analytics (no personally identifiable information is shared externally).</li>
              </ul>
            </>
          ),
        },
        {
          heading: "4. How We Share Your Information",
          body: (
            <>
              <p style={{ marginBottom: 12 }}>We do not sell your personal data. We share information only in the following circumstances:</p>
              <ul style={{ paddingLeft: 20, margin: "0 0 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                <li><strong style={{ color: "#f0f6ff" }}>Payment processing:</strong> Wave Mobile Money receives your Wave number to process payouts.</li>
                <li><strong style={{ color: "#f0f6ff" }}>Email delivery:</strong> We use Resend to deliver transactional emails.</li>
                <li><strong style={{ color: "#f0f6ff" }}>Legal obligations:</strong> We may disclose information if required by Gambian law or a valid court order.</li>
                <li><strong style={{ color: "#f0f6ff" }}>Campaign pages:</strong> Your display name and campaign content are visible to the public.</li>
              </ul>
              <p>Your KYC documents are stored securely and are never shared with other users or third parties except where required by law.</p>
            </>
          ),
        },
        {
          heading: "5. Data Storage and Security",
          body: (
            <p>
              Your data is stored on servers located within the European Economic Area (EEA) and replicated to secure object storage.
              We apply industry-standard security measures including encryption in transit (TLS), hashed passwords, and access controls.
              KYC documents are encrypted at rest and accessible only to authorised Kambeng staff for verification purposes.
              No system is 100% secure; if you believe your account has been compromised, contact us immediately at{" "}
              <a href="mailto:security@hexai.gm" style={{ color: "#1dc5ff" }}>security@hexai.gm</a>.
            </p>
          ),
        },
        {
          heading: "6. Data Retention",
          body: (
            <p>
              We retain your account data for as long as your account is active. If you close your account, we retain transaction records
              for 7 years for financial and legal compliance. KYC documents are retained for 5 years following your last campaign activity
              to comply with anti-money laundering (AML) obligations. You may request deletion of other personal data by contacting us.
            </p>
          ),
        },
        {
          heading: "7. Your Rights",
          body: (
            <>
              <p style={{ marginBottom: 12 }}>You have the right to:</p>
              <ul style={{ paddingLeft: 20, margin: "0 0 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                <li>Access the personal data we hold about you.</li>
                <li>Correct inaccurate or incomplete data.</li>
                <li>Request deletion of your data (subject to legal retention requirements).</li>
                <li>Object to processing of your data for marketing purposes.</li>
                <li>Export your data in a portable format.</li>
              </ul>
              <p>To exercise any of these rights, email <a href="mailto:legal@hexai.gm" style={{ color: "#1dc5ff" }}>legal@hexai.gm</a> with your request and we will respond within 30 days.</p>
            </>
          ),
        },
        {
          heading: "8. Cookies",
          body: (
            <p>
              We use cookies and similar technologies to keep you logged in, remember your preferences, and gather analytics.
              For full details, see our <a href="/cookie-policy" style={{ color: "#1dc5ff" }}>Cookie Policy</a>.
            </p>
          ),
        },
        {
          heading: "9. Changes to This Policy",
          body: (
            <p>
              We may update this Privacy Policy from time to time. When we make significant changes, we will notify registered users
              by email and update the &ldquo;Last updated&rdquo; date at the top of this page. Continued use of Kambeng after changes
              take effect constitutes your acceptance of the updated policy.
            </p>
          ),
        },
      ]}
    />
  );
}
