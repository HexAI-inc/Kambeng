"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

import { useAdminOrgVerificationQueue } from "@/hooks/use-frontend-data";
import { organizationLocation, organizationTypeLabel } from "@/lib/organizations";
import { OrgStatusChip } from "@/components/campaigns/organization-badge";

const BLUE = "#14784a";
const GREEN = "#1f9960";

const FILTERS = [
  { value: undefined, label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ALL", label: "All" },
];

function fadeUp(delay = 0) {
  return { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35, delay, ease: "easeOut" as const } };
}

export default function OrgVerificationQueuePage() {
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const { data, isLoading } = useAdminOrgVerificationQueue(filter);
  const rows = data ?? [];

  return (
    <div style={{ minHeight: "100vh", padding: "28px clamp(16px,4vw,48px)" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
        <motion.div {...fadeUp(0)}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#15201a", letterSpacing: "-0.03em" }}>Organization verification</div>
          <div style={{ fontSize: 13, color: "#626d66", marginTop: 4, maxWidth: 640, lineHeight: 1.6 }}>
            Evidence that a representative may raise money for an organization, plus where its payouts go.
            Withdrawals from organization campaigns need this and the representative&apos;s own KYC.
          </div>
        </motion.div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {FILTERS.map((f) => {
            const active = filter === f.value;
            return (
              <button key={f.label} onClick={() => setFilter(f.value)} aria-pressed={active} style={{
                padding: "7px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                border: `1px solid ${active ? BLUE : "rgba(21,32,26,0.1)"}`,
                background: active ? BLUE : "#fff", color: active ? "#fff" : "#56625b",
              }}>{f.label}</button>
            );
          })}
        </div>

        <motion.div {...fadeUp(0.06)} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {isLoading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#6e7872", fontSize: 13 }}>Loading…</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: "48px 24px", textAlign: "center", color: "#6e7872", fontSize: 14, background: "#fff", borderRadius: 14, border: "1px solid rgba(21,32,26,0.07)" }}>
              Nothing here
            </div>
          ) : rows.map((row) => {
            const location = organizationLocation(row.organization);
            return (
              <Link key={row.id} href={`/admin/org-verifications/${row.id}`} style={{ textDecoration: "none" }}>
                <div style={{
                  display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap",
                  padding: "14px 18px", borderRadius: 14, background: "#fff",
                  border: "1px solid rgba(21,32,26,0.07)",
                  borderLeft: `3px solid ${row.status === "SUBMITTED" || row.status === "REVIEWING" ? BLUE : "transparent"}`,
                }}>
                  <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#15201a" }}>{row.organization.name}</div>
                    <div style={{ fontSize: 12, color: "#6e7872" }}>
                      {organizationTypeLabel(row.organization.org_type)}{location ? ` · ${location}` : ""}
                    </div>
                  </div>
                  <div style={{ flex: "1 1 180px", minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: "#15201a", fontWeight: 600 }}>{row.submitter_name ?? `User #${row.submitted_by_user_id}`}</div>
                    <div style={{ fontSize: 11, color: "#6e7872" }}>
                      KYC: <span style={{ color: row.submitter_kyc_status === "APPROVED" ? GREEN : "#b9500b", fontWeight: 700 }}>{row.submitter_kyc_status ?? "—"}</span>
                    </div>
                  </div>
                  <div style={{ flex: "0 0 150px", fontSize: 12, color: "#56625b" }}>
                    {row.evidence_type === "AUTHORIZATION_LETTER" ? "Authorization letter" : "Registration certificate"}
                    <div style={{ fontSize: 11, color: "#6e7872" }}>
                      {new Date(row.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </div>
                  </div>
                  <OrgStatusChip status={row.status} />
                </div>
              </Link>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
