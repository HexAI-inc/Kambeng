"use client";

import { useState } from "react";

const BLUE = "#14784a";

export function initialsOf(name?: string | null) {
  return (name ?? "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
}

/** Round profile photo with an initials fallback (no photo, or it failed to load). */
export function UserAvatar({ name, src, size = 40, ring = 2 }: { name?: string | null; src?: string | null; size?: number; ring?: number }) {
  const [broken, setBroken] = useState<string | null>(null);
  const base: React.CSSProperties = {
    width: size, height: size, borderRadius: "50%", flexShrink: 0,
    border: `${ring}px solid rgba(20,120,74,0.35)`, boxSizing: "border-box",
  };

  if (src && broken !== src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" width={size} height={size} onError={() => setBroken(src)} style={{ ...base, objectFit: "cover", background: "#fff" }} />
    );
  }
  return (
    <div style={{
      ...base, background: "linear-gradient(135deg, #e6f4ec, #cfe8da)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: Math.round(size * 0.36), fontWeight: 800, color: BLUE,
    }}>
      {initialsOf(name)}
    </div>
  );
}
