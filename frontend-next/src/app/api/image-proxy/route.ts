import { type NextRequest, NextResponse } from "next/server";

const BUCKET = "hexaistorage";
const REGION_HOST = "lon1.digitaloceanspaces.com";

// Our bucket only, in either Spaces URL style: virtual-hosted (incl. CDN) or path-style.
function isOurBucket(url: URL): boolean {
  if (url.protocol !== "https:") return false;
  if (url.hostname === `${BUCKET}.${REGION_HOST}` || url.hostname === `${BUCKET}.lon1.cdn.digitaloceanspaces.com`) return true;
  return url.hostname === REGION_HOST && url.pathname.startsWith(`/${BUCKET}/`);
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");

  if (!url) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new NextResponse("Invalid url", { status: 400 });
  }

  // Only proxy images from our own DO Spaces bucket — prevents SSRF
  if (!isOurBucket(parsed)) {
    return new NextResponse("URL not allowed", { status: 403 });
  }

  try {
    const upstream = await fetch(parsed, {
      headers: { Accept: "image/*" },
      redirect: "error",
      next: { revalidate: 3600 },
    });

    if (!upstream.ok) {
      return new NextResponse("Upstream fetch failed", { status: upstream.status });
    }

    // Anything served from our origin must be an image; never relay HTML or SVG (script-capable).
    const contentType = upstream.headers.get("content-type") ?? "";
    if (!/^image\/(jpeg|png|webp|gif|avif)$/i.test(contentType.split(";")[0].trim())) {
      return new NextResponse("Unsupported content type", { status: 415 });
    }
    const buffer = await upstream.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, immutable",
        "Access-Control-Allow-Origin": "*",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Failed to fetch image", { status: 500 });
  }
}
