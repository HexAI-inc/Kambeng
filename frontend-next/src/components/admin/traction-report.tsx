"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { PrinterOutlined } from "@ant-design/icons";
import { BrandMark } from "@/components/layout/brand-mark";
import { useAdminGrowthMetrics } from "@/hooks/use-frontend-data";
import { fmtCompact, fmtDate, fmtGMD, fmtGMDShort, humanize, railLabel } from "@/lib/fmt";
import type { GrowthMetrics, GrowthTrend } from "@/types/frontend";

/**
 * The traction report as a document: A4 sheets with a cover, an executive
 * summary written from the numbers, fixed-size charts that print exactly as
 * they look, and a footer on every page. "Download PDF" prints it; the browser
 * saves it as a PDF named after the page title.
 */

const INK = "#15201a";
const MUTED = "#56625b";
const FAINT = "#6e7872";
const GREEN = "#14784a";
const BLUE = "#5a7fd6";
const ORANGE = "#e8650f";
const PARTIAL = "rgba(20,120,74,0.35)";
const GRID = "rgba(21,32,26,0.07)";
const UP = "#14784a";
const DOWN = "#c0392b";

// Content width of an A4 sheet with 16mm side margins, in CSS pixels.
const FULL = 672;
const HALF = 324;

const WINDOWS = [6, 12, 24] as const;

function monthLabel(key: string, withYear = false) {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: withYear ? "long" : "short", year: withYear ? "numeric" : "2-digit", timeZone: "UTC" });
}

const pct = (n: number | null | undefined, digits = 1) => (n == null ? "—" : `${n.toFixed(digits)}%`);
const count = (n: number) => n.toLocaleString("en-GB");
const orgTypeLabel = (t: string) => (t === "NGO" ? "NGO" : humanize(t));

function change(trend: GrowthTrend) {
  if (trend.growth_pct == null) return null;
  return { up: trend.growth_pct >= 0, text: `${trend.growth_pct >= 0 ? "+" : "−"}${Math.abs(trend.growth_pct).toFixed(1)}%` };
}

/** Plain-language findings for the cover, written from the numbers. */
function summary(data: GrowthMetrics, lastFull?: string): string[] {
  const h = data.headline;
  const t = data.trends;
  const lines = [
    `Kambeng has processed ${fmtGMD(h.gmv_total)} through ${count(h.donations_count)} successful donations from ${count(h.unique_donors)} identified donors.`,
  ];
  const g = change(t.gmv);
  if (g && lastFull) {
    lines.push(`In ${monthLabel(lastFull, true)}, donors gave ${fmtGMD(t.gmv.last_month)}, ${g.up ? "up" : "down"} ${g.text.slice(1)} on the month before${t.gmv.cmgr_pct != null ? `, with volume compounding ${pct(t.gmv.cmgr_pct)} a month across the period` : ""}.`);
  }
  lines.push(`${count(h.total_users)} people have registered and ${pct(h.kyc_rate_pct, 0)} have verified their identity — required before any organizer can withdraw.`);
  if (h.paid_out_total > 0) {
    lines.push(`${fmtGMD(h.paid_out_total)} has reached communities through ${count(data.trust.payouts_completed)} completed withdrawals${data.trust.proof_coverage_pct != null ? `, and ${pct(data.trust.proof_coverage_pct, 0)} of campaigns that withdrew have posted receipts` : ""}.`);
  }
  if (h.repeat_donor_rate_pct != null) {
    lines.push(`${pct(h.repeat_donor_rate_pct, 0)} of donors have given more than once${h.recurring_active_plans ? `, and ${count(h.recurring_active_plans)} recurring plans commit ${fmtGMD(h.recurring_monthly_committed)} a month` : ""}.`);
  }
  return lines;
}

