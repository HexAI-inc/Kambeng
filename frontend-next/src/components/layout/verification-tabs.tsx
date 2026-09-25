"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard/kyc", label: "Your identity" },
  { href: "/dashboard/organizations", label: "Organizations" },
];

/** Switch between personal KYC and organization verification — both live under the KYC tab. */
export function VerificationTabs() {
  const pathname = usePathname();
  return (
    <nav style={{ display: "inline-flex", gap: 4, padding: 4, borderRadius: 12, background: "rgba(21,32,26,0.05)", alignSelf: "flex-start" }}>
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            style={{
              padding: "7px 14px", borderRadius: 9, textDecoration: "none", fontSize: 13,
              fontWeight: active ? 700 : 500, color: active ? "#14784a" : "#56625b",
              background: active ? "#fff" : "transparent",
              boxShadow: active ? "0 1px 3px rgba(21,32,26,0.1)" : "none",
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
