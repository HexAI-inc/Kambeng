"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuOutlined } from "@ant-design/icons";
import { AppButton, AppDrawer, AppSpace, AppTag, AppText } from "@/components/ui";
import { useSessionProfile } from "@/hooks/use-frontend-data";

type NavItem = { key: string; label: string; href: string };

type NavModel = {
  items: NavItem[];
  primaryItems: NavItem[];
  secondaryItems: NavItem[];
  authAction: NavItem | null;
};

type AppShellProps = {
  section?: "public" | "dashboard" | "admin";
  navItems?: NavItem[];
  role?: string | null;
  children: React.ReactNode;
};

function resolveSection(pathname: string): "public" | "dashboard" | "admin" {
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/dashboard")) return "dashboard";
  return "public";
}

function resolveAuthAction(pathname: string, isLoggedIn: boolean): NavItem | null {
  if (isLoggedIn) {
    return { key: "logout", label: "Logout", href: "/auth/logout" };
  }

  if (pathname.startsWith("/auth/login")) {
    return { key: "signup", label: "Sign Up", href: "/auth/signup" };
  }

  if (pathname.startsWith("/auth/signup")) {
    return { key: "login", label: "Login", href: "/auth/login" };
  }

  return { key: "login", label: "Login", href: "/auth/login" };
}

function isItemActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function buildNavModel(isLoggedIn: boolean, isAdmin: boolean): NavModel {
  const publicItems: NavItem[] = [
    { key: "home", label: "Home", href: "/" },
    { key: "campaigns", label: "Campaigns", href: "/campaigns" },
  ];

  if (!isLoggedIn) {
    return {
      items: publicItems,
      primaryItems: publicItems,
      secondaryItems: [],
      authAction: { key: "login", label: "Login", href: "/auth/login" },
    };
  }

  const userItems: NavItem[] = [
    { key: "dashboard", label: "Dashboard", href: "/dashboard" },
    { key: "my-campaigns", label: "My Campaigns", href: "/dashboard/my-campaigns" },
    { key: "recurring-donations", label: "Recurring Donations", href: "/dashboard/recurring-donations" },
    { key: "kyc", label: "KYC", href: "/kyc" },
  ];

  const adminItems: NavItem[] = isAdmin
    ? [
        { key: "admin-home", label: "Admin Home", href: "/admin" },
        { key: "admin-campaigns", label: "Admin Campaigns", href: "/admin/campaigns" },
        { key: "admin-users", label: "Admin Users", href: "/admin/users" },
        { key: "admin-moderation", label: "Admin Moderation", href: "/admin/moderation" },
        { key: "admin-reports", label: "Admin Reports", href: "/admin/reports" },
      ]
    : [];

  return {
    items: [...publicItems, ...userItems, ...adminItems],
    primaryItems: [
      { key: "home", label: "Home", href: "/" },
      { key: "dashboard", label: "Dashboard", href: "/dashboard" },
    ],
    secondaryItems: [
      { key: "campaigns", label: "Campaigns", href: "/campaigns" },
      { key: "my-campaigns", label: "My Campaigns", href: "/dashboard/my-campaigns" },
      { key: "recurring-donations", label: "Recurring Donations", href: "/dashboard/recurring-donations" },
      { key: "kyc", label: "KYC", href: "/kyc" },
      ...adminItems.slice(1),
    ],
    authAction: { key: "logout", label: "Logout", href: "/auth/logout" },
  };
}

