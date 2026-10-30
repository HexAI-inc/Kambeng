"use client";

import { useState } from "react";
import Link from "next/link";
import { humanize } from "@/lib/fmt";

/**
 * Building blocks for the admin one-page overviews (campaign, user): a sticky
 * section index, sections, stat tiles, key/value lists, status chips and
 * tables that become stacked cards on phones.
 */

const INK = "#15201a";
const MUTED = "#626d66";
const FAINT = "#6e7872";
const GREEN = "#14784a";
const RED = "#c0392b";
const AMBER = "#b9500b";

export type Tone = "green" | "red" | "amber" | "neutral" | "blue";

const TONES: Record<Tone, { color: string; bg: string }> = {
  green: { color: GREEN, bg: "rgba(20,120,74,0.1)" },
  red: { color: RED, bg: "rgba(192,57,43,0.1)" },
  amber: { color: AMBER, bg: "rgba(232,101,15,0.12)" },
  blue: { color: "#3f63b8", bg: "rgba(90,127,214,0.12)" },
  neutral: { color: "#56625b", bg: "rgba(21,32,26,0.06)" },
};

/** Colour a status word consistently across donations, payouts, KYC, campaigns. */
export function statusTone(status?: string | null): Tone {
  switch ((status ?? "").toUpperCase()) {
    case "SUCCEEDED": case "APPROVED": case "ACTIVE": case "COMPLETED": case "ACCEPTED": case "VERIFIED": case "RESOLVED":
      return "green";
    case "FAILED": case "REJECTED": case "SUSPENDED": case "REVERSED": case "CANCELLED":
      return "red";
    case "PENDING": case "SUBMITTED": case "REVIEWING": case "OPEN": case "NEW": case "INVITED":
      return "amber";
    default:
      return "neutral";
  }
}

export function Chip({ children, tone = "neutral", title }: { children: React.ReactNode; tone?: Tone; title?: string }) {
  const t = TONES[tone];
  return (
    <span title={title} className="ov-chip" style={{ color: t.color, background: t.bg }}>
      {children}
    </span>
  );
}

export function StatusChip({ status }: { status?: string | null }) {
  return <Chip tone={statusTone(status)}>{humanize(status ?? "—")}</Chip>;
}

