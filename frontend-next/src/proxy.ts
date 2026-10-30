import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { buildContentSecurityPolicy } from "@/lib/csp";

const ACCESS_COOKIE = "kambeng_access_token";

export function proxy(request: NextRequest) {
  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  const { pathname, search } = request.nextUrl;

  const needsAuth = pathname.startsWith("/dashboard") || pathname.startsWith("/admin");
  if (needsAuth && !token) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  // A fresh nonce per page view. Next reads it from the request's CSP header
  // and stamps it on its scripts while rendering (pages render per request —
  // see app/layout.tsx).
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildContentSecurityPolicy(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Pages only: not API routes, build assets, optimized images or files in public/.
    "/((?!api/|_next/static|_next/image|.*\\.(?:png|jpe?g|gif|svg|ico|webp|avif|mp4|webm|txt|xml|webmanifest)$).*)",
  ],
};
