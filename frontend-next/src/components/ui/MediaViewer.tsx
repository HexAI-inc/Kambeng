"use client";
import { useEffect } from "react";

export default function MediaViewer({ src, type, onClose }: { src: string | null; type?: string | null; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!src) return null;

  const isImage = !type || type.startsWith("image/");
  const isPdf = type === "application/pdf" || src?.toLowerCase().endsWith(".pdf");

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div style={{ maxWidth: "92%", maxHeight: "92%", width: "min(1100px, 96%)", background: "#0d1120", borderRadius: 12, padding: 12, boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#f0f6ff", fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "calc(100% - 40px)" }}>
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src ?? ""} alt="media" style={{ maxWidth: "100%", maxHeight: "80vh", borderRadius: 8 }} />
          ) : isPdf ? (
            <iframe src={src ?? ""} style={{ width: "100%", height: "80vh", border: "none", borderRadius: 8 }} />
          ) : (
            <a href={src ?? ""} target="_blank" rel="noopener noreferrer" style={{ color: "#1dc5ff" }}>Open file</a>
          )}
        </div>
      </div>
    </div>
  );
}
