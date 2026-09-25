"use client";

import { useCampaignClassBoard, useCampaignSpending } from "@/hooks/use-frontend-data";

const BLUE = "#14784a";
const GREEN = "#1f9960";

const card: React.CSSProperties = { background: "#fff", border: "1px solid rgba(21,32,26,0.07)", borderRadius: 16, padding: "18px 20px" };
const heading: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: "#15201a" };

function gmd(value: number) {
  return `${Math.round(value).toLocaleString()} GMD`;
}

/** "D X withdrawn · D Y shown with receipts" — hidden until money has been withdrawn. */
export function SpendingStrip({ slug }: { slug: string }) {
  const { data } = useCampaignSpending(slug);
  if (!data || data.withdrawn <= 0) return null;
  const pct = Math.min(100, Math.round((data.accounted_for / data.withdrawn) * 100));
  const complete = data.unaccounted <= 0;

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div style={heading}>Where the money went</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: complete ? GREEN : "#b9500b" }}>
          {complete ? "Fully shown with receipts" : `${pct}% shown with receipts`}
        </div>
      </div>
      <div style={{ height: 8, borderRadius: 8, background: "rgba(21,32,26,0.06)", overflow: "hidden", margin: "12px 0 10px" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: complete ? GREEN : BLUE }} />
      </div>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 12, color: "#626d66" }}>
        <span><strong style={{ color: "#15201a" }}>{gmd(data.withdrawn)}</strong> withdrawn</span>
        <span><strong style={{ color: "#15201a" }}>{gmd(data.accounted_for)}</strong> shown in updates with receipts</span>
      </div>
    </div>
  );
}

/** Giving by graduating class — the alumni leaderboard. */
export function ClassBoardCard({ slug }: { slug: string }) {
  const { data } = useCampaignClassBoard(slug);
  if (!data?.enabled) return null;
  const top = data.classes.slice(0, 10);
  const max = top[0]?.total ?? 0;

  return (
    <div style={card}>
      <div style={heading}>Giving by graduating class</div>
      <div style={{ fontSize: 12, color: "#626d66", marginTop: 3, marginBottom: 14 }}>
        {top.length === 0 ? "Be the first: add your class when you donate." : "Add your class when you donate to move it up."}
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {top.map((row, i) => (
          <div key={row.graduating_class} style={{ display: "grid", gridTemplateColumns: "28px 92px 1fr auto", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: i === 0 ? "#b9500b" : "#6e7872" }}>#{i + 1}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#15201a" }}>Class of {row.graduating_class}</span>
            <div style={{ height: 8, borderRadius: 8, background: "rgba(21,32,26,0.06)", overflow: "hidden" }}>
              <div style={{ width: `${max ? Math.max(4, (row.total / max) * 100) : 0}%`, height: "100%", background: i === 0 ? "#e8650f" : BLUE }} />
            </div>
            <span style={{ fontSize: 12, color: "#56625b", whiteSpace: "nowrap" }}>
              {gmd(row.total)} · {row.donors} {row.donors === 1 ? "donor" : "donors"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