export function TractionReport({ months }: { months: number }) {
  const { data, isLoading, isError } = useAdminGrowthMetrics(months);

  useEffect(() => {
    if (!data) return;
    const previous = document.title;
    // The browser names the saved PDF after the page title.
    document.title = `Kambeng traction report — ${fmtDate(data.generated_at)}`;
    return () => { document.title = previous; };
  }, [data]);

  return (
    <div className="tr-root">
      <div className="tr-toolbar no-print">
        <Link href="/admin/growth" className="tr-back">← Back to dashboard</Link>
        <div className="tr-toolbar-right">
          <div className="tr-seg" role="group" aria-label="Report window">
            {WINDOWS.map((w) => (
              <Link key={w} href={`/admin/growth/report?months=${w}`} aria-pressed={months === w} className={months === w ? "on" : ""}>{w} months</Link>
            ))}
          </div>
          <button type="button" className="tr-print" onClick={() => window.print()} disabled={!data}>
            <PrinterOutlined /> Download PDF
          </button>
        </div>
      </div>
      {isLoading && <div className="tr-state no-print">Preparing the report…</div>}
      {isError && <div className="tr-state no-print">Couldn&apos;t load the report. Try again in a moment.</div>}
      {data && <Document data={data} />}
      <style>{CSS}</style>
    </div>
  );
}

function Sheet({ page, total, title, children }: { page: number; total: number; title?: string; children: React.ReactNode }) {
  return (
    <section className="tr-sheet">
      {title && (
        <header className="tr-sheet-head">
          <span className="tr-brand-sm"><BrandMark size={18} /> Kambeng</span>
          <span>{title}</span>
        </header>
      )}
      <div className="tr-sheet-body">{children}</div>
      <footer className="tr-sheet-foot">
        <span>Kambeng traction report · Confidential</span>
        <span>{page} / {total}</span>
      </footer>
    </section>
  );
}

function Big({ label, value, trend, sub }: { label: string; value: string; trend?: GrowthTrend; sub?: string }) {
  const c = trend ? change(trend) : null;
  return (
    <div className="tr-big">
      <div className="tr-eyebrow">{label}</div>
      <div className="tr-big-value">{value}</div>
      {c && <div className="tr-delta" style={{ color: c.up ? UP : DOWN }}>{c.text} <span>last month</span></div>}
      {sub && <div className="tr-sub">{sub}</div>}
    </div>
  );
}

function Small({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="tr-small">
      <div className="tr-eyebrow">{label}</div>
      <div className="tr-small-value">{value}</div>
      {sub && <div className="tr-sub">{sub}</div>}
    </div>
  );
}

function Block({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="tr-block">
      <h3>{title}</h3>
      {sub && <p className="tr-block-sub">{sub}</p>}
      {children}
    </div>
  );
}

