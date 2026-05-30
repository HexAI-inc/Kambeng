"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const BLUE = "#1dc5ff";
const BG = "#0a0f1a";
const CARD = "#0d1120";

type NavSection = { label: string; items: { key: string; label: string; href: string; icon: string }[] };

const NAV: NavSection[] = [
  {
    label: "Overview",
    items: [
      { key: "overview", label: "Dashboard", href: "/admin/overview", icon: "▣" },
    ],
  },
  {
    label: "Content",
    items: [
      { key: "campaigns", label: "Campaigns", href: "/admin/campaigns", icon: "◈" },
      { key: "users", label: "Users", href: "/admin/users", icon: "◉" },
    ],
  },
  {
    label: "Finance",
    items: [
      { key: "donations", label: "Donations", href: "/admin/donations", icon: "◆" },
      { key: "reconciliations", label: "Reconciliations", href: "/admin/reconciliations", icon: "◎" },
      { key: "commissions", label: "Commissions", href: "/admin/commissions", icon: "◇" },
      { key: "payouts", label: "Payouts", href: "/admin/payouts", icon: "◈" },
      { key: "auditlogs", label: "Audit Logs", href: "/admin/audit-logs", icon: "▦" },
      { key: "reports", label: "Reports", href: "/admin/reports", icon: "▦" },
    ],
  },
  {
    label: "Compliance",
    items: [
      { key: "kyc", label: "KYC Queue", href: "/admin/kyc-queue", icon: "◎" },
      { key: "moderation", label: "Moderation", href: "/admin/moderation", icon: "◈" },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function Logo() {
  return (
    <Link href="/admin/campaigns" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
      <div style={{ width: 34, height: 34, background: "linear-gradient(135deg, #1dc5ff, #079bd4)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 15, color: "#fff", boxShadow: "0 4px 12px rgba(29,197,255,0.35)", flexShrink: 0 }}>K</div>
      <span style={{ fontWeight: 800, fontSize: 17, color: "#f0f6ff", letterSpacing: "-0.03em" }}>Admin</span>
    </Link>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebar = (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, height: "100%" }}>
      <div style={{ padding: "20px 16px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Logo />
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="admin-collapse-btn"
          style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#8899aa", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          {collapsed ? "→" : "←"}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "4px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
        {NAV.map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <div style={{ fontSize: 9, fontWeight: 700, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.1em", padding: "10px 8px 4px" }}>
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
                    background: active ? "rgba(29,197,255,0.12)" : "transparent",
                    border: active ? "1px solid rgba(29,197,255,0.2)" : "1px solid transparent",
                    color: active ? BLUE : "#8899aa",
                    fontSize: 13, fontWeight: active ? 700 : 500,
                    cursor: "pointer", transition: "all 0.15s",
                    justifyContent: collapsed ? "center" : "flex-start",
                  }}
                    onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)"; }}
                    onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                  >
                    <span style={{ fontSize: 14, flexShrink: 0 }}>{item.icon}</span>
                    {!collapsed && <span>{item.label}</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <div style={{ padding: "12px 10px 16px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: collapsed ? "10px" : "9px 10px",
            borderRadius: 9, color: "#8899aa", fontSize: 13, fontWeight: 500,
            cursor: "pointer", transition: "all 0.15s",
            justifyContent: collapsed ? "center" : "flex-start",
          }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
          >
            <span style={{ fontSize: 14 }}>⤴</span>
            {!collapsed && <span>Back to Site</span>}
          </div>
        </Link>
        <Link href="/auth/logout" style={{ textDecoration: "none" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: collapsed ? "10px" : "9px 10px",
            borderRadius: 9, color: "#ef4444", fontSize: 13, fontWeight: 500,
            cursor: "pointer", transition: "all 0.15s",
            justifyContent: collapsed ? "center" : "flex-start",
          }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(239,68,68,0.06)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
          >
            <span style={{ fontSize: 14 }}>↩</span>
            {!collapsed && <span>Logout</span>}
          </div>
        </Link>
      </div>
    </div>
  );

  const sidebarWidth = collapsed ? 60 : 220;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: BG }}>

      {/* Desktop sidebar */}
      <aside
        className="admin-sidebar-desktop"
        style={{
          width: sidebarWidth, flexShrink: 0,
          background: CARD,
          borderRight: "1px solid rgba(255,255,255,0.06)",
          position: "sticky", top: 0, height: "100vh",
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
            style={{ width: 240, background: CARD, borderRight: "1px solid rgba(255,255,255,0.06)", height: "100vh", flexShrink: 0 }}
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
            background: CARD, borderBottom: "1px solid rgba(255,255,255,0.06)",
            position: "sticky", top: 0, zIndex: 100,
          }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#f0f6ff", cursor: "pointer", fontSize: 16 }}
          >☰</button>
          <Logo />
        </header>

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
      `}</style>
    </div>
  );
}
