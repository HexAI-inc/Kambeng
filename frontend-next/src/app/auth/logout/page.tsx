"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { logoutSession } from "@/lib/api";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    logoutSession().finally(() => {
      router.replace("/auth/login");
    });
  }, [router]);

  return (
    <main style={{ minHeight: "100vh", background: "#0a0f1a", display: "grid", placeItems: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 36, height: 36, border: "2px solid #1dc5ff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
        <div style={{ color: "#6b7a8d", fontSize: 14 }}>Signing out…</div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}
