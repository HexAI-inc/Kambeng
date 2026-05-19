"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSessionProfile } from "@/hooks/use-frontend-data";

type NavItem = { key: string; label: string; href: string };

function isItemActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Logo() {
  return (
    <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{
        width: 36, height: 36,
        background: "linear-gradient(135deg, #1dc5ff 0%, #079bd4 100%)",
        borderRadius: 10,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 900, fontSize: 16, color: "#fff",
        boxShadow: "0 4px 12px rgba(29,197,255,0.4)",
        flexShrink: 0,
      }}>K</div>
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, color: "#f0f6ff", letterSpacing: "-0.03em" }}>
        Kambeng
      </span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSessionProfile(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const isLoggedIn = Boolean(session?.id);
  const isAdmin = session?.role === "ADMIN";
  const isPublic = !pathname.startsWith("/admin") && !pathname.startsWith("/dashboard") && !pathname.startsWith("/auth") && !pathname.startsWith("/kyc");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

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

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Navbar */}
      <header style={{
        position: "sticky", top: 0, zIndex: 100,
        background: scrolled ? "rgba(10,15,26,0.92)" : "rgba(10,15,26,0.6)",
        backdropFilter: "blur(20px)",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent",
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
                  color: active ? "#1dc5ff" : "#8899aa",
                  background: active ? "rgba(29,197,255,0.1)" : "transparent",
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
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "transparent",
                  color: "#8899aa",
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
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "transparent",
                    color: "#f0f6ff",
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
                    background: "linear-gradient(135deg, #1dc5ff, #079bd4)",
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    boxShadow: "0 4px 16px rgba(29,197,255,0.3)",
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
            onClick={() => setMobileOpen((v) => !v)}
            style={{
              width: 40, height: 40,
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8,
              background: "transparent",
              color: "#f0f6ff",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {mobileOpen ? "✕" : "☰"}
          </button>
        </div>
      </header>

      {/* Mobile nav overlay */}
      {mobileOpen && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 99,
          background: "rgba(10,15,26,0.98)",
          backdropFilter: "blur(20px)",
          paddingTop: 80,
          display: "flex", flexDirection: "column",
          padding: "80px 24px 24px",
          gap: 8,
        }}>
          {navLinks.map((item) => {
            const active = isItemActive(pathname, item.href);
            return (
              <Link key={item.key} href={item.href} onClick={() => setMobileOpen(false)}>
                <div style={{
                  padding: "16px 20px",
                  borderRadius: 12,
                  fontSize: 18,
                  fontWeight: active ? 700 : 500,
                  color: active ? "#1dc5ff" : "#f0f6ff",
                  background: active ? "rgba(29,197,255,0.1)" : "rgba(255,255,255,0.04)",
                  border: active ? "1px solid rgba(29,197,255,0.2)" : "1px solid rgba(255,255,255,0.06)",
                }}>
                  {item.label}
                </div>
              </Link>
            );
          })}
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            {isLoggedIn ? (
              <Link href="/auth/logout" onClick={() => setMobileOpen(false)}>
                <div style={{
                  padding: "16px 20px", borderRadius: 12, fontSize: 16, fontWeight: 500,
                  color: "#ff6b6b", background: "rgba(255,107,107,0.08)",
                  border: "1px solid rgba(255,107,107,0.2)", textAlign: "center",
                }}>Logout</div>
              </Link>
            ) : (
              <>
                <Link href="/auth/login" onClick={() => setMobileOpen(false)}>
                  <div style={{
                    padding: "16px 20px", borderRadius: 12, fontSize: 16, fontWeight: 500,
                    color: "#f0f6ff", background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)", textAlign: "center",
                  }}>Login</div>
                </Link>
                <Link href="/auth/signup" onClick={() => setMobileOpen(false)}>
                  <div style={{
                    padding: "16px 20px", borderRadius: 12, fontSize: 16, fontWeight: 700,
                    color: "#fff", background: "linear-gradient(135deg, #1dc5ff, #079bd4)",
                    textAlign: "center", boxShadow: "0 4px 16px rgba(29,197,255,0.3)",
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
      {isPublic && (
        <footer style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "40px clamp(16px, 4vw, 48px) 32px",
          background: "rgba(0,0,0,0.3)",
        }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 40, justifyContent: "space-between", marginBottom: 32 }}>
              <div style={{ maxWidth: 280 }}>
                <Logo />
                <p style={{ color: "#8899aa", fontSize: 14, marginTop: 12, lineHeight: 1.7 }}>
                  Gambia&apos;s crowdfunding platform powered by Wave mobile money. Fund what matters, transparently.
                </p>
              </div>
              <div style={{ display: "flex", gap: 48, flexWrap: "wrap" }}>
                <div>
                  <p style={{ color: "#f0f6ff", fontWeight: 600, marginBottom: 12, fontSize: 13 }}>Platform</p>
                  {[["Browse Campaigns", "/campaigns"], ["Start a Campaign", "/auth/signup"], ["How it Works", "/"]].map(([label, href]) => (
                    <div key={href} style={{ marginBottom: 8 }}>
                      <Link href={href} style={{ color: "#8899aa", fontSize: 14, transition: "color 0.2s" }}>{label}</Link>
                    </div>
                  ))}
                </div>
                <div>
                  <p style={{ color: "#f0f6ff", fontWeight: 600, marginBottom: 12, fontSize: 13 }}>Account</p>
                  {[["Login", "/auth/login"], ["Sign Up", "/auth/signup"], ["Dashboard", "/dashboard"]].map(([label, href]) => (
                    <div key={href} style={{ marginBottom: 8 }}>
                      <Link href={href} style={{ color: "#8899aa", fontSize: 14 }}>{label}</Link>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <p style={{ color: "#4a5568", fontSize: 13 }}>© 2026 Kambeng. Built for The Gambia.</p>
              <p style={{ color: "#4a5568", fontSize: 13 }}>Powered by Wave Mobile Money & HexAI</p>
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
      `}</style>
    </div>
  );
}
