import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

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

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};