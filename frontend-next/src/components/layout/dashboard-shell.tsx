"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSessionProfile } from "@/hooks/use-frontend-data";

const BLUE = "#1dc5ff";
const BLUE_10 = "rgba(29,197,255,0.1)";

// ── Icons ─────────────────────────────────────────────────────────────────────

function IcHome({ c }: { c: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="7" height="7" rx="1.5" stroke={c} strokeWidth="1.8" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" stroke={c} strokeWidth="1.8" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" stroke={c} strokeWidth="1.8" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" stroke={c} strokeWidth="1.8" />
    </svg>
  );
}

function IcCampaigns({ c }: { c: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 11l19-9-9 19-2-8-8-2z" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IcKYC({ c }: { c: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12 2L4 6v6c0 5.5 3.5 10.7 8 12 4.5-1.3 8-6.5 8-12V6l-8-4z" stroke={c} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IcProfile({ c }: { c: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke={c} strokeWidth="1.8" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IcGiving({ c }: { c: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12 21s-7.5-4.6-9.5-9C1.2 9 2.6 5.9 5.6 5.2c1.8-.4 3.6.3 4.7 1.7L12 8.6l1.7-1.7c1.1-1.4 2.9-2.1 4.7-1.7 3 .7 4.4 3.8 3.1 6.8-2 4.4-9.5 9-9.5 9z" stroke={c} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function IcLogout({ c }: { c: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke={c} strokeWidth="2" strokeLinecap="round" />
      <path d="M16 17l5-5-5-5M21 12H9" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IcAdmin({ c }: { c: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12 2L4 6v6c0 5.5 3.5 10.7 8 12 4.5-1.3 8-6.5 8-12V6l-8-4z" stroke={c} strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="12" cy="11" r="2.5" stroke={c} strokeWidth="1.6" />
      <path d="M8 17c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

// ── Nav config ────────────────────────────────────────────────────────────────

type Tab = { key: string; label: string; href: string; icon: (c: string) => React.ReactNode };

const BASE_TABS: Tab[] = [
  { key: "home",      label: "Home",      href: "/dashboard",              icon: (c) => <IcHome c={c} /> },
  { key: "campaigns", label: "Campaigns", href: "/dashboard/my-campaigns", icon: (c) => <IcCampaigns c={c} /> },
  { key: "giving",    label: "Giving",    href: "/dashboard/my-donations", icon: (c) => <IcGiving c={c} /> },
  { key: "kyc",       label: "KYC",       href: "/dashboard/kyc",          icon: (c) => <IcKYC c={c} /> },
  { key: "profile",   label: "Profile",   href: "/dashboard/profile",      icon: (c) => <IcProfile c={c} /> },
];

const ADMIN_TAB: Tab = { key: "admin", label: "Admin", href: "/admin/overview", icon: (c) => <IcAdmin c={c} /> };

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href);
}

// ── Shell ─────────────────────────────────────────────────────────────────────

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: me } = useSessionProfile(true);

  const initials = me?.full_name
    ?.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase() ?? "?";
  const firstName = me?.full_name?.split(" ")[0] ?? "";
  const isAdmin = me?.role === "ADMIN";
  const tabs = isAdmin ? [...BASE_TABS, ADMIN_TAB] : BASE_TABS;

  return (
    <>
      {/* ── Top header ─────────────────────────────────────────── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 60,
        background: "rgba(10,15,26,0.94)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        height: 60,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 clamp(16px,4vw,48px)",
        flexShrink: 0,
      }}>

        {/* Logo */}
        <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", flexShrink: 0 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: "linear-gradient(135deg, #1dc5ff, #079bd4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, fontSize: 16, color: "#fff",
            boxShadow: "0 4px 12px rgba(29,197,255,0.4)",
          }}>K</div>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: "#f0f6ff", letterSpacing: "-0.03em" }}>
            Kambeng
          </span>
        </Link>

        {/* Desktop centre nav */}
        <nav className="dash-top-nav" style={{ display: "none", alignItems: "center", gap: 2 }}>
          {tabs.map((tab) => {
            const active = isActive(pathname, tab.href);
            const col = active ? BLUE : "#8899aa";
            return (
              <Link key={tab.key} href={tab.href} style={{ textDecoration: "none" }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "7px 14px", borderRadius: 8,
                  fontSize: 13, fontWeight: active ? 600 : 400,
                  color: col,
                  background: active ? BLUE_10 : "transparent",
                  transition: "all 0.2s",
                }}>
                  {tab.icon(col)}
                  {tab.label}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Desktop right: avatar + sign out */}
        <div className="dash-top-nav" style={{ display: "none", alignItems: "center", gap: 12 }}>
          {me && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 30, height: 30, borderRadius: "50%",
                background: "linear-gradient(135deg, #0d2340, #0a3d5c)",
                border: "2px solid rgba(29,197,255,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 800, color: BLUE, flexShrink: 0,
              }}>{initials}</div>
              <span style={{ fontSize: 13, color: "#8899aa", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {firstName}
              </span>
            </div>
          )}
          <Link href="/auth/logout" style={{ textDecoration: "none" }}>
            <button style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 12px", borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.04)",
              color: "#6b7a8d", fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}>
              <IcLogout c="#6b7a8d" />
              Sign out
            </button>
          </Link>
        </div>

        {/* Mobile right: sign out icon only */}
        <div className="dash-mobile-right" style={{ display: "none" }}>
          <Link href="/auth/logout" style={{ textDecoration: "none" }}>
            <button style={{
              width: 38, height: 38, borderRadius: 9,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.04)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}>
              <IcLogout c="#6b7a8d" />
            </button>
          </Link>
        </div>
      </header>

      {/* ── Page content ───────────────────────────────────────── */}
      <main className="dash-main" style={{ overflowX: "hidden" }}>
        {children}
      </main>

      {/* ── Mobile bottom tab bar ──────────────────────────────── */}
      <nav className="dash-btm" style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 60,
        background: "rgba(10,15,26,0.97)",
        backdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(255,255,255,0.07)",
        display: "none",
        alignItems: "stretch",
        padding: "0 0 env(safe-area-inset-bottom)",
      }}>
        {tabs.map((tab) => {
          const active = isActive(pathname, tab.href);
          const col = active ? BLUE : "#4a5568";
          return (
            <Link key={tab.key} href={tab.href} style={{ flex: 1, textDecoration: "none" }}>
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 4, padding: "10px 4px 8px",
                borderTop: active ? `2px solid ${BLUE}` : "2px solid transparent",
                transition: "all 0.15s",
              }}>
                {tab.icon(col)}
                <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, color: col, letterSpacing: "0.02em" }}>
                  {tab.label}
                </span>
              </div>
            </Link>
          );
        })}
      </nav>

      <style>{`
        @media (min-width: 768px) {
          .dash-top-nav    { display: flex !important; }
          .dash-mobile-right { display: none !important; }
          .dash-btm        { display: none !important; }
          .dash-main       { padding-bottom: 0 !important; }
        }
        @media (max-width: 767px) {
          .dash-top-nav    { display: none !important; }
          .dash-mobile-right { display: flex !important; }
          .dash-btm        { display: flex !important; }
          .dash-main       { padding-bottom: 72px; }
        }
      `}</style>
    </>
  );
}
