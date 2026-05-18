import { NextRequest, NextResponse } from "next/server";

const BACKEND_API_BASE = process.env.BACKEND_API_BASE_URL ?? "http://127.0.0.1:8001/api";
const ACCESS_COOKIE = "kambeng_access_token";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const backendResponse = await fetch(`${BACKEND_API_BASE}/auth/me`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const text = await backendResponse.text();
  return new NextResponse(text, {
    status: backendResponse.status,
    headers: { "content-type": backendResponse.headers.get("content-type") ?? "application/json" },
  });
}
