"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/layout/brand-mark";
import { usePathname } from "next/navigation";
import {
  AppstoreOutlined, FundProjectionScreenOutlined, TeamOutlined,
  HeartOutlined, ReconciliationOutlined, PercentageOutlined,
  WalletOutlined, AuditOutlined, BarChartOutlined,
  FileProtectOutlined, BankOutlined, WarningOutlined, MailOutlined, AlertOutlined,
  MenuOutlined, CloseOutlined, LogoutOutlined, SwapOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, NotificationOutlined, GiftOutlined,
  ApiOutlined,
} from "@ant-design/icons";

const BLUE = "#14784a";
const CARD = "#ffffff";

type IconComp = React.ComponentType<{ style?: React.CSSProperties }>;
type NavSection = { label: string; items: { key: string; label: string; href: string; icon: IconComp }[] };

const NAV: NavSection[] = [
  {
    label: "Overview",
    items: [
      { key: "overview", label: "Dashboard", href: "/admin/overview", icon: AppstoreOutlined },
    ],
  },
  {
    label: "Content",
    items: [
      { key: "campaigns", label: "Campaigns", href: "/admin/campaigns", icon: FundProjectionScreenOutlined },
      { key: "users", label: "Users", href: "/admin/users", icon: TeamOutlined },
    ],
  },
  {
    label: "Finance",
    items: [
      { key: "donations", label: "Donations", href: "/admin/donations", icon: HeartOutlined },
      { key: "reconciliations", label: "Reconciliations", href: "/admin/reconciliations", icon: ReconciliationOutlined },
      { key: "gateway", label: "Gateway", href: "/admin/gateway", icon: ApiOutlined },
      { key: "commissions", label: "Commissions", href: "/admin/commissions", icon: PercentageOutlined },
      { key: "payouts", label: "Payouts", href: "/admin/payouts", icon: WalletOutlined },
      { key: "auditlogs", label: "Audit Logs", href: "/admin/audit-logs", icon: AuditOutlined },
      { key: "reports", label: "Reports", href: "/admin/reports", icon: BarChartOutlined },
    ],
  },
  {
    label: "Growth",
    items: [
      { key: "marketing", label: "Marketing", href: "/admin/marketing", icon: NotificationOutlined },
      { key: "promotions", label: "Promotions", href: "/admin/promotions", icon: GiftOutlined },
    ],
  },
  {
    label: "Compliance",
    items: [
      { key: "kyc", label: "KYC Queue", href: "/admin/kyc-queue", icon: FileProtectOutlined },
      { key: "org-verifications", label: "Organizations", href: "/admin/org-verifications", icon: BankOutlined },
      { key: "kyc-emails", label: "KYC Emails", href: "/admin/kyc-notification-emails", icon: MailOutlined },
      { key: "moderation", label: "Moderation", href: "/admin/moderation", icon: WarningOutlined },
      { key: "fraud-emails", label: "Fraud Emails", href: "/admin/fraud-report-notification-emails", icon: AlertOutlined },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function Logo() {
  return (
    <Link href="/admin/campaigns" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
      <BrandMark size={34} />
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 17, color: "#15201a", letterSpacing: "-0.03em" }}>Admin</span>
    </Link>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebar = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ padding: "20px 16px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Logo />
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="admin-collapse-btn"
          style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid rgba(21,32,26,0.08)", background: "rgba(21,32,26,0.04)", color: "#56625b", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "4px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
        {NAV.map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <div style={{ fontSize: 9, fontWeight: 700, color: "#6e7872", textTransform: "uppercase", letterSpacing: "0.1em", padding: "10px 8px 4px" }}>
                {section.label}
              </div>
            )}
            {section.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  style={{ textDecoration: "none" }}
                >
                  <div style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: collapsed ? "10px" : "9px 10px",
                    borderRadius: 9,
                    background: active ? "rgba(20,120,74,0.12)" : "transparent",
                    border: active ? "1px solid rgba(20,120,74,0.2)" : "1px solid transparent",
                    color: active ? BLUE : "#56625b",
                    fontSize: 13, fontWeight: active ? 700 : 500,
                    cursor: "pointer", transition: "all 0.15s",
                    justifyContent: collapsed ? "center" : "flex-start",
                  }}
                    onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLDivElement).style.background = "rgba(21,32,26,0.04)"; }}
                    onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                  >
                    <item.icon style={{ fontSize: 14, flexShrink: 0 }} />
                    {!collapsed && <span>{item.label}</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <div style={{ padding: "12px 10px 16px", borderTop: "1px solid rgba(21,32,26,0.06)" }}>
        <Link href="/dashboard" style={{ textDecoration: "none" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: collapsed ? "10px" : "9px 10px",
            borderRadius: 9, color: "#56625b", fontSize: 13, fontWeight: 500,
            cursor: "pointer", transition: "all 0.15s",
            justifyContent: collapsed ? "center" : "flex-start",
          }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(21,32,26,0.04)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
          >
            <SwapOutlined style={{ fontSize: 14 }} />
            {!collapsed && <span>User Dashboard</span>}
          </div>
        </Link>
        <Link href="/auth/logout" style={{ textDecoration: "none" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: collapsed ? "10px" : "9px 10px",
            borderRadius: 9, color: "#d42f2f", fontSize: 13, fontWeight: 500,
            cursor: "pointer", transition: "all 0.15s",
            justifyContent: collapsed ? "center" : "flex-start",
          }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(239,68,68,0.06)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
          >
            <LogoutOutlined style={{ fontSize: 14 }} />
            {!collapsed && <span>Logout</span>}
          </div>
        </Link>
      </div>
    </div>
  );

  const sidebarWidth = collapsed ? 60 : 220;

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>

      {/* Desktop sidebar */}
      <aside
        className="admin-sidebar-desktop"
        style={{
          width: sidebarWidth, flexShrink: 0,
          background: CARD,
          borderRight: "1px solid rgba(21,32,26,0.06)",
          position: "sticky", top: 0, height: "100dvh",
          transition: "width 0.2s ease",
          overflow: "hidden",
        }}
      >
        {sidebar}
      </aside>

      {/* Mobile overlay sidebar */}
      {mobileOpen && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex" }}
          onClick={() => setMobileOpen(false)}
        >
          <aside
            style={{ width: 240, background: CARD, borderRight: "1px solid rgba(21,32,26,0.06)", height: "100%", overflow: "hidden", flexShrink: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            {sidebar}
          </aside>
          <div style={{ flex: 1, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} />
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Mobile top bar */}
        <header
          className="admin-mobile-bar"
          style={{
            display: "none", alignItems: "center", gap: 12,
            padding: "0 16px", height: 56, flexShrink: 0,
            background: CARD, borderBottom: "1px solid rgba(21,32,26,0.06)",
            position: "sticky", top: 0, zIndex: 100,
          }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid rgba(21,32,26,0.1)", background: "rgba(21,32,26,0.04)", color: "#15201a", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}
          ><MenuOutlined /></button>
          <Logo />
        </header>

        <div className="woven-strip woven-strip-thin" aria-hidden="true" />
        <main style={{ flex: 1 }}>
          {children}
        </main>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .admin-sidebar-desktop { display: none !important; }
          .admin-mobile-bar { display: flex !important; }
          .admin-collapse-btn { display: none !important; }
        }
        @media (min-width: 769px) {
          .admin-mobile-bar { display: none !important; }
        }

        /* ── Admin table mobile card layout ── */
        @media (max-width: 767px) {
          .admin-table-header { display: none !important; }
          .admin-table-wrap { min-width: unset !important; }

          .admin-table-row {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 0 12px;
            padding: 14px 16px !important;
            border-radius: 12px;
            margin: 6px 10px;
            border: 1px solid rgba(21,32,26,0.07) !important;
            background: #fff;
          }

          /* All detail cells: small label above value */
          .admin-table-row > div[data-label] {
            padding: 5px 0;
          }
          .admin-table-row > div[data-label]::before {
            content: attr(data-label);
            display: block;
            font-size: 9px;
            font-weight: 700;
            color: #6e7872;
            text-transform: uppercase;
            letter-spacing: 0.07em;
            margin-bottom: 2px;
          }

          /* ── Header row: primary content cell + Status ── */
          .admin-table-row > div[data-label="User"],
          .admin-table-row > div[data-label="Campaign"],
          .admin-table-row > div[data-label="Reference"],
          .admin-table-row > div[data-label="Title"],
          .admin-table-row > div[data-label="Reason"] {
            order: -2;
            padding-bottom: 10px;
            border-bottom: 1px solid rgba(21,32,26,0.05);
          }
          .admin-table-row > div[data-label="Status"] {
            order: -2;
            justify-self: end;
            align-self: start;
            padding-top: 2px;
            padding-bottom: 10px;
            border-bottom: 1px solid rgba(21,32,26,0.05);
          }

          /* No labels for header-row cells */
          .admin-table-row > div[data-label="User"]::before,
          .admin-table-row > div[data-label="Campaign"]::before,
          .admin-table-row > div[data-label="Reference"]::before,
          .admin-table-row > div[data-label="Title"]::before,
          .admin-table-row > div[data-label="Reason"]::before,
          .admin-table-row > div[data-label="Status"]::before { display: none !important; }

          /* ── Actions: full width at the bottom ── */
          .admin-table-row > div[data-label="Actions"],
          .admin-table-row > div[data-label="Review"],
          .admin-table-row > div[data-label="Action"] {
            order: 99;
            grid-column: 1 / -1;
            padding-top: 10px;
            border-top: 1px solid rgba(21,32,26,0.05);
            margin-top: 2px;
          }
          .admin-table-row > div[data-label="Actions"]::before,
          .admin-table-row > div[data-label="Review"]::before,
          .admin-table-row > div[data-label="Action"]::before { display: none !important; }

          /* ── KPI stat strips: 2-column ── */
          .admin-kpi-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}
