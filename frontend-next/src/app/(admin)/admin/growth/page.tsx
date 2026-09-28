"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { PrinterOutlined, ArrowUpOutlined, ArrowDownOutlined } from "@ant-design/icons";
import { useAdminGrowthMetrics } from "@/hooks/use-frontend-data";
import { fmtCompact, fmtDate, fmtGMD, fmtGMDShort, humanize } from "@/lib/fmt";
import type { GrowthMetrics, GrowthTrend } from "@/types/frontend";

// Chart palette — validated (light surface): brand green + blue pass CVD and
// contrast checks as a two-series pair. Orange stays a highlight, never a series.
const INK = "#15201a";
const MUTED = "#626d66";
const FAINT = "#6e7872";
const GREEN = "#14784a";
const BLUE = "#5a7fd6";
const PARTIAL = "rgba(20,120,74,0.35)";
const GRID = "rgba(21,32,26,0.06)";
const UP = "#14784a";
const DOWN = "#c0392b";

const WINDOWS = [6, 12, 24] as const;

function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, delay, ease: "easeOut" as const },
  };
}

function monthLabel(key: string, withYear = false) {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", {
    month: "short", year: withYear ? "numeric" : "2-digit", timeZone: "UTC",
  });
}

// humanize() title-cases everything; keep acronyms readable.
const orgTypeLabel = (t: string) => (t === "NGO" ? "NGO" : humanize(t));

const pct = (n: number | null | undefined, digits = 1) => (n == null ? "—" : `${n.toFixed(digits)}%`);

// ── Pieces ──────────────────────────────────────────────────────────────────
function Delta({ trend, label }: { trend: GrowthTrend; label: string }) {
  if (trend.growth_pct == null) {
    return <span className="gr-delta gr-delta-flat">No prior month to compare</span>;
  }
  const up = trend.growth_pct >= 0;
  return (
    <span className="gr-delta" style={{ color: up ? UP : DOWN }}>
      {up ? <ArrowUpOutlined /> : <ArrowDownOutlined />} {Math.abs(trend.growth_pct).toFixed(1)}%
      <span className="gr-delta-note"> {label}</span>
    </span>
  );
}

function HeroStat({ label, value, sub, children }: { label: string; value: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="gr-card gr-hero">
      <div className="gr-eyebrow">{label}</div>
      <div className="gr-hero-value">{value}</div>
      {children}
      {sub && <div className="gr-sub">{sub}</div>}
    </div>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="gr-card gr-mini">
      <div className="gr-eyebrow">{label}</div>
      <div className="gr-mini-value">{value}</div>
      {sub && <div className="gr-sub">{sub}</div>}
    </div>
  );
}

function Panel({ title, sub, children, className }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`gr-card gr-panel ${className ?? ""}`}>
      <h3 className="gr-panel-title">{title}</h3>
      {sub && <p className="gr-panel-sub">{sub}</p>}
      {children}
    </section>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="gr-legend">
      {items.map((i) => (
        <span key={i.label}><i style={{ background: i.color }} />{i.label}</span>
      ))}
    </div>
  );
}

type TipItem = { dataKey: string; name: string; value: number; color: string; payload: { month?: string; is_partial?: boolean } };
function ChartTip({ active, payload, money }: { active?: boolean; payload?: TipItem[]; money?: boolean }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="gr-tip">
      {row.month && <div className="gr-tip-head">{monthLabel(row.month, true)}{row.is_partial ? " · so far" : ""}</div>}
      {payload.map((p) => (
        <div key={p.dataKey} className="gr-tip-row">
          <i style={{ background: p.color }} />{p.name}
          <b>{money ? fmtGMD(p.value) : p.value.toLocaleString("en-GB")}</b>
        </div>
      ))}
    </div>
  );
}

function HBar({ label, value, max, display, note }: { label: string; value: number; max: number; display: string; note?: string }) {
  const width = max > 0 ? Math.max((value / max) * 100, value > 0 ? 1.5 : 0) : 0;
  return (
    <div className="gr-hbar">
      <div className="gr-hbar-top">
        <span className="gr-hbar-label">{label}</span>
        <span className="gr-hbar-value">{display}{note && <span className="gr-hbar-note"> {note}</span>}</span>
      </div>
      <div className="gr-hbar-track"><div className="gr-hbar-fill" style={{ width: `${width}%` }} /></div>
    </div>
  );
}

