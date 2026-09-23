import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/LegalPage";

export const metadata: Metadata = {
  title: "Cookie Policy — Kambeng",
  description: "How Kambeng uses cookies and similar technologies.",
};

export default function CookiePolicyPage() {
  return (
    <LegalPage
      title="Cookie Policy"
      subtitle="How we use cookies and similar technologies to make Kambeng work."
      lastUpdated="June 2026"
      sections={[
        {
          heading: "1. What Are Cookies?",
          body: (
            <p>
              Cookies are small text files placed on your device by a website. They help the site remember information
              about your visit — such as your login session — so you don&apos;t have to re-enter details every time.
              Similar technologies like local storage serve the same purpose.
            </p>
          ),
        },
        {
          heading: "2. Cookies We Use",
          body: (
            <>
              <p style={{ marginBottom: 16 }}>Kambeng uses the following types of cookies:</p>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ background: "#ffffff", border: "1px solid rgba(21,32,26,0.07)", borderRadius: 12, padding: "16px 18px" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#15201a", marginBottom: 4 }}>Strictly Necessary</div>
                  <div style={{ fontSize: 13, color: "#626d66", marginBottom: 8 }}>Required for the platform to function. Cannot be disabled.</div>
                  <ul style={{ paddingLeft: 18, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                    <li><strong style={{ color: "#4d5a52" }}>kambeng_auth</strong> — JWT session token that keeps you logged in. Expires when you log out or after 30 days.</li>
                    <li><strong style={{ color: "#4d5a52" }}>CSRF token</strong> — Prevents cross-site request forgery attacks. Session-scoped.</li>
                  </ul>
                </div>

                <div style={{ background: "#ffffff", border: "1px solid rgba(21,32,26,0.07)", borderRadius: 12, padding: "16px 18px" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#15201a", marginBottom: 4 }}>Functional</div>
                  <div style={{ fontSize: 13, color: "#626d66", marginBottom: 8 }}>Remember your preferences to improve your experience.</div>
                  <ul style={{ paddingLeft: 18, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                    <li><strong style={{ color: "#4d5a52" }}>admin_search_models</strong> — Stores your selected search filters in the admin panel. Saved to localStorage, no expiry.</li>
                  </ul>
                </div>

                <div style={{ background: "#ffffff", border: "1px solid rgba(21,32,26,0.07)", borderRadius: 12, padding: "16px 18px" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#15201a", marginBottom: 4 }}>Analytics</div>
                  <div style={{ fontSize: 13, color: "#626d66", marginBottom: 8 }}>Help us understand how the platform is being used. Data is aggregated and not linked to individual users.</div>
                  <ul style={{ paddingLeft: 18, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                    <li>We currently use server-side logging only. No third-party analytics scripts (e.g. Google Analytics) are loaded on the platform.</li>
                  </ul>
                </div>
              </div>
            </>
          ),
        },
        {
          heading: "3. Third-Party Cookies",
          body: (
            <p>
              Kambeng does not currently embed third-party advertising or tracking cookies. If you use external payment links
              (such as Wave&apos;s payment page) you will be subject to Wave&apos;s own cookie policy during that session.
              We have no control over cookies set by third-party websites.
            </p>
          ),
        },
        {
          heading: "4. Managing Cookies",
          body: (
            <>
              <p style={{ marginBottom: 12 }}>
                You can control cookies through your browser settings. Most browsers allow you to:
              </p>
              <ul style={{ paddingLeft: 20, margin: "0 0 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                <li>View and delete individual cookies.</li>
                <li>Block third-party cookies.</li>
                <li>Block all cookies (note: this will prevent you from staying logged in to Kambeng).</li>
                <li>Set preferences for specific sites.</li>
              </ul>
              <p>
                Instructions for common browsers:&nbsp;
                <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" style={{ color: "#14784a" }}>Chrome</a>,&nbsp;
                <a href="https://support.mozilla.org/en-US/kb/enhanced-tracking-protection-firefox-desktop" target="_blank" rel="noopener noreferrer" style={{ color: "#14784a" }}>Firefox</a>,&nbsp;
                <a href="https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac" target="_blank" rel="noopener noreferrer" style={{ color: "#14784a" }}>Safari</a>.
              </p>
            </>
          ),
        },
        {
          heading: "5. Changes to This Policy",
          body: (
            <p>
              We may update this Cookie Policy as we add new features. Changes will be reflected in the &ldquo;Last updated&rdquo;
              date above. For significant changes, we will also notify registered users by email.
            </p>
          ),
        },
      ]}
    />
  );
}
