import type { NextRequest } from "next/server";

/**
 * Headers that pass the browser's IP on to the backend for its per-IP rate
 * limits. This server reaches the API from Vercel's shared IPs, so it names the
 * browser's IP and proves it is this server with INTERNAL_PROXY_SECRET (the
 * backend ignores the IP without it).
 *
 * The last X-Forwarded-For entry is the one our own edge added: Vercel replaces
 * the header with the client IP, and nginx appends the connecting IP after
 * anything the client sent.
 */
export function forwardedForHeaders(request: NextRequest): Record<string, string> {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const clientIp = forwardedFor?.split(",").pop()?.trim();
  const secret = process.env.INTERNAL_PROXY_SECRET;
  if (!clientIp || !secret) return {};
  return { "x-kambeng-client-ip": clientIp, "x-kambeng-proxy-secret": secret };
}
