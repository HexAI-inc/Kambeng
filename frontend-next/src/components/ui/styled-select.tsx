"use client";

import { useRef, useEffect, useState } from "react";

type Option = { value: string; label: string };

type StyledSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  style?: React.CSSProperties;
  placeholder?: string;
  disabled?: boolean;
};

const BLUE = "#1dc5ff";

export function StyledSelect({ value, onChange, options, style, placeholder, disabled }: StyledSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false);
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); }
  };

  const current = options.find((o) => o.value === value);
  const displayLabel = current?.label ?? placeholder ?? "";

  return (
    <div ref={ref} style={{ position: "relative", ...style }}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={!disabled ? handleKeyDown : undefined}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          width: "100%",
          padding: "10px 36px 10px 14px",
          borderRadius: 9,
          border: `1px solid ${open ? "rgba(29,197,255,0.35)" : "rgba(255,255,255,0.1)"}`,
          background: open ? "rgba(29,197,255,0.05)" : "rgba(255,255,255,0.04)",
          color: current ? "#f0f6ff" : "#6b7a8d",
          fontSize: 13,
          fontFamily: "inherit",
          textAlign: "left",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
          outline: "none",
          transition: "border-color 0.15s, background 0.15s",
          userSelect: "none",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {displayLabel}
      </button>

      {/* Chevron */}
      <svg
        width="14" height="14" viewBox="0 0 14 14" fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{
          position: "absolute", right: 12, top: "50%",
          transform: `translateY(-50%) rotate(${open ? "180deg" : "0deg"})`,
          transition: "transform 0.2s",
          pointerEvents: "none",
        }}
      >
        <path d="M2.5 5L7 9.5L11.5 5" stroke="#6b7a8d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            minWidth: "100%",
            background: "#0d1120",
            border: "1px solid rgba(29,197,255,0.2)",
            borderRadius: 10,
            boxShadow: "0 16px 40px rgba(0,0,0,0.65)",
            zIndex: 100,
            overflow: "hidden",
          }}
        >
          {options.map((opt, i) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "10px 14px",
                  textAlign: "left",
                  fontSize: 13,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  background: isSelected ? "rgba(29,197,255,0.08)" : "transparent",
                  color: isSelected ? BLUE : "#d0d8e8",
                  border: "none",
                  borderBottom: i < options.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = isSelected ? "rgba(29,197,255,0.08)" : "transparent";
                }}
              >
                <svg
                  width="12" height="12" viewBox="0 0 12 12" fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                  style={{ flexShrink: 0, opacity: isSelected ? 1 : 0 }}
                >
                  <path d="M2 6L5 9L10 3" stroke="#1dc5ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