export function AppShell({ section, navItems, role, children }: AppShellProps) {
  const pathname = usePathname();
  const { data: session } = useSessionProfile(true);
  const [isCompact, setIsCompact] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const onChange = () => setIsCompact(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const resolvedRole = role ?? session?.role ?? null;
  const resolvedSection = section ?? resolveSection(pathname);
  const isLoggedIn = Boolean(session?.id);
  const isAdmin = resolvedRole === "ADMIN";

  const computedNavItems = useMemo<NavItem[]>(() => {
    if (navItems?.length) return navItems;
    return buildNavModel(isLoggedIn, isAdmin).items;
  }, [navItems, isLoggedIn, isAdmin]);

  const primaryNavItems = useMemo<NavItem[]>(() => {
    if (navItems?.length) return navItems.slice(0, 3);
    return buildNavModel(isLoggedIn, isAdmin).primaryItems;
  }, [navItems, isLoggedIn, isAdmin]);

  const secondaryNavItems = useMemo<NavItem[]>(() => {
    if (navItems?.length) return navItems.slice(3);
    return buildNavModel(isLoggedIn, isAdmin).secondaryItems;
  }, [navItems, isLoggedIn, isAdmin]);

  // Ensure admin links are hidden for non-admin users even if navItems were provided externally
  const visibleNavItems = useMemo(() => (isAdmin ? computedNavItems : computedNavItems.filter((i) => !i.href.startsWith("/admin"))), [computedNavItems, isAdmin]);
  const visiblePrimaryNavItems = useMemo(() => (isAdmin ? primaryNavItems : primaryNavItems.filter((i) => !i.href.startsWith("/admin"))), [primaryNavItems, isAdmin]);
  const visibleSecondaryNavItems = useMemo(() => (isAdmin ? secondaryNavItems : secondaryNavItems.filter((i) => !i.href.startsWith("/admin"))), [secondaryNavItems, isAdmin]);

  const authAction = useMemo<NavItem | null>(() => {
    if (navItems?.length) return isLoggedIn ? { key: "logout", label: "Logout", href: "/auth/logout" } : null;
    return resolveAuthAction(pathname, isLoggedIn);
  }, [navItems, isLoggedIn, pathname]);

  const activeMenuKey = visibleNavItems.find((item) => isItemActive(pathname, item.href))?.href ?? pathname;

  return (
    <div style={{ minHeight: "100vh", background: "transparent" }}>
      <header
        style={{
          background: "rgba(245, 246, 248, 0.88)",
          borderBottom: "2px solid var(--line)",
          backdropFilter: "blur(8px)",
          position: "sticky",
          top: 0,
          zIndex: 30,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          paddingInline: "clamp(14px, 3vw, 24px)",
          paddingBlock: 10,
          minHeight: 72,
        }}
      >
        <AppSpace
          size={12}
          wrap
          style={{
            border: "2px solid var(--line)",
            borderRadius: 0,
            padding: "8px 12px",
            background: "rgba(245, 246, 248, 0.82)",
          }}
        >
          <Link href="/" style={{ display: "inline-flex", alignItems: "center" }}>
            <AppText strong style={{ fontSize: 18, letterSpacing: "0.01em" }}>
              Kambeng
            </AppText>
          </Link>
          <AppTag color={resolvedSection === "admin" ? "volcano" : "blue"}>
            {resolvedSection.toUpperCase()}
          </AppTag>
        </AppSpace>

        {isCompact ? (
          <AppSpace>
            <AppButton icon={<MenuOutlined />} onClick={() => setMobileNavOpen(true)} style={{ borderWidth: 2 }}>
              Menu
            </AppButton>
          </AppSpace>
        ) : (
          <AppSpace
            wrap
            size={10}
            style={{
              justifyContent: "flex-end",
              border: "2px solid var(--line)",
              borderRadius: 0,
              padding: "8px 10px",
              background: "rgba(245, 246, 248, 0.82)",
            }}
          >
            {visiblePrimaryNavItems.map((item) => {
              const active = isItemActive(pathname, item.href);
              return (
                <Link key={item.key} href={item.href}>
                  <AppButton
                    type={active ? "primary" : "default"}
                    style={{
                      borderWidth: 2,
                      boxShadow: active ? "inset 0 0 0 1px rgba(255,255,255,0.28)" : "none",
                    }}
                  >
                    {item.label}
                  </AppButton>
                </Link>
              );
            })}
            {visibleSecondaryNavItems.length ? (
              <AppButton icon={<MenuOutlined />} onClick={() => setMobileNavOpen(true)} style={{ borderWidth: 2 }}>
                More
              </AppButton>
            ) : null}
            {authAction ? (
              <Link href={authAction.href}>
                <AppButton danger style={{ borderWidth: 2 }}>
                  {authAction.label}
                </AppButton>
              </Link>
            ) : null}
          </AppSpace>
        )}
      </header>

      <main style={{ padding: "16px clamp(14px, 3vw, 24px) 24px" }}>
        <div
          style={{
            border: "2px solid var(--line)",
            borderRadius: 0,
            background: "rgba(245, 246, 248, 0.86)",
            padding: "clamp(12px, 2.4vw, 20px)",
          }}
        >
          {children}
        </div>
      </main>

      <AppDrawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} placement="right" title="Navigate">
        <AppSpace orientation="vertical" size={14} style={{ width: "100%" }}>
          {visiblePrimaryNavItems.map((item) => (
            <Link key={item.key} href={item.href} onClick={() => setMobileNavOpen(false)}>
              <AppButton block type={activeMenuKey === item.href ? "primary" : "default"} style={{ borderWidth: 2 }}>
                {item.label}
              </AppButton>
            </Link>
          ))}
              {visibleSecondaryNavItems.length ? (
            <>
              <AppText strong style={{ marginTop: 4 }}>
                More
              </AppText>
              {visibleSecondaryNavItems.map((item) => (
                <Link key={item.key} href={item.href} onClick={() => setMobileNavOpen(false)}>
                  <AppButton block type={activeMenuKey === item.href ? "primary" : "default"} style={{ borderWidth: 2 }}>
                    {item.label}
                  </AppButton>
                </Link>
              ))}
            </>
          ) : null}
          {authAction ? (
            <Link href={authAction.href} onClick={() => setMobileNavOpen(false)}>
              <AppButton block danger style={{ borderWidth: 2 }}>
                {authAction.label}
              </AppButton>
            </Link>
          ) : null}
        </AppSpace>
      </AppDrawer>
    </div>
  );
}
