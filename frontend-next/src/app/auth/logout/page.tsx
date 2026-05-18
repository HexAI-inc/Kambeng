"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { AppSpin } from "@/components/ui";
import { logoutSession } from "@/lib/api";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    logoutSession().finally(() => {
      router.replace("/auth/login");
    });
  }, [router]);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <AppSpin size="large" />
    </main>
  );
}
