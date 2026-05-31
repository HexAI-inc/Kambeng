import { NextRequest, NextResponse } from "next/server";

const BACKEND_API_BASE = process.env.BACKEND_API_BASE_URL ?? "http://127.0.0.1:8001/api";
const APP_BASE_URL = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://kambeng.hexai.gm";
const ACCESS_COOKIE = "kambeng_access_token";
const REFRESH_COOKIE = "kambeng_refresh_token";

function isSecureRequest(request: NextRequest): boolean {
  return request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    const isJson = contentType.includes("application/json");
    const isForm = contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data");

    let username = "";
    let password = "";
    let nextTarget = "/dashboard";

    if (isJson) {
      const body = (await request.json()) as { username?: string; password?: string; next?: string };
      username = body.username?.trim() ?? "";
      password = body.password ?? "";
      nextTarget = body.next?.trim() || nextTarget;
    } else if (isForm) {
      const formData = await request.formData();
      username = String(formData.get("username") ?? "").trim();
      password = String(formData.get("password") ?? "");
      nextTarget = String(formData.get("next") ?? "").trim() || nextTarget;
    } else {
      return NextResponse.json({ detail: "Unsupported login request" }, { status: 415 });
    }

    if (!username || !password) {
      if (isJson) {
        return NextResponse.json({ detail: "username and password are required" }, { status: 400 });
      }
      const errorUrl = new URL("/auth/login", APP_BASE_URL);
      errorUrl.searchParams.set("error", "username and password are required");
      if (nextTarget) {
        errorUrl.searchParams.set("next", nextTarget);
      }
      return NextResponse.redirect(errorUrl);
    }

    // Backend expects `username` + `password` and accepts wave number or email.
    const payloadBody: Record<string, string> = {
      username,
      password,
    };

    const backendResponse = await fetch(`${BACKEND_API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadBody),
      cache: "no-store",
    });

    const payload = await backendResponse.json();
    if (!backendResponse.ok) {
      if (isJson) {
        return NextResponse.json(payload, { status: backendResponse.status });
      }

      const errorUrl = new URL("/auth/login", APP_BASE_URL);
      errorUrl.searchParams.set("error", payload?.detail ?? "Login failed");
      if (nextTarget) {
        errorUrl.searchParams.set("next", nextTarget);
      }
      return NextResponse.redirect(errorUrl);
    }

    // Support both repository-style envelope (`data.tokens.accessToken`) and
    // running backend snake_case (`access_token`, `refresh_token`, `expires_in`).
    const accessToken = (payload?.data?.tokens?.accessToken as string | undefined)
      || (payload?.access_token as string | undefined)
      || (payload?.data?.access_token as string | undefined);

    const refreshToken = (payload?.data?.tokens?.refreshToken as string | undefined)
      || (payload?.refresh_token as string | undefined)
      || (payload?.data?.refresh_token as string | undefined);

    const expiresIn = Number(
      payload?.data?.tokens?.expiresIn ?? payload?.expires_in ?? payload?.data?.expires_in ?? 86400
    );

    if (!accessToken) {
      return NextResponse.json({ detail: "Login succeeded but missing access token" }, { status: 502 });
    }

    if (!isJson) {
      const response = NextResponse.redirect(new URL(nextTarget, APP_BASE_URL));

      response.cookies.set({
        name: ACCESS_COOKIE,
        value: accessToken,
        httpOnly: true,
        sameSite: "lax",
        secure: isSecureRequest(request),
        maxAge: expiresIn,
        path: "/",
      });

      if (refreshToken) {
        response.cookies.set({
          name: REFRESH_COOKIE,
          value: refreshToken,
          httpOnly: true,
          sameSite: "lax",
          secure: isSecureRequest(request),
          maxAge: 60 * 60 * 24 * 7,
          path: "/",
        });
      }

      return response;
    }

    const response = NextResponse.json({ status: "success", user: payload?.data?.user ?? null });

    response.cookies.set({
      name: ACCESS_COOKIE,
      value: accessToken,
      httpOnly: true,
      sameSite: "lax",
      secure: isSecureRequest(request),
      maxAge: expiresIn,
      path: "/",
    });

    if (refreshToken) {
      response.cookies.set({
        name: REFRESH_COOKIE,
        value: refreshToken,
        httpOnly: true,
        sameSite: "lax",
        secure: isSecureRequest(request),
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });
    }

    return response;
  } catch {
    return NextResponse.json({ detail: "Invalid login request" }, { status: 400 });
  }
}
