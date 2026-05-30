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

const nextConfig: NextConfig = {
  /* config options here */
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
};

export default nextConfig;