export function fmtDateTime(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function money(value?: number | null): string {
  if (value == null) return "—";
  return `${Math.round(value).toLocaleString("en-GB")} GMD`;
}

export function OverviewShell({
  backHref, backLabel, kicker, title, subtitle, chips, actions, sections, children,
}: {
  backHref: string;
  backLabel: string;
  kicker: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  chips?: React.ReactNode;
  actions?: React.ReactNode;
  sections: { id: string; label: string; count?: number }[];
  children: React.ReactNode;
}) {
  return (
    <div className="ov-root">
      <div className="ov-wrap">
        <Link href={backHref} className="ov-back">← {backLabel}</Link>
        <header className="ov-header">
          <div style={{ minWidth: 0 }}>
            <div className="ov-kicker">{kicker}</div>
            <h1 className="ov-title">{title}</h1>
            {subtitle && <div className="ov-subtitle">{subtitle}</div>}
            {chips && <div className="ov-chips">{chips}</div>}
          </div>
          {actions && <div className="ov-actions">{actions}</div>}
        </header>
        <nav className="ov-index" aria-label="Sections">
          {sections.map((s) => (
            <a key={s.id} href={`#${s.id}`}>
              {s.label}{s.count != null && <span>{s.count}</span>}
            </a>
          ))}
        </nav>
        {children}
      </div>
      <style>{CSS}</style>
    </div>
  );
}

export function Section({ id, title, sub, action, children }: { id: string; title: string; sub?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="ov-card ov-section">
      <div className="ov-section-head">
        <div>
          <h2>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Stats({ children }: { children: React.ReactNode }) {
  return <div className="ov-stats">{children}</div>;
}

export function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: Tone }) {
  return (
    <div className="ov-stat">
      <div className="ov-eyebrow">{label}</div>
      <div className="ov-stat-value" style={tone ? { color: TONES[tone].color } : undefined}>{value}</div>
      {sub && <div className="ov-stat-sub">{sub}</div>}
    </div>
  );
}

export function KeyValues({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="ov-kv">
      {rows.map(([k, v]) => (
        <div key={k}><dt>{k}</dt><dd>{v ?? "—"}</dd></div>
      ))}
    </dl>
  );
}

export type Column<T> = { key: string; label: string; render: (row: T) => React.ReactNode; align?: "right"; width?: string };

export function DataTable<T>({
  columns, rows, rowKey, empty = "Nothing yet", initial = 10,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  empty?: string;
  initial?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  if (rows.length === 0) return <div className="ov-empty">{empty}</div>;
  const visible = showAll ? rows : rows.slice(0, initial);
  const template = columns.map((c) => c.width ?? "minmax(0, 1fr)").join(" ");
  return (
    <div className="ov-table">
      <div className="ov-thead" style={{ gridTemplateColumns: template }}>
        {columns.map((c) => <div key={c.key} style={c.align ? { textAlign: c.align } : undefined}>{c.label}</div>)}
      </div>
      {visible.map((row) => (
        <div key={rowKey(row)} className="ov-tr" style={{ gridTemplateColumns: template }}>
          {columns.map((c) => (
            <div key={c.key} data-label={c.label} className={c.align === "right" ? "ov-num" : undefined}>{c.render(row)}</div>
          ))}
        </div>
      ))}
      {rows.length > initial && (
        <button type="button" className="ov-more" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Show fewer" : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  );
}

export function AuditTrail({ entries }: { entries: { id: number; action_type: string; description: string; details: string | null; old_value: string | null; new_value: string | null; performed_by: string | null; created_at: string }[] }) {
  if (entries.length === 0) return <div className="ov-empty">No admin actions recorded</div>;
  return (
    <ol className="ov-timeline">
      {entries.map((e) => (
        <li key={e.id}>
          <div className="ov-timeline-head">
            <Chip>{humanize(e.action_type)}</Chip>
            <span className="ov-faint">{fmtDateTime(e.created_at)}{e.performed_by ? ` · ${e.performed_by}` : ""}</span>
          </div>
          <div className="ov-timeline-body">{e.description}</div>
          {(e.old_value || e.new_value) && <div className="ov-faint">{e.old_value ?? "—"} → {e.new_value ?? "—"}</div>}
          {e.details && <div className="ov-faint">{e.details}</div>}
        </li>
      ))}
    </ol>
  );
}

export const linkStyle: React.CSSProperties = { color: GREEN, fontWeight: 700, textDecoration: "none" };

const CSS = `
.ov-root { min-height: 100vh; padding: 24px clamp(16px, 4vw, 40px) 64px; }
.ov-wrap { max-width: 1180px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
.ov-back { font-size: 13px; color: ${MUTED}; text-decoration: none; font-weight: 600; align-self: flex-start; }
.ov-back:hover { color: ${GREEN}; }
.ov-header { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
.ov-kicker { font-size: 11px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: ${AMBER}; }
.ov-title { font-family: var(--font-display); font-size: clamp(22px, 3vw, 30px); font-weight: 900; letter-spacing: -0.03em; color: ${INK}; margin: 4px 0; line-height: 1.15; overflow-wrap: anywhere; }
.ov-subtitle { font-size: 13px; color: ${MUTED}; }
.ov-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
.ov-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.ov-index { position: sticky; top: 0; z-index: 5; display: flex; gap: 6px; overflow-x: auto; padding: 10px 0; background: var(--bg, #f6f4ef); scrollbar-width: none; }
.ov-index a { flex: none; font-size: 12px; font-weight: 700; color: ${MUTED}; text-decoration: none; padding: 6px 12px; border-radius: 999px; background: #fff; border: 1px solid rgba(21,32,26,0.08); }
.ov-index a:hover { color: ${GREEN}; border-color: rgba(20,120,74,0.3); }
.ov-index a span { margin-left: 6px; color: ${FAINT}; font-weight: 600; }
.ov-card { background: #fff; border: 1px solid rgba(21,32,26,0.07); border-radius: 14px; }
.ov-section { padding: 20px; scroll-margin-top: 64px; min-width: 0; }
.ov-section-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
.ov-section-head h2 { font-size: 15px; font-weight: 800; color: ${INK}; margin: 0; }
.ov-section-head p { font-size: 12px; color: ${FAINT}; margin: 3px 0 0; }
.ov-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.ov-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
.ov-stat { padding: 12px 14px; border-radius: 10px; background: #faf9f6; border: 1px solid rgba(21,32,26,0.05); min-width: 0; }
.ov-eyebrow { font-size: 10px; font-weight: 700; color: ${FAINT}; text-transform: uppercase; letter-spacing: 0.07em; }
.ov-stat-value { font-size: 19px; font-weight: 800; color: ${INK}; letter-spacing: -0.02em; margin-top: 3px; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.ov-stat-sub { font-size: 11px; color: ${MUTED}; margin-top: 2px; }
.ov-kv { margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); column-gap: 24px; }
.ov-kv > div { display: flex; justify-content: space-between; gap: 12px; padding: 9px 0; border-bottom: 1px solid rgba(21,32,26,0.05); font-size: 13px; min-width: 0; }
.ov-kv dt { color: ${MUTED}; flex: none; }
.ov-kv dd { margin: 0; color: ${INK}; font-weight: 600; text-align: right; overflow-wrap: anywhere; min-width: 0; }
.ov-chip { display: inline-flex; align-items: center; font-size: 10px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; padding: 3px 9px; border-radius: 999px; white-space: nowrap; }
.ov-table { font-size: 13px; }
.ov-thead, .ov-tr { display: grid; gap: 12px; align-items: center; }
.ov-thead { font-size: 10px; font-weight: 700; color: ${FAINT}; text-transform: uppercase; letter-spacing: 0.06em; padding: 0 4px 8px; border-bottom: 1px solid rgba(21,32,26,0.08); }
.ov-tr { padding: 10px 4px; border-bottom: 1px solid rgba(21,32,26,0.05); color: ${MUTED}; }
.ov-tr > div { min-width: 0; overflow-wrap: anywhere; }
.ov-num { text-align: right; font-variant-numeric: tabular-nums; color: ${INK}; font-weight: 600; }
.ov-strong { color: ${INK}; font-weight: 700; }
.ov-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
.ov-faint { font-size: 12px; color: ${FAINT}; }
.ov-more { margin-top: 10px; border: 1px solid rgba(21,32,26,0.1); background: #fff; color: ${INK}; font-size: 12px; font-weight: 700; padding: 7px 14px; border-radius: 8px; cursor: pointer; }
.ov-empty { font-size: 13px; color: ${FAINT}; padding: 8px 0; }
.ov-alert { padding: 12px 14px; border-radius: 10px; font-size: 13px; font-weight: 600; }
.ov-btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 14px; border-radius: 9px; font-size: 12px; font-weight: 700; cursor: pointer; text-decoration: none; border: 1px solid rgba(21,32,26,0.12); background: #fff; color: ${INK}; }
.ov-btn-primary { background: ${GREEN}; border-color: ${GREEN}; color: #fff; }
.ov-btn-danger { color: ${RED}; border-color: rgba(192,57,43,0.3); background: #fff; }
.ov-timeline { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.ov-timeline li { padding-left: 14px; border-left: 2px solid rgba(20,120,74,0.2); display: flex; flex-direction: column; gap: 3px; }
.ov-timeline-head { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.ov-timeline-body { font-size: 13px; color: ${INK}; }
.ov-progress { height: 8px; background: rgba(21,32,26,0.07); border-radius: 4px; overflow: hidden; }
.ov-progress > div { height: 100%; background: ${GREEN}; border-radius: 4px; }
@media (max-width: 860px) {
  .ov-grid-2 { grid-template-columns: 1fr; }
}
@media (max-width: 720px) {
  .ov-thead { display: none; }
  .ov-tr { display: flex; flex-direction: column; align-items: stretch; gap: 4px; padding: 12px 0; }
  .ov-tr > div { display: flex; justify-content: space-between; gap: 12px; text-align: right; }
  .ov-tr > div::before { content: attr(data-label); color: ${FAINT}; font-size: 11px; font-weight: 600; text-align: left; flex: none; }
  .ov-num { text-align: right; }
}
`;
