"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/layout/brand-mark";
import { usePathname } from "next/navigation";
import { MenuOutlined, CloseOutlined } from "@ant-design/icons";
import { useSessionProfile } from "@/hooks/use-frontend-data";

type NavItem = { key: string; label: string; href: string };

function isItemActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Logo() {
  return (
    <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <BrandMark />
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, color: "#15201a", letterSpacing: "-0.03em" }}>
        Kambeng
      </span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname.startsWith("/auth");
  const { data: session } = useSessionProfile(!isAuthPage);
  const [mobileMenuOpenAt, setMobileMenuOpenAt] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const mobileOpen = mobileMenuOpenAt === pathname;

  const isLoggedIn = Boolean(session?.id);
  const isAdmin = session?.role === "ADMIN";
  const isPublic = !pathname.startsWith("/admin") && !pathname.startsWith("/dashboard") && !pathname.startsWith("/auth") && !pathname.startsWith("/kyc");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = useMemo<NavItem[]>(() => {
    const base: NavItem[] = [
      { key: "home", label: "Home", href: "/" },
      { key: "campaigns", label: "Campaigns", href: "/campaigns" },
    ];
    if (isLoggedIn) {
      base.push({ key: "dashboard", label: "Dashboard", href: "/dashboard" });
      if (isAdmin) {
        base.push({ key: "admin", label: "Admin", href: "/admin/overview" });
      }
    }
    return base;
  }, [isLoggedIn, isAdmin]);

  const authLink = isLoggedIn
    ? { key: "logout", label: "Logout", href: "/auth/logout" }
    : { key: "login", label: "Login", href: "/auth/login" };

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Navbar */}
      <header style={{
        position: "sticky", top: 0, zIndex: 100,
        background: scrolled ? "rgba(246,244,239,0.92)" : "rgba(246,244,239,0.6)",
        backdropFilter: "blur(20px)",
        borderBottom: scrolled ? "1px solid rgba(21,32,26,0.08)" : "1px solid transparent",
        transition: "all 0.3s ease",
        padding: "0 clamp(16px, 4vw, 48px)",
        height: 68,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <Logo />

        {/* Desktop nav */}
        <nav style={{ display: "flex", alignItems: "center", gap: 4 }} className="desktop-nav">
          {navLinks.map((item) => {
            const active = isItemActive(pathname, item.href);
            return (
              <Link key={item.key} href={item.href}>
                <div style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: active ? 600 : 400,
                  color: active ? "#14784a" : "#56625b",
                  background: active ? "rgba(20,120,74,0.1)" : "transparent",
                  transition: "all 0.2s",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}>
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Auth button — desktop */}
          <div className="desktop-nav">
            {isLoggedIn ? (
              <Link href={authLink.href}>
                <button style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "1px solid rgba(21,32,26,0.12)",
                  background: "transparent",
                  color: "#56625b",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}>
                  Logout
                </button>
              </Link>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <Link href="/auth/login">
                  <button style={{
                    padding: "8px 18px",
                    borderRadius: 8,
                    border: "1px solid rgba(21,32,26,0.15)",
                    background: "transparent",
                    color: "#15201a",
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}>
                    Login
                  </button>
                </Link>
                <Link href="/auth/signup">
                  <button style={{
                    padding: "8px 18px",
                    borderRadius: 8,
                    border: "none",
                    background: "#14784a",
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    boxShadow: "0 4px 16px rgba(20,120,74,0.3)",
                  }}>
                    Get Started
                  </button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            className="mobile-nav"
            onClick={() => setMobileMenuOpenAt((current) => (current === pathname ? null : pathname))}
            style={{
              width: 40, height: 40,
              border: "1px solid rgba(21,32,26,0.12)",
              borderRadius: 8,
              background: "transparent",
              color: "#15201a",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {mobileOpen ? <CloseOutlined /> : <MenuOutlined />}
          </button>
        </div>
      </header>

      {/* Mobile nav overlay */}
      {mobileOpen && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 99,
          background: "rgba(246,244,239,0.98)",
          backdropFilter: "blur(20px)",
          paddingTop: 80,
          display: "flex", flexDirection: "column",
          padding: "80px 24px 24px",
          gap: 8,
        }}>
          {navLinks.map((item) => {
            const active = isItemActive(pathname, item.href);
            return (
              <Link key={item.key} href={item.href} onClick={() => setMobileMenuOpenAt(null)}>
                <div style={{
                  padding: "16px 20px",
                  borderRadius: 12,
                  fontSize: 18,
                  fontWeight: active ? 700 : 500,
                  color: active ? "#14784a" : "#15201a",
                  background: active ? "rgba(20,120,74,0.1)" : "rgba(21,32,26,0.04)",
                  border: active ? "1px solid rgba(20,120,74,0.2)" : "1px solid rgba(21,32,26,0.06)",
                }}>
                  {item.label}
                </div>
              </Link>
            );
          })}
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            {isLoggedIn ? (
              <Link href="/auth/logout" onClick={() => setMobileMenuOpenAt(null)}>
                <div style={{
                  padding: "16px 20px", borderRadius: 12, fontSize: 16, fontWeight: 500,
                  color: "#d42f2f", background: "#fff3f3",
                  border: "1px solid rgba(255,107,107,0.2)", textAlign: "center",
                }}>Logout</div>
              </Link>
            ) : (
              <>
                <Link href="/auth/login" onClick={() => setMobileMenuOpenAt(null)}>
                  <div style={{
                    padding: "16px 20px", borderRadius: 12, fontSize: 16, fontWeight: 500,
                    color: "#15201a", background: "rgba(21,32,26,0.06)",
                    border: "1px solid rgba(21,32,26,0.1)", textAlign: "center",
                  }}>Login</div>
                </Link>
                <Link href="/auth/signup" onClick={() => setMobileMenuOpenAt(null)}>
                  <div style={{
                    padding: "16px 20px", borderRadius: 12, fontSize: 16, fontWeight: 700,
                    color: "#fff", background: "#14784a",
                    textAlign: "center", boxShadow: "0 4px 16px rgba(20,120,74,0.3)",
                  }}>Get Started Free</div>
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      {/* Page content */}
      <main style={{ flex: 1 }}>
        {children}
      </main>

      {/* Footer */}
      {isPublic && <div className="woven-strip" aria-hidden="true" />}
      {isPublic && (
        <footer className="site-footer" style={{
          padding: "48px clamp(16px, 4vw, 48px) 32px",
          background: "#eeebe4",
        }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div className="footer-top" style={{ display: "flex", flexWrap: "wrap", gap: 40, justifyContent: "space-between", marginBottom: 36 }}>
              <div style={{ maxWidth: 280 }}>
                <Logo />
                <p style={{ color: "#626d66", fontSize: 14, marginTop: 14, lineHeight: 1.75 }}>
                  Gambia&apos;s most transparent way to give — powered by Wave, APS Mobile Money, and secure card payments.
                </p>
                {/* Payment method logos */}
                <div style={{ display: "flex", gap: 8, marginTop: 16, alignItems: "center" }}>
                  {[
                    { label: "Wave", color: "#14784a", bg: "#e8f2ed", border: "rgba(20,120,74,0.2)" },
                    { label: "APS", color: "#c97a06", bg: "#faf2e6", border: "rgba(201,122,6,0.2)" },
                    { label: "Visa", color: "#4f46e5", bg: "#eff0fe", border: "rgba(99,102,241,0.2)" },
                  ].map(({ label, color, bg, border }) => (
                    <span key={label} style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, color, background: bg, border: `1px solid ${border}`, letterSpacing: "0.05em" }}>{label}</span>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 48, flexWrap: "wrap" }}>
                <div>
                  <p style={{ color: "#15201a", fontWeight: 600, marginBottom: 14, fontSize: 12, letterSpacing: "0.07em", textTransform: "uppercase" }}>Platform</p>
                  {[["Browse Campaigns", "/campaigns"], ["Start a Campaign", "/auth/signup"], ["How it Works", "/"]].map(([label, href]) => (
                    <div key={label} style={{ marginBottom: 10 }}>
                      <Link href={href} style={{ color: "#626d66", fontSize: 14, transition: "color 0.2s" }}>{label}</Link>
                    </div>
                  ))}
                </div>
                <div>
                  <p style={{ color: "#15201a", fontWeight: 600, marginBottom: 14, fontSize: 12, letterSpacing: "0.07em", textTransform: "uppercase" }}>Account</p>
                  {[["Login", "/auth/login"], ["Sign Up", "/auth/signup"], ["Dashboard", "/dashboard"]].map(([label, href]) => (
                    <div key={label} style={{ marginBottom: 10 }}>
                      <Link href={href} style={{ color: "#626d66", fontSize: 14 }}>{label}</Link>
                    </div>
                  ))}
                </div>
                <div>
                  <p style={{ color: "#15201a", fontWeight: 600, marginBottom: 14, fontSize: 12, letterSpacing: "0.07em", textTransform: "uppercase" }}>Legal</p>
                  {[
                    ["Privacy Policy", "/privacy"],
                    ["Terms & Conditions", "/terms"],
                    ["Refund Policy", "/refund-policy"],
                    ["Cookie Policy", "/cookie-policy"],
                  ].map(([label, href]) => (
                    <div key={label} style={{ marginBottom: 10 }}>
                      <Link href={href} style={{ color: "#626d66", fontSize: 14 }}>{label}</Link>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ borderTop: "1px solid rgba(21,32,26,0.05)", paddingTop: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <p style={{ color: "#6e7872", fontSize: 13 }}>© 2026 Kambeng. Built for The Gambia. Powered by HexAI.</p>
              <p style={{ color: "#6e7872", fontSize: 13 }}>🇬🇲 Made with pride in The Gambia</p>
            </div>
          </div>
        </footer>
      )}

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-nav { display: flex !important; }
        }
        @media (min-width: 769px) {
          .desktop-nav { display: flex !important; }
          .mobile-nav { display: none !important; }
        }
        @media (max-width: 640px) {
          .site-footer { padding: 28px clamp(16px, 4vw, 48px) 20px !important; }
          .footer-top { gap: 24px !important; margin-bottom: 20px !important; }
        }
      `}</style>
    </div>
  );
}
