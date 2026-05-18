import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const BACKEND_API_BASE = process.env.BACKEND_API_BASE_URL ?? "http://127.0.0.1:8001/api";
const REFRESH_COOKIE = "kambeng_refresh_token";
const ACCESS_COOKIE = "kambeng_access_token";

function isSecureRequest(request: NextRequest): boolean {
  return request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { detail: "No refresh token found" },
        { status: 401 }
      );
    }

    // Call backend refresh endpoint
    const response = await fetch(`${BACKEND_API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { detail: "Failed to refresh token" },
        { status: response.status }
      );
    }

    const payload = (await response.json()) as {
      accessToken?: string;
      expiresIn?: number;
      refreshToken?: string;
      data?: {
        tokens?: {
          accessToken?: string;
          expiresIn?: number;
          refreshToken?: string;
        };
      };
    };

    const accessToken = payload.accessToken ?? payload.data?.tokens?.accessToken;
    const expiresIn = payload.expiresIn ?? payload.data?.tokens?.expiresIn ?? 3600;
    const nextRefreshToken = payload.refreshToken ?? payload.data?.tokens?.refreshToken;

    if (!accessToken) {
      return NextResponse.json(
        { detail: "Backend refresh succeeded but missing access token" },
        { status: 502 }
      );
    }

    // Set new access token (httpOnly, 1-hour expiry)
    const result = NextResponse.json({ success: true });
    result.cookies.set(ACCESS_COOKIE, accessToken, {
      httpOnly: true,
      secure: isSecureRequest(request),
      sameSite: "lax",
      maxAge: expiresIn,
      path: "/",
    });

    // Optionally update refresh token if backend sent a new one
    if (nextRefreshToken && nextRefreshToken !== refreshToken) {
      result.cookies.set(REFRESH_COOKIE, nextRefreshToken, {
        httpOnly: true,
        secure: isSecureRequest(request),
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60, // 7 days
        path: "/",
      });
    }

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Token refresh failed";
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
