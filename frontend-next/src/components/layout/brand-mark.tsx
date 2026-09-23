import { useId } from "react";

export function BrandMark({ size = 36 }: { size?: number }) {
  const gradientId = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ flexShrink: 0, filter: "drop-shadow(0 3px 6px rgba(20,120,74,0.25))" }}>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1a8a55" />
          <stop offset="100%" stopColor="#0f5e3a" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="240" height="240" rx="54" fill={`url(#${gradientId})`} />
      <g stroke="#FBF7F0" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M84,64 L84,176" />
        <path d="M84,122 L162,64" />
        <path d="M84,122 L162,176" />
      </g>
      <circle cx="192" cy="124" r="14" fill="#f08a2c" />
    </svg>
  );
}
