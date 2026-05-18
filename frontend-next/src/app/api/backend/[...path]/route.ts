import { NextRequest, NextResponse } from "next/server";

const BACKEND_API_BASE = process.env.BACKEND_API_BASE_URL ?? "http://127.0.0.1:8001/api";
const ACCESS_COOKIE = "kambeng_access_token";

async function proxy(request: NextRequest, path: string[], method: string) {
  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  const backendUrl = `${BACKEND_API_BASE}/${path.join("/")}${request.nextUrl.search}`;

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  if (token) headers.set("authorization", `Bearer ${token}`);

  let body: BodyInit | undefined;
  if (!["GET", "HEAD"].includes(method)) {
    body = await request.arrayBuffer();
  }

  const backendResponse = await fetch(backendUrl, {
    method,
    headers,
    body,
    cache: "no-store",
  });

  const responseBody = await backendResponse.arrayBuffer();
  const response = new NextResponse(responseBody, { status: backendResponse.status });
  const responseContentType = backendResponse.headers.get("content-type");
  if (responseContentType) {
    response.headers.set("content-type", responseContentType);
  }
  return response;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await params).path, "GET");
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await params).path, "POST");
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await params).path, "PUT");
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await params).path, "PATCH");
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await params).path, "DELETE");
}
