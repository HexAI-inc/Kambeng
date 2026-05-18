import { NextRequest, NextResponse } from "next/server";

const ACCESS_COOKIE = "kambeng_access_token";
const REFRESH_COOKIE = "kambeng_refresh_token";

function isSecureRequest(request: NextRequest): boolean {
  return request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
}

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ status: "success" });
  response.cookies.set(ACCESS_COOKIE, "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "lax", secure: isSecureRequest(request) });
  response.cookies.set(REFRESH_COOKIE, "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "lax", secure: isSecureRequest(request) });
  return response;
}