function Bars({ rows }: { rows: { label: string; value: number; display: string; note?: string }[] }) {
  const max = Math.max(...rows.map((r) => r.value), 0);
  if (rows.length === 0) return <div className="tr-sub">Nothing yet</div>;
  return (
    <div className="tr-bars">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="tr-bar-top"><span>{r.label}</span><b>{r.display}{r.note && <i> {r.note}</i>}</b></div>
          <div className="tr-bar-track"><div style={{ width: `${max > 0 ? Math.max((r.value / max) * 100, r.value > 0 ? 2 : 0) : 0}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

function List({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="tr-list">
      {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
    </dl>
  );
}

function Key({ items }: { items: { label: string; color: string }[] }) {
  return <div className="tr-key">{items.map((i) => <span key={i.label}><i style={{ background: i.color }} />{i.label}</span>)}</div>;
}

function Document({ data }: { data: GrowthMetrics }) {
  const h = data.headline;
  const t = data.trends;
  const lastFull = data.monthly.filter((m) => !m.is_partial).at(-1)?.month;
  const first = data.monthly[0]?.month;
  const last = data.monthly.at(-1)?.month;
  const period = first && last ? `${monthLabel(first, true)} – ${monthLabel(last, true)}` : "";
  const monthly = data.monthly.map((m) => ({ ...m, label: monthLabel(m.month), returning: Math.max(m.unique_donors - m.new_donors, 0) }));
  const axis = { tick: { fill: FAINT, fontSize: 9 }, axisLine: false, tickLine: false } as const;
  const TOTAL = 5;

  return (
    <div className="tr-doc">
      {/* 1 · Cover */}
      <Sheet page={1} total={TOTAL}>
        <div className="tr-cover">
          <div className="tr-cover-brand"><BrandMark size={44} /><span>Kambeng</span></div>
          <div className="tr-cover-kicker">Traction report</div>
          <h1 className="tr-cover-title">Real causes. Real proof.<br />Real growth.</h1>
          <div className="tr-cover-meta">{period} · generated {fmtDate(data.generated_at)} · amounts in Gambian dalasi (GMD)</div>

          <div className="tr-grid-4 tr-cover-stats">
            <Big label="Total processed" value={fmtGMDShort(h.gmv_total)} trend={t.gmv} />
            <Big label="Revenue earned" value={fmtGMDShort(h.revenue_total)} trend={t.revenue} sub={`take rate ${pct(h.take_rate_pct, 2)}`} />
            <Big label="Registered users" value={count(h.total_users)} trend={t.new_users} />
            <Big label="Paid out to communities" value={fmtGMDShort(h.paid_out_total)} sub={`${count(data.trust.payouts_completed)} withdrawals`} />
          </div>

          <div className="tr-summary">
            <h2>Summary</h2>
            <ul>{summary(data, lastFull).map((line) => <li key={line}>{line}</li>)}</ul>
          </div>

          <div className="tr-grid-4">
            <Small label="Unique donors" value={count(h.unique_donors)} sub={`${pct(h.repeat_donor_rate_pct, 0)} gave again`} />
            <Small label="Average gift" value={h.avg_donation != null ? fmtGMD(h.avg_donation) : "—"} sub={h.median_donation != null ? `median ${fmtGMD(h.median_donation)}` : undefined} />
            <Small label="Payment success" value={pct(h.payment_success_rate_pct, 0)} sub="of settled attempts" />
            <Small label="Identity verified" value={pct(h.kyc_rate_pct, 0)} sub={`${count(h.kyc_approved)} users`} />
          </div>
        </div>
      </Sheet>

      {/* 2 · Money */}
      <Sheet page={2} total={TOTAL} title="Money movement">
        <h2 className="tr-h2">Money movement</h2>
        <p className="tr-lede">What donors gave each month, what Kambeng earned, and what reached organizers.</p>
        <Block title="Volume processed per month" sub={t.gmv.cmgr_pct != null ? `Compound monthly growth ${pct(t.gmv.cmgr_pct)} · lighter bar = month in progress` : "Lighter bar = month in progress"}>
          <BarChart width={FULL} height={210} data={monthly} margin={{ top: 6, right: 4, left: -6, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="label" {...axis} interval={0} />
            <YAxis {...axis} tickFormatter={(v: number) => fmtCompact(v)} />
            <Bar dataKey="gmv" radius={[3, 3, 0, 0]} maxBarSize={30} isAnimationActive={false}>
              {monthly.map((m) => <Cell key={m.month} fill={m.is_partial ? PARTIAL : GREEN} />)}
            </Bar>
          </BarChart>
        </Block>
        <div className="tr-grid-2">
          <Block title="Revenue per month" sub="Kambeng's commission on organizer withdrawals">
            <BarChart width={HALF} height={160} data={monthly} margin={{ top: 6, right: 4, left: -14, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="label" {...axis} interval="preserveStartEnd" />
              <YAxis {...axis} tickFormatter={(v: number) => fmtCompact(v)} />
              <Bar dataKey="revenue" radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false}>
                {monthly.map((m) => <Cell key={m.month} fill={m.is_partial ? PARTIAL : GREEN} />)}
              </Bar>
            </BarChart>
          </Block>
          <Block title="Paid out per month" sub="Delivered to organizers' Wave accounts">
            <BarChart width={HALF} height={160} data={monthly} margin={{ top: 6, right: 4, left: -14, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="label" {...axis} interval="preserveStartEnd" />
              <YAxis {...axis} tickFormatter={(v: number) => fmtCompact(v)} />
              <Bar dataKey="paid_out" radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false}>
                {monthly.map((m) => <Cell key={m.month} fill={m.is_partial ? "rgba(90,127,214,0.35)" : BLUE} />)}
              </Bar>
            </BarChart>
          </Block>
        </div>
        <Block title="Month by month">
          <table className="tr-table">
            <thead><tr><th>Month</th><th>Processed</th><th>Donations</th><th>Donors</th><th>Revenue</th><th>Paid out</th><th>New users</th></tr></thead>
            <tbody>
              {[...monthly].reverse().map((m) => (
                <tr key={m.month}>
                  <td>{monthLabel(m.month, true)}{m.is_partial ? " (so far)" : ""}</td>
                  <td>{fmtGMD(m.gmv)}</td><td>{count(m.donations)}</td><td>{count(m.unique_donors)}</td>
                  <td>{fmtGMD(m.revenue)}</td><td>{fmtGMD(m.paid_out)}</td><td>{count(m.new_users)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Block>
      </Sheet>

      {/* 3 · People */}
      <Sheet page={3} total={TOTAL} title="People">
        <h2 className="tr-h2">People</h2>
        <p className="tr-lede">Who is joining, verifying their identity and giving.</p>
        <div className="tr-grid-2">
          <Block title="Registered users" sub="Cumulative, excluding staff">
            <AreaChart width={HALF} height={170} data={monthly} margin={{ top: 6, right: 4, left: -14, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="label" {...axis} interval="preserveStartEnd" />
              <YAxis {...axis} allowDecimals={false} tickFormatter={(v: number) => fmtCompact(v)} />
              <Area type="monotone" dataKey="cumulative_users" stroke={GREEN} strokeWidth={2} fill="rgba(20,120,74,0.12)" isAnimationActive={false} />
            </AreaChart>
          </Block>
          <Block title="Signups and identity checks">
            <Key items={[{ label: "New signups", color: GREEN }, { label: "KYC approved", color: BLUE }]} />
            <BarChart width={HALF} height={150} data={monthly} margin={{ top: 6, right: 4, left: -14, bottom: 0 }} barGap={1}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="label" {...axis} interval="preserveStartEnd" />
              <YAxis {...axis} allowDecimals={false} />
              <Bar dataKey="new_users" fill={GREEN} radius={[3, 3, 0, 0]} maxBarSize={10} isAnimationActive={false} />
              <Bar dataKey="kyc_approved" fill={BLUE} radius={[3, 3, 0, 0]} maxBarSize={10} isAnimationActive={false} />
            </BarChart>
          </Block>
        </div>
        <div className="tr-grid-2">
          <Block title="Active donors per month" sub="Identified donors who gave that month">
            <Key items={[{ label: "Returning", color: GREEN }, { label: "First-time", color: BLUE }]} />
            <BarChart width={HALF} height={150} data={monthly} margin={{ top: 6, right: 4, left: -14, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="label" {...axis} interval="preserveStartEnd" />
              <YAxis {...axis} allowDecimals={false} />
              <Bar dataKey="returning" stackId="d" fill={GREEN} maxBarSize={18} isAnimationActive={false} />
              <Bar dataKey="new_donors" stackId="d" fill={BLUE} radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />
            </BarChart>
          </Block>
          <Block title="Organizer journey" sub="Share of all signups reaching each step">
            <Bars rows={data.funnel.map((f) => ({ label: f.stage, value: f.count, display: count(f.count), note: f.pct_of_signups != null ? `· ${pct(f.pct_of_signups, 0)}` : undefined }))} />
          </Block>
        </div>
        <div className="tr-grid-2">
          <Block title="Identity verification">
            <List rows={[
              ["Approved", count(data.kyc.approved)],
              ["Awaiting review", count(data.kyc.pending)],
              ["Rejected", count(data.kyc.rejected)],
              ["Not yet submitted", count(data.kyc.not_submitted)],
              ["Approval rate", pct(data.kyc.approval_rate_pct)],
              ["Median review time", data.kyc.median_review_hours != null ? `${data.kyc.median_review_hours} hours` : "—"],
            ]} />
          </Block>
          <Block title="Giving habits">
            <List rows={[
              ["Unique donors", count(h.unique_donors)],
              ["Gave more than once", pct(h.repeat_donor_rate_pct)],
              ["Average gift", h.avg_donation != null ? fmtGMD(h.avg_donation) : "—"],
              ["Median gift", h.median_donation != null ? fmtGMD(h.median_donation) : "—"],
              ["Active recurring plans", count(h.recurring_active_plans)],
              ["Committed monthly", fmtGMD(h.recurring_monthly_committed)],
            ]} />
          </Block>
        </div>
      </Sheet>

      {/* 4 · Where money goes, outcomes, trust */}
      <Sheet page={4} total={TOTAL} title="Causes, outcomes and trust">
        <h2 className="tr-h2">Causes, outcomes and trust</h2>
        <p className="tr-lede">Where money goes, how campaigns perform, and how Kambeng keeps giving accountable.</p>
        <div className="tr-grid-2">
          <Block title="Volume by cause">
            <Bars rows={data.categories.slice(0, 8).map((c) => ({ label: humanize(c.category), value: c.gmv, display: fmtGMDShort(c.gmv), note: `· ${c.campaigns} campaign${c.campaigns === 1 ? "" : "s"}` }))} />
          </Block>
          <Block title="Gift sizes" sub="Successful donations per band">
            <Bars rows={data.gift_bands.map((b) => ({ label: b.band, value: b.count, display: count(b.count), note: `· ${fmtGMDShort(b.gmv)}` }))} />
          </Block>
        </div>
        <div className="tr-grid-2">
          <Block title="Payment rails" sub="Share of processed volume">
            <Bars rows={data.rails.map((r) => ({ label: railLabel(r.rail), value: r.gmv, display: pct(r.share_pct, 0), note: `· ${count(r.count)} gifts` }))} />
          </Block>
          <Block title="Institutions on Kambeng">
            <Bars rows={data.organizations.by_type.map((o) => ({ label: orgTypeLabel(o.type), value: o.count, display: count(o.count) }))} />
          </Block>
        </div>
        <div className="tr-grid-2">
          <Block title="Campaign outcomes">
            <List rows={[
              ["Campaigns", `${count(h.campaigns_total)} (${count(h.campaigns_funded)} funded)`],
              ["Received at least one gift", pct(data.outcomes.funded_rate_pct)],
              ["Target campaigns that hit goal", `${data.outcomes.target_reached} of ${data.outcomes.target_campaigns}`],
              ["Average raised per funded campaign", data.outcomes.avg_raised_per_funded != null ? fmtGMD(data.outcomes.avg_raised_per_funded) : "—"],
              ["Median days to first gift", data.outcomes.median_days_to_first_donation != null ? `${data.outcomes.median_days_to_first_donation} days` : "—"],
            ]} />
          </Block>
          <Block title="Trust and transparency">
            <List rows={[
              ["Withdrawal success rate", pct(data.trust.payout_success_rate_pct)],
              ["Campaigns that withdrew and posted receipts", pct(data.trust.proof_coverage_pct)],
              ["Campaigns suspended", `${data.trust.suspended_campaigns} (${pct(data.trust.suspension_rate_pct)})`],
              ["Fraud reports received", count(data.trust.fraud_reports)],
              ["Organizations", `${count(h.organizations_total)} (${count(h.organizations_verified)} verified)`],
            ]} />
          </Block>
        </div>
      </Sheet>

      {/* 5 · Campaigns, retention, method */}
      <Sheet page={5} total={TOTAL} title="Campaigns and retention">
        <h2 className="tr-h2">Campaigns and retention</h2>
        {data.top_campaigns.length > 0 && (
          <Block title="Top campaigns" sub="By total processed, all time">
            <table className="tr-table tr-table-left">
              <thead><tr><th>Campaign</th><th>Cause</th><th>Gifts</th><th>Processed</th></tr></thead>
              <tbody>
                {data.top_campaigns.map((c) => (
                  <tr key={c.slug}>
                    <td><b>{c.title}</b>{c.is_organization && <span className="tr-tag">Organization</span>}</td>
                    <td>{c.category ? humanize(c.category) : "—"}</td>
                    <td>{count(c.donations)}</td>
                    <td><b>{fmtGMD(c.gmv)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Block>
        )}
        <Block title="Donor retention by cohort" sub="Of donors who first gave in a month, the share who gave again N months later">
          <table className="tr-cohort">
            <thead><tr><th>First gift</th><th>Donors</th>{data.cohorts[0]?.retention_pct.map((_, i) => <th key={i}>+{i + 1}m</th>)}</tr></thead>
            <tbody>
              {data.cohorts.map((c) => (
                <tr key={c.cohort}>
                  <td className="tr-cohort-month">{monthLabel(c.cohort)}</td>
                  <td>{c.size}</td>
                  {c.retention_pct.map((v, i) => {
                    const a = v == null || !c.size ? 0 : 0.08 + Math.min(v, 100) / 100 * 0.82;
                    return <td key={i} style={{ background: a ? `rgba(20,120,74,${a.toFixed(2)})` : "transparent", color: a > 0.5 ? "#fff" : INK }}>{c.size && v != null ? `${Math.round(v)}%` : ""}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Block>
        <div className="tr-method">
          <h3>How these numbers are measured</h3>
          <ul>
            <li><b>Processed</b> is what donors paid on successful donations, before gateway fees.</li>
            <li><b>Revenue</b> is Kambeng&apos;s commission on completed organizer withdrawals; gateway fees are not Kambeng income.</li>
            <li><b>Paid out</b> is the amount delivered to organizers&apos; Wave accounts.</li>
            <li><b>Users</b> excludes staff. <b>Donors</b> are identified by account or email; anonymous gifts count toward volume only.</li>
            <li><b>Growth</b> compares the last complete month with the one before; the current month is partial and never used for growth.</li>
          </ul>
        </div>
      </Sheet>
    </div>
  );
}

const CSS = `
.tr-root { min-height: 100vh; padding: 20px clamp(12px, 3vw, 32px) 48px; background: #e9e6df; }
.tr-toolbar { max-width: 210mm; margin: 0 auto 16px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.tr-back { font-size: 13px; font-weight: 600; color: ${MUTED}; text-decoration: none; }
.tr-toolbar-right { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.tr-seg { display: inline-flex; background: rgba(21,32,26,0.07); border-radius: 10px; padding: 3px; }
.tr-seg a { padding: 7px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; color: ${MUTED}; text-decoration: none; }
.tr-seg a.on { background: #fff; color: ${INK}; box-shadow: 0 1px 2px rgba(21,32,26,0.12); }
.tr-print { display: inline-flex; align-items: center; gap: 6px; border: 0; background: ${GREEN}; color: #fff; font-size: 13px; font-weight: 700; padding: 10px 16px; border-radius: 10px; cursor: pointer; }
.tr-print:disabled { opacity: 0.5; cursor: wait; }
.tr-state { max-width: 210mm; margin: 0 auto; background: #fff; border-radius: 12px; padding: 48px; text-align: center; color: ${MUTED}; }

.tr-doc { display: flex; flex-direction: column; align-items: center; gap: 20px; overflow-x: auto; }
.tr-sheet { width: 210mm; min-height: 297mm; background: #fff; box-shadow: 0 6px 24px rgba(21,32,26,0.12); padding: 14mm 16mm 12mm; display: flex; flex-direction: column; box-sizing: border-box; color: ${INK}; flex: none; }
.tr-sheet-head { display: flex; justify-content: space-between; align-items: center; font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${FAINT}; padding-bottom: 8px; border-bottom: 1px solid rgba(21,32,26,0.08); margin-bottom: 14px; }
.tr-brand-sm { display: inline-flex; align-items: center; gap: 6px; color: ${INK}; font-family: var(--font-display); font-size: 12px; letter-spacing: -0.01em; text-transform: none; }
.tr-sheet-body { flex: 1; display: flex; flex-direction: column; gap: 12px; }
.tr-sheet-foot { display: flex; justify-content: space-between; font-size: 9px; color: ${FAINT}; padding-top: 8px; border-top: 1px solid rgba(21,32,26,0.08); margin-top: 12px; }

.tr-cover { display: flex; flex-direction: column; gap: 18px; height: 100%; }
.tr-cover-brand { display: flex; align-items: center; gap: 12px; font-family: var(--font-display); font-size: 26px; font-weight: 900; letter-spacing: -0.03em; }
.tr-cover-kicker { margin-top: 28px; font-size: 12px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: ${ORANGE}; }
.tr-cover-title { font-family: var(--font-display); font-size: 40px; line-height: 1.05; font-weight: 900; letter-spacing: -0.035em; margin: -6px 0 0; }
.tr-cover-meta { font-size: 12px; color: ${MUTED}; padding-bottom: 18px; border-bottom: 3px solid ${GREEN}; }
.tr-cover-stats { margin-top: 4px; }
.tr-summary { background: #f3f8f5; border-radius: 10px; padding: 16px 18px; }
.tr-summary h2 { font-size: 12px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: ${GREEN}; margin: 0 0 8px; }
.tr-summary ul { margin: 0; padding-left: 16px; display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; line-height: 1.55; color: ${INK}; }

.tr-grid-4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.tr-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.tr-eyebrow { font-size: 8.5px; font-weight: 700; color: ${FAINT}; text-transform: uppercase; letter-spacing: 0.08em; }
.tr-big { border-top: 3px solid ${GREEN}; padding-top: 8px; }
.tr-big-value { font-size: 22px; font-weight: 900; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; margin-top: 2px; }
.tr-delta { font-size: 10.5px; font-weight: 800; margin-top: 2px; }
.tr-delta span { font-weight: 500; color: ${FAINT}; }
.tr-small { background: #faf9f6; border-radius: 8px; padding: 9px 10px; }
.tr-small-value { font-size: 15px; font-weight: 800; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; margin-top: 2px; }
.tr-sub { font-size: 10px; color: ${MUTED}; margin-top: 2px; }

.tr-h2 { font-family: var(--font-display); font-size: 22px; font-weight: 900; letter-spacing: -0.03em; margin: 0; }
.tr-lede { font-size: 12px; color: ${MUTED}; margin: -6px 0 2px; }
.tr-block { break-inside: avoid; }
.tr-block h3 { font-size: 12px; font-weight: 800; margin: 0; }
.tr-block-sub { font-size: 10px; color: ${FAINT}; margin: 2px 0 8px; }
.tr-block > h3 + :not(.tr-block-sub) { margin-top: 8px; }
.tr-key { display: flex; gap: 12px; font-size: 9.5px; color: ${MUTED}; margin-bottom: 4px; }
.tr-key span { display: inline-flex; align-items: center; gap: 5px; }
.tr-key i { width: 8px; height: 8px; border-radius: 2px; display: inline-block; }
.tr-bars { display: flex; flex-direction: column; gap: 7px; }
.tr-bar-top { display: flex; justify-content: space-between; gap: 8px; font-size: 10.5px; margin-bottom: 3px; }
.tr-bar-top b { font-variant-numeric: tabular-nums; white-space: nowrap; }
.tr-bar-top i { font-style: normal; font-weight: 500; color: ${FAINT}; }
.tr-bar-track { height: 6px; background: rgba(21,32,26,0.06); border-radius: 3px; overflow: hidden; }
.tr-bar-track div { height: 100%; background: ${GREEN}; border-radius: 3px; }
.tr-list { margin: 0; }
.tr-list > div { display: flex; justify-content: space-between; gap: 10px; padding: 5px 0; border-bottom: 1px solid rgba(21,32,26,0.06); font-size: 10.5px; }
.tr-list dt { color: ${MUTED}; }
.tr-list dd { margin: 0; font-weight: 800; font-variant-numeric: tabular-nums; text-align: right; }

.tr-table { width: 100%; border-collapse: collapse; font-size: 10px; font-variant-numeric: tabular-nums; }
.tr-table th { font-size: 8.5px; font-weight: 700; color: ${FAINT}; text-transform: uppercase; letter-spacing: 0.06em; text-align: right; padding: 0 6px 6px; border-bottom: 1px solid rgba(21,32,26,0.1); }
.tr-table td { text-align: right; padding: 5px 6px; border-bottom: 1px solid rgba(21,32,26,0.05); color: ${MUTED}; }
.tr-table th:first-child, .tr-table td:first-child { text-align: left; color: ${INK}; }
.tr-table-left td b { color: ${INK}; }
.tr-tag { margin-left: 6px; font-size: 8px; font-weight: 700; color: ${GREEN}; background: rgba(20,120,74,0.1); padding: 1px 6px; border-radius: 999px; }
.tr-cohort { width: 100%; border-collapse: separate; border-spacing: 2px; font-size: 9.5px; font-variant-numeric: tabular-nums; }
.tr-cohort th { font-size: 8px; font-weight: 700; color: ${FAINT}; text-transform: uppercase; padding: 2px 4px; }
.tr-cohort td { text-align: center; padding: 5px 3px; border-radius: 3px; font-weight: 700; }
.tr-cohort td.tr-cohort-month { text-align: left; font-weight: 600; white-space: nowrap; }
.tr-method { margin-top: auto; font-size: 9.5px; color: ${MUTED}; line-height: 1.55; border-top: 1px solid rgba(21,32,26,0.08); padding-top: 10px; }
.tr-method h3 { font-size: 9px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: ${INK}; margin: 0 0 4px; }
.tr-method ul { margin: 0; padding-left: 14px; }

@media print {
  @page { size: A4; margin: 0; }
  html, body { height: auto !important; overflow: visible !important; background: #fff !important; }
  .admin-sidebar-desktop, .admin-mobile-bar, .woven-strip, .no-print { display: none !important; }
  .tr-root { padding: 0; background: #fff; min-height: 0; }
  .tr-doc { gap: 0; display: block; overflow: visible; }
  .tr-sheet { box-shadow: none; width: 210mm; height: 297mm; min-height: 0; overflow: hidden; break-after: page; }
  .tr-sheet:last-child { break-after: auto; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;