function StatList({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="gr-statlist">
      {rows.map(([k, v]) => (
        <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
      ))}
    </dl>
  );
}

// Sequential single-hue ramp for the cohort grid: white → brand green.
function cohortCell(v: number | null) {
  if (v == null) return { background: "transparent", color: FAINT };
  const a = 0.08 + Math.min(v, 100) / 100 * 0.82;
  return { background: `rgba(20,120,74,${a.toFixed(2)})`, color: a > 0.5 ? "#ffffff" : INK };
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function GrowthReportPage() {
  const [months, setMonths] = useState<number>(12);
  const { data, isLoading, isError } = useAdminGrowthMetrics(months);

  return (
    <div className="gr-root">
      <div className="gr-wrap">
        <motion.header {...fadeUp(0)} className="gr-header">
          <div>
            <div className="gr-kicker">Kambeng · Traction report</div>
            <h1 className="gr-title">How Kambeng is growing</h1>
            <p className="gr-lede">
              {data
                ? <>Generated {fmtDate(data.generated_at)} · all amounts in Gambian dalasi (GMD) · growth compares the last complete month with the one before</>
                : "Growth, money movement and trust metrics across the platform"}
            </p>
          </div>
          <div className="gr-controls no-print">
            <div className="gr-seg" role="group" aria-label="Chart window">
              {WINDOWS.map((w) => (
                <button key={w} type="button" aria-pressed={months === w} className={months === w ? "on" : ""} onClick={() => setMonths(w)}>
                  {w}M
                </button>
              ))}
            </div>
            <button type="button" className="gr-print" onClick={() => window.print()}>
              <PrinterOutlined /> Export PDF
            </button>
          </div>
        </motion.header>

        {isLoading && <div className="gr-card gr-state">Crunching the numbers…</div>}
        {isError && <div className="gr-card gr-state">Couldn&apos;t load the report. Try again in a moment.</div>}
        {data && <Report data={data} />}
      </div>
      <style>{CSS}</style>
    </div>
  );
}

function Report({ data }: { data: GrowthMetrics }) {
  const h = data.headline;
  const t = data.trends;
  const lastFull = data.monthly.filter((m) => !m.is_partial).at(-1)?.month;
  const vs = lastFull ? `in ${monthLabel(lastFull)} vs prior month` : "vs prior month";

  const monthly = data.monthly.map((m) => ({
    ...m,
    label: monthLabel(m.month),
    returning_donors: Math.max(m.unique_donors - m.new_donors, 0),
  }));
  const funnelMax = data.funnel[0]?.count ?? 0;
  const catMax = Math.max(...data.categories.map((c) => c.gmv), 0);
  const bandMax = Math.max(...data.gift_bands.map((b) => b.count), 0);
  const orgMax = Math.max(...data.organizations.by_type.map((o) => o.count), 0);

  const axis = { tick: { fill: FAINT, fontSize: 10 }, axisLine: false, tickLine: false } as const;

  return (
    <>
      {/* Headline */}
      <motion.div {...fadeUp(0.05)} className="gr-grid-4">
        <HeroStat label="Total processed" value={fmtGMDShort(h.gmv_total)} sub={`${h.donations_count.toLocaleString("en-GB")} successful donations`}>
          <Delta trend={t.gmv} label={vs} />
        </HeroStat>
        <HeroStat label="Revenue earned" value={fmtGMDShort(h.revenue_total)} sub={`Take rate ${pct(h.take_rate_pct, 2)} of volume`}>
          <Delta trend={t.revenue} label={vs} />
        </HeroStat>
        <HeroStat label="Registered users" value={h.total_users.toLocaleString("en-GB")} sub={`${t.new_users.last_month} new last month`}>
          <Delta trend={t.new_users} label={vs} />
        </HeroStat>
        <HeroStat label="Paid out to communities" value={fmtGMDShort(h.paid_out_total)} sub={`${data.trust.payouts_completed} withdrawals completed`} />
      </motion.div>

      <motion.div {...fadeUp(0.09)} className="gr-grid-4">
        <MiniStat label="KYC-verified users" value={pct(h.kyc_rate_pct)} sub={`${h.kyc_approved} of ${h.total_users} users`} />
        <MiniStat label="Unique donors" value={h.unique_donors.toLocaleString("en-GB")} sub={`${pct(h.repeat_donor_rate_pct)} gave more than once`} />
        <MiniStat label="Average gift" value={h.avg_donation != null ? fmtGMD(h.avg_donation) : "—"} sub={h.median_donation != null ? `Median ${fmtGMD(h.median_donation)}` : undefined} />
        <MiniStat label="Recurring giving" value={`${fmtGMD(h.recurring_monthly_committed)}/mo`} sub={`${h.recurring_active_plans} active plans`} />
        <MiniStat label="Payment success" value={pct(h.payment_success_rate_pct)} sub="of settled donation attempts" />
        <MiniStat label="Campaigns funded" value={`${h.campaigns_funded} / ${h.campaigns_total}`} sub={`${pct(data.outcomes.funded_rate_pct)} received a donation`} />
        <MiniStat label="Organizations" value={h.organizations_total.toLocaleString("en-GB")} sub={`${h.organizations_verified} verified`} />
        <MiniStat label="Waitlist" value={h.waitlist_subscribers.toLocaleString("en-GB")} sub="confirmed subscribers" />
      </motion.div>

      {/* Money over time */}
      <motion.div {...fadeUp(0.13)} className="gr-grid-2">
        <Panel
          title="Monthly volume processed"
          sub={t.gmv.cmgr_pct != null ? `Compound monthly growth ${pct(t.gmv.cmgr_pct)} · faded bar = month in progress` : "Faded bar = month in progress"}
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthly} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="label" {...axis} interval="preserveStartEnd" />
              <YAxis {...axis} tickFormatter={(v: number) => fmtCompact(v)} />
              <Tooltip cursor={{ fill: "rgba(21,32,26,0.04)" }} content={<ChartTip money />} />
              <Bar dataKey="gmv" name="Processed" radius={[4, 4, 0, 0]} maxBarSize={28}>
                {monthly.map((m) => <Cell key={m.month} fill={m.is_partial ? PARTIAL : GREEN} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel
          title="Monthly revenue"
          sub={t.revenue.cmgr_pct != null ? `Compound monthly growth ${pct(t.revenue.cmgr_pct)} · D10 commission per organizer withdrawal` : "D10 commission per organizer withdrawal"}
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthly} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="label" {...axis} interval="preserveStartEnd" />
              <YAxis {...axis} tickFormatter={(v: number) => fmtCompact(v)} />
              <Tooltip cursor={{ fill: "rgba(21,32,26,0.04)" }} content={<ChartTip money />} />
              <Bar dataKey="revenue" name="Revenue" radius={[4, 4, 0, 0]} maxBarSize={28}>
                {monthly.map((m) => <Cell key={m.month} fill={m.is_partial ? PARTIAL : GREEN} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </motion.div>

      {/* Users over time */}
      <motion.div {...fadeUp(0.17)} className="gr-grid-2">
        <Panel title="Registered users" sub={t.new_users.cmgr_pct != null ? `Cumulative · signups compound ${pct(t.new_users.cmgr_pct)} a month` : "Cumulative accounts, excluding staff"}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthly} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="label" {...axis} interval="preserveStartEnd" />
              <YAxis {...axis} tickFormatter={(v: number) => fmtCompact(v)} allowDecimals={false} />
              <Tooltip content={<ChartTip />} cursor={{ stroke: "rgba(21,32,26,0.2)" }} />
              <Area type="monotone" dataKey="cumulative_users" name="Users" stroke={GREEN} strokeWidth={2} fill="rgba(20,120,74,0.10)" dot={false} activeDot={{ r: 4, fill: GREEN, stroke: "#fff", strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Signups and KYC approvals" sub="New accounts and identity verifications each month">
          <Legend items={[{ label: "New signups", color: GREEN }, { label: "KYC approved", color: BLUE }]} />
          <ResponsiveContainer width="100%" height={196}>
            <BarChart data={monthly} margin={{ top: 4, right: 4, left: -8, bottom: 0 }} barGap={2}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="label" {...axis} interval="preserveStartEnd" />
              <YAxis {...axis} allowDecimals={false} />
              <Tooltip cursor={{ fill: "rgba(21,32,26,0.04)" }} content={<ChartTip />} />
              <Bar dataKey="new_users" name="New signups" fill={GREEN} radius={[4, 4, 0, 0]} maxBarSize={16} />
              <Bar dataKey="kyc_approved" name="KYC approved" fill={BLUE} radius={[4, 4, 0, 0]} maxBarSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </motion.div>

      {/* Donors + funnel */}
      <motion.div {...fadeUp(0.21)} className="gr-grid-2">
        <Panel title="Active donors per month" sub="Identified donors (account or email) who gave that month">
          <Legend items={[{ label: "Returning", color: GREEN }, { label: "First-time", color: BLUE }]} />
          <ResponsiveContainer width="100%" height={196}>
            <BarChart data={monthly} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="label" {...axis} interval="preserveStartEnd" />
              <YAxis {...axis} allowDecimals={false} />
              <Tooltip cursor={{ fill: "rgba(21,32,26,0.04)" }} content={<ChartTip />} />
              <Bar dataKey="returning_donors" name="Returning" stackId="d" fill={GREEN} stroke="#fff" strokeWidth={1} maxBarSize={28} />
              <Bar dataKey="new_donors" name="First-time" stackId="d" fill={BLUE} stroke="#fff" strokeWidth={1} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Organizer journey" sub="Share of all signups reaching each step, all time">
          <div className="gr-stack">
            {data.funnel.map((f) => (
              <HBar key={f.stage} label={f.stage} value={f.count} max={funnelMax} display={f.count.toLocaleString("en-GB")} note={f.pct_of_signups != null ? `· ${pct(f.pct_of_signups)}` : undefined} />
            ))}
          </div>
        </Panel>
      </motion.div>

      {/* Retention + KYC */}
      <motion.div {...fadeUp(0.25)} className="gr-grid-2-1">
        <Panel title="Donor retention by cohort" sub="Of donors who first gave in a month, the share who gave again N months later">
          <div className="gr-cohort-scroll">
            <table className="gr-cohort">
              <thead>
                <tr>
                  <th>First gift</th><th>Donors</th>
                  {data.cohorts[0]?.retention_pct.map((_, i) => <th key={i}>+{i + 1}m</th>)}
                </tr>
              </thead>
              <tbody>
                {data.cohorts.map((c) => (
                  <tr key={c.cohort}>
                    <td className="gr-cohort-month">{monthLabel(c.cohort, true)}</td>
                    <td>{c.size}</td>
                    {c.retention_pct.map((v, i) => (
                      <td key={i} style={c.size ? cohortCell(v) : undefined} title={v != null ? `${v}% returned` : "Not yet elapsed"}>
                        {c.size && v != null ? `${Math.round(v)}%` : ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Identity verification (KYC)" sub="Required before an organizer can withdraw">
          <StatList rows={[
            ["Approved", data.kyc.approved.toLocaleString("en-GB")],
            ["Awaiting review", data.kyc.pending.toLocaleString("en-GB")],
            ["Rejected", data.kyc.rejected.toLocaleString("en-GB")],
            ["Not yet submitted", data.kyc.not_submitted.toLocaleString("en-GB")],
            ["Approval rate (decided)", pct(data.kyc.approval_rate_pct)],
            ["Median review time", data.kyc.median_review_hours != null ? `${data.kyc.median_review_hours} h` : "—"],
          ]} />
        </Panel>
      </motion.div>

      {/* Where money goes */}
      <motion.div {...fadeUp(0.29)} className="gr-grid-3">
        <Panel title="Volume by cause" sub="Processed, by campaign category">
          <div className="gr-stack">
            {data.categories.slice(0, 8).map((c) => (
              <HBar key={c.category} label={humanize(c.category)} value={c.gmv} max={catMax} display={fmtGMDShort(c.gmv)} note={`· ${c.campaigns} campaign${c.campaigns === 1 ? "" : "s"}`} />
            ))}
            {data.categories.length === 0 && <div className="gr-empty">No campaigns yet</div>}
          </div>
        </Panel>

        <Panel title="Gift sizes" sub="Number of successful donations per band">
          <div className="gr-stack">
            {data.gift_bands.map((b) => (
              <HBar key={b.band} label={b.band} value={b.count} max={bandMax} display={b.count.toLocaleString("en-GB")} note={`· ${fmtGMDShort(b.gmv)}`} />
            ))}
          </div>
        </Panel>

        <Panel title="Payment rails" sub="Share of processed volume">
          <div className="gr-stack">
            {data.rails.map((r) => (
              <HBar key={r.rail} label={humanize(r.rail)} value={r.gmv} max={h.gmv_total} display={pct(r.share_pct)} note={`· ${r.count.toLocaleString("en-GB")} gifts`} />
            ))}
            {data.rails.length === 0 && <div className="gr-empty">No donations yet</div>}
          </div>
        </Panel>
      </motion.div>

      {/* Outcomes, trust, orgs */}
      <motion.div {...fadeUp(0.33)} className="gr-grid-3">
        <Panel title="Campaign outcomes">
          <StatList rows={[
            ["Received at least one gift", pct(data.outcomes.funded_rate_pct)],
            ["Target campaigns that hit goal", `${data.outcomes.target_reached} of ${data.outcomes.target_campaigns}`],
            ["Avg raised per funded campaign", data.outcomes.avg_raised_per_funded != null ? fmtGMD(data.outcomes.avg_raised_per_funded) : "—"],
            ["Avg donors per funded campaign", data.outcomes.avg_donors_per_funded != null ? String(data.outcomes.avg_donors_per_funded) : "—"],
            ["Median days to first gift", data.outcomes.median_days_to_first_donation != null ? `${data.outcomes.median_days_to_first_donation} days` : "—"],
          ]} />
        </Panel>

        <Panel title="Trust & transparency">
          <StatList rows={[
            ["Withdrawal success rate", pct(data.trust.payout_success_rate_pct)],
            ["Withdrawn campaigns with receipts", pct(data.trust.proof_coverage_pct)],
            ["Campaigns suspended", `${data.trust.suspended_campaigns} (${pct(data.trust.suspension_rate_pct)})`],
            ["Fraud reports received", data.trust.fraud_reports.toLocaleString("en-GB")],
            ["Moderation reports", data.trust.moderation_reports.toLocaleString("en-GB")],
          ]} />
        </Panel>

        <Panel title="Institutions on Kambeng" sub="Schools, mosques, churches, clinics and associations">
          <div className="gr-stack">
            {data.organizations.by_type.map((o) => (
              <HBar key={o.type} label={orgTypeLabel(o.type)} value={o.count} max={orgMax} display={o.count.toLocaleString("en-GB")} />
            ))}
            {data.organizations.by_type.length === 0 && <div className="gr-empty">No organizations yet</div>}
          </div>
        </Panel>
      </motion.div>

      {/* Top campaigns */}
      {data.top_campaigns.length > 0 && (
        <motion.div {...fadeUp(0.37)}>
          <Panel title="Top campaigns" sub="By total processed, all time">
            <table className="gr-table">
              <thead><tr><th>Campaign</th><th>Cause</th><th className="num">Gifts</th><th className="num">Processed</th></tr></thead>
              <tbody>
                {data.top_campaigns.map((c) => (
                  <tr key={c.slug}>
                    <td data-label="Campaign"><span className="gr-strong">{c.title}</span>{c.is_organization && <span className="gr-tag">Organization</span>}</td>
                    <td data-label="Cause">{c.category ? humanize(c.category) : "—"}</td>
                    <td data-label="Gifts" className="num">{c.donations.toLocaleString("en-GB")}</td>
                    <td data-label="Processed" className="num gr-strong">{fmtGMD(c.gmv)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </motion.div>
      )}

      {/* Methodology */}
      <motion.footer {...fadeUp(0.41)} className="gr-method">
        <h3>How these numbers are measured</h3>
        <ul>
          <li><b>Processed</b> is the gross amount donors paid on successful donations, before gateway fees.</li>
          <li><b>Revenue</b> is Kambeng&apos;s platform commission on completed organizer withdrawals. Payment-gateway fees are excluded; they are not Kambeng income.</li>
          <li><b>Paid out</b> is the net amount delivered to organizers&apos; Wave accounts.</li>
          <li><b>Users</b> excludes staff accounts. <b>KYC-verified</b> is the share of users with approved identity documents.</li>
          <li><b>Donors</b> are identified by account or email. Fully anonymous gifts count toward volume but not toward donor or retention figures.</li>
          <li><b>Growth</b> compares the last complete month with the month before. <b>Compound monthly growth</b> runs from the first month with activity in the window to the last complete month. The current month is partial and is never used for growth.</li>
        </ul>
      </motion.footer>
    </>
  );
}

const CSS = `
.gr-root { min-height: 100vh; padding: 28px clamp(16px, 4vw, 48px) 48px; }
.gr-wrap { max-width: 1200px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
.gr-card { background: #fff; border: 1px solid rgba(21,32,26,0.07); border-radius: 14px; }
.gr-header { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin-bottom: 8px; }
.gr-kicker { font-size: 11px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: #b9500b; }
.gr-title { font-family: var(--font-display); font-size: clamp(24px, 3.4vw, 32px); font-weight: 900; letter-spacing: -0.03em; color: ${INK}; margin: 4px 0 6px; line-height: 1.1; }
.gr-lede { font-size: 13px; color: ${MUTED}; margin: 0; max-width: 640px; }
.gr-controls { display: flex; gap: 10px; align-items: center; }
.gr-seg { display: inline-flex; background: rgba(21,32,26,0.05); border-radius: 10px; padding: 3px; }
.gr-seg button { border: 0; background: transparent; padding: 7px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; color: ${MUTED}; cursor: pointer; }
.gr-seg button.on { background: #fff; color: ${INK}; box-shadow: 0 1px 2px rgba(21,32,26,0.12); }
.gr-print { display: inline-flex; align-items: center; gap: 6px; border: 0; background: ${GREEN}; color: #fff; font-size: 12px; font-weight: 700; padding: 9px 14px; border-radius: 10px; cursor: pointer; }
.gr-print:hover { background: #0f5e3a; }
.gr-state { padding: 48px; text-align: center; color: ${MUTED}; font-size: 14px; }

.gr-grid-4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.gr-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.gr-grid-2-1 { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 16px; }
.gr-grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }

.gr-eyebrow { font-size: 10px; font-weight: 700; color: ${FAINT}; text-transform: uppercase; letter-spacing: 0.08em; }
.gr-hero { padding: 20px 22px; display: flex; flex-direction: column; gap: 6px; }
.gr-hero-value { font-size: clamp(24px, 2.6vw, 30px); font-weight: 900; color: ${INK}; letter-spacing: -0.03em; line-height: 1.05; font-variant-numeric: tabular-nums; }
.gr-mini { padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; }
.gr-mini-value { font-size: 20px; font-weight: 800; color: ${INK}; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.gr-sub { font-size: 12px; color: ${MUTED}; }
.gr-delta { font-size: 12px; font-weight: 800; display: flex; flex-wrap: wrap; align-items: center; column-gap: 4px; }
.gr-delta-note { font-weight: 500; color: ${MUTED}; }
.gr-delta-flat { font-weight: 500; color: ${FAINT}; }

.gr-panel { padding: 20px; min-width: 0; }
.gr-panel-title { font-size: 14px; font-weight: 800; color: ${INK}; margin: 0; }
.gr-panel-sub { font-size: 12px; color: ${FAINT}; margin: 3px 0 14px; }
.gr-legend { display: flex; gap: 14px; font-size: 11px; color: ${MUTED}; margin-bottom: 8px; }
.gr-legend span { display: inline-flex; align-items: center; gap: 6px; }
.gr-legend i { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }

.gr-tip { background: #fff; border: 1px solid rgba(21,32,26,0.1); border-radius: 10px; padding: 10px 12px; font-size: 12px; box-shadow: 0 4px 14px rgba(21,32,26,0.08); }
.gr-tip-head { color: ${MUTED}; font-weight: 700; margin-bottom: 6px; }
.gr-tip-row { display: flex; align-items: center; gap: 6px; color: ${MUTED}; }
.gr-tip-row i { width: 8px; height: 8px; border-radius: 2px; display: inline-block; }
.gr-tip-row b { color: ${INK}; margin-left: auto; padding-left: 12px; font-variant-numeric: tabular-nums; }

.gr-stack { display: flex; flex-direction: column; gap: 11px; }
.gr-hbar-top { display: flex; justify-content: space-between; gap: 10px; font-size: 12px; margin-bottom: 4px; }
.gr-hbar-label { color: ${INK}; font-weight: 600; }
.gr-hbar-value { color: ${INK}; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
.gr-hbar-note { color: ${FAINT}; font-weight: 500; }
.gr-hbar-track { height: 8px; background: rgba(21,32,26,0.05); border-radius: 4px; overflow: hidden; }
.gr-hbar-fill { height: 100%; background: ${GREEN}; border-radius: 4px; }
.gr-empty { font-size: 13px; color: ${FAINT}; padding: 16px 0; }

.gr-statlist { margin: 0; display: flex; flex-direction: column; }
.gr-statlist > div { display: flex; justify-content: space-between; gap: 12px; padding: 9px 0; border-bottom: 1px solid rgba(21,32,26,0.05); font-size: 13px; }
.gr-statlist > div:last-child { border-bottom: 0; }
.gr-statlist dt { color: ${MUTED}; }
.gr-statlist dd { margin: 0; color: ${INK}; font-weight: 800; font-variant-numeric: tabular-nums; text-align: right; }

.gr-cohort-scroll { overflow-x: auto; }
.gr-cohort { width: 100%; border-collapse: separate; border-spacing: 2px; font-size: 12px; font-variant-numeric: tabular-nums; }
.gr-cohort th { font-size: 10px; font-weight: 700; color: ${FAINT}; text-transform: uppercase; letter-spacing: 0.06em; padding: 4px 6px; text-align: center; }
.gr-cohort th:first-child { text-align: left; }
.gr-cohort td { text-align: center; padding: 8px 6px; border-radius: 4px; color: ${INK}; font-weight: 700; min-width: 44px; }
.gr-cohort td.gr-cohort-month { text-align: left; font-weight: 600; white-space: nowrap; }

.gr-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.gr-table th { text-align: left; font-size: 10px; font-weight: 700; color: ${FAINT}; text-transform: uppercase; letter-spacing: 0.06em; padding: 0 8px 8px; border-bottom: 1px solid rgba(21,32,26,0.08); }
.gr-table td { padding: 11px 8px; border-bottom: 1px solid rgba(21,32,26,0.05); color: ${MUTED}; }
.gr-table .num { text-align: right; font-variant-numeric: tabular-nums; }
.gr-strong { color: ${INK}; font-weight: 700; }
.gr-tag { margin-left: 8px; font-size: 10px; font-weight: 700; color: ${GREEN}; background: rgba(20,120,74,0.1); padding: 2px 7px; border-radius: 999px; }

.gr-method { padding: 8px 4px 0; color: ${MUTED}; font-size: 12px; line-height: 1.6; }
.gr-method h3 { font-size: 12px; font-weight: 800; color: ${INK}; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 0.06em; }
.gr-method ul { margin: 0; padding-left: 18px; }

@media (max-width: 1000px) {
  .gr-grid-3 { grid-template-columns: 1fr; }
  .gr-grid-2-1 { grid-template-columns: 1fr; }
}
@media (max-width: 900px) {
  .gr-grid-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .gr-grid-2 { grid-template-columns: 1fr; }
}
@media (max-width: 560px) {
  .gr-hero { padding: 14px; }
  .gr-mini { padding: 12px; }
  .gr-table thead { display: none; }
  .gr-table tr { display: block; padding: 10px 0; border-bottom: 1px solid rgba(21,32,26,0.06); }
  .gr-table td { display: flex; justify-content: space-between; gap: 12px; border: 0; padding: 3px 0; text-align: right; }
  .gr-table td::before { content: attr(data-label); color: ${FAINT}; font-size: 11px; font-weight: 600; text-align: left; }
}

@media print {
  @page { size: A4; margin: 12mm; }
  /* The shell scrolls <body>; let the page flow onto as many sheets as it needs. */
  html, body { height: auto !important; overflow: visible !important; background: #fff !important; }
  body * { background-image: none !important; }
  .admin-sidebar-desktop, .admin-mobile-bar, .woven-strip, .no-print { display: none !important; }
  .gr-root { padding: 0; min-height: 0; }
  .gr-card { break-inside: avoid; box-shadow: none; }
  .gr-grid-4 { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; gap: 8px; }
  .gr-hero-value { font-size: 20px; }
  .gr-mini-value { font-size: 16px; }
  /* Recharts keeps its on-screen width when printing, so chart rows go one-up
     (on-screen panels are never wider than an A4 sheet). */
  .gr-grid-2, .gr-grid-2-1 { grid-template-columns: 1fr !important; }
  .gr-grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;
