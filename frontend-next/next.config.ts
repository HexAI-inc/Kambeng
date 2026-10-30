import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = dirname(fileURLToPath(import.meta.url));

function buildRemotePattern(baseUrl: string): URL {
  const url = new URL(baseUrl);
  url.pathname = "/**";

  return url;
}

const backendPublicUrl = process.env.BACKEND_PUBLIC_URL ?? "http://127.0.0.1:8001";
const doSpacesEndpoint = process.env.DO_SPACES_ENDPOINT ?? "https://lon1.digitaloceanspaces.com";

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Script/style sources are not restricted yet (antd injects inline styles); this blocks framing and plugins.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactCompiler: true,
  images: {
    remotePatterns: [
      buildRemotePattern(backendPublicUrl),
      buildRemotePattern(doSpacesEndpoint),
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "8001",
        pathname: "/uploads/**",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "8001",
        pathname: "/media/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "8001",
        pathname: "/uploads/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "8001",
        pathname: "/media/**",
      },
    ],
  },
  turbopack: {
    root: appRoot,
  },
  // Custom profile URLs: kambeng.gm/@awa renders /profiles/awa, which looks the handle up.
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async rewrites() {
    return [{ source: "/@:handle", destination: "/profiles/:handle" }];
  },
};

export default nextConfig;
