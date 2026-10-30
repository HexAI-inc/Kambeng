/**
 * Content-Security-Policy for every page, built per request in src/proxy.ts.
 *
 * Scripts: only those carrying this request's nonce (Next applies it to its own
 * scripts), plus whatever they load ('strict-dynamic'). An injected <script>
 * or inline handler can't run.
 * Styles: 'unsafe-inline' stays — antd injects <style> tags at runtime and the
 * UI uses style attributes throughout, which nonces can't cover.
 */

const isDev = process.env.NODE_ENV === "development";
// Vercel's preview toolbar loads from vercel.live; production never shows it.
const isVercelPreview = process.env.VERCEL_ENV === "preview";

function origin(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

// Where campaign photos, videos, proofs and KYC documents are served from:
// the API's /uploads and the DigitalOcean Space (direct and CDN, virtual-host
// and path-style).
const mediaSources = [
  "https://api.kambeng.hexai.gm",
  "https://hexaistorage.lon1.digitaloceanspaces.com",
  "https://hexaistorage.lon1.cdn.digitaloceanspaces.com",
  "https://lon1.digitaloceanspaces.com",
  origin(process.env.BACKEND_PUBLIC_URL),
  ...(isDev ? ["http://127.0.0.1:8001", "http://localhost:8001"] : []),
].filter((source, index, all): source is string => Boolean(source) && all.indexOf(source) === index);

const preview = (...sources: string[]) => (isVercelPreview ? sources : []);

export function buildContentSecurityPolicy(nonce: string): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(isDev ? ["'unsafe-eval'"] : []), ...preview("https://vercel.live")],
    "style-src": ["'self'", "'unsafe-inline'", ...preview("https://vercel.live")],
    "img-src": ["'self'", "data:", "blob:", ...mediaSources, ...preview("https://vercel.live", "https://vercel.com")],
    "media-src": ["'self'", "blob:", ...mediaSources],
    "font-src": ["'self'", ...preview("https://vercel.live", "https://assets.vercel.com")],
    "connect-src": ["'self'", ...preview("https://vercel.live", "wss://ws-us3.pusher.com")],
    // Proofs and verification documents open in an in-page viewer.
    "frame-src": ["'self'", "blob:", ...mediaSources, ...preview("https://vercel.live")],
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
  if (!isDev) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}
