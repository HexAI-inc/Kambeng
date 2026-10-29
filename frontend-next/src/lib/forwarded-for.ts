import type { NextRequest } from "next/server";

/**
 * Headers that pass the browser's IP on to the backend. The Next server calls the
 * API from 127.0.0.1, which the backend trusts as a proxy; without this every
 * user would share one rate-limit bucket.
 */
export function forwardedForHeaders(request: NextRequest): Record<string, string> {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor ? { "x-forwarded-for": forwardedFor } : {};
}
