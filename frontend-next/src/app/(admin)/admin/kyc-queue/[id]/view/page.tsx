"use client";

import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAdminKYCDetail } from "@/hooks/use-frontend-data";
import { useState } from "react";
import MediaViewer from "@/components/ui/MediaViewer";

const BLUE = "#14784a";
const GREEN = "#1f9960";
const RED = "#d42f2f";

function Field({ label, value, mono, span }: { label: string; value: React.ReactNode; mono?: boolean; span?: boolean }) {
  return (
    <div style={span ? { gridColumn: "1 / -1" } : {}}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#6e7872", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, color: "#15201a", fontFamily: mono ? "monospace" : undefined }}>{value ?? "—"}</div>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string; border: string }> = {
    SUBMITTED: { color: BLUE,    bg: "#e8f2ed", border: "rgba(20,120,74,0.2)" },
    REVIEWING: { color: "#e8650f", bg: "#fdf0e7", border: "rgba(232,101,15,0.25)" },
    APPROVED:  { color: GREEN,   bg: "#e9f5ef", border: "rgba(31,153,96,0.25)" },
    REJECTED:  { color: RED,     bg: "#fdecec",  border: "rgba(239,68,68,0.25)" },
  };
  const s = map[status] ?? map.SUBMITTED;
  return <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", padding: "4px 12px", borderRadius: 20, color: s.color, background: s.bg, border: `1px solid ${s.border}` }}>{status}</span>;
}

export default function KYCViewPage() {
  const params = useParams();
  const router = useRouter();
  const submissionId = Array.isArray(params?.id) ? parseInt(params.id[0]) : parseInt(params?.id as string);
  const { data: submission, isLoading, error } = useAdminKYCDetail(submissionId);

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, border: `2px solid ${BLUE}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>😕</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#15201a", marginBottom: 8 }}>KYC submission not found</div>
          <button onClick={() => router.back()} style={{ padding: "9px 20px", borderRadius: 9, border: "none", background: `${BLUE}`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Go back</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", padding: "28px clamp(16px,4vw,48px)" }}>
      <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => router.back()} style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid rgba(21,32,26,0.1)", background: "rgba(21,32,26,0.04)", color: "#56625b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>←</button>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#15201a", letterSpacing: "-0.03em" }}>KYC Submission #{submissionId}</div>
            <StatusChip status={submission.status} />
          </div>
        </motion.div>

        <div style={{ background: "#ffffff", border: "1px solid rgba(21,32,26,0.07)", borderRadius: 16, padding: "24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <Field label="Name" value={submission.user_name ?? `User #${submission.user_id}`} />
            <Field label="Email" value={submission.user_email ?? "—"} />
            <Field label="Document Type" value={submission.document_type} />
            <Field label="Status" value={<StatusChip status={submission.status} />} />
            <Field label="Submitted At" value={new Date(submission.created_at).toLocaleString()} />
            {submission.reviewed_at && (
              <>
                <Field label="Reviewed At" value={new Date(submission.reviewed_at).toLocaleString()} />
                <Field label="Reviewed By (Admin ID)" value={`#${submission.reviewed_by_admin_id}`} />
              </>
            )}
            <Field label="Document" span value={
              submission.document_file_url
                ? <DocumentLink url={submission.document_file_url} />
                : "No document uploaded"
            } />
            {submission.rejection_reason && (
              <Field label="Rejection Reason" span value={
                <div style={{ padding: "12px 16px", borderRadius: 9, background: "#fef4f4", border: "1px solid rgba(239,68,68,0.15)", color: "#b42323", fontSize: 13, lineHeight: 1.6 }}>
                  {submission.rejection_reason}
                </div>
              } />
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => router.push(`/admin/kyc-queue/${submission.id}/review`)} style={{ padding: "10px 20px", borderRadius: 9, border: "none", background: `${BLUE}`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Review Submission</button>
          <button onClick={() => router.back()} style={{ padding: "10px 20px", borderRadius: 9, border: "1px solid rgba(21,32,26,0.1)", background: "#fff", color: "#56625b", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Back</button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function DocumentLink({ url }: { url: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [src, setSrc] = useState<string | null>(null);

  const onOpen = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ url });
      const res = await fetch(`/api/backend/media/presign?${q.toString()}`);
      if (!res.ok) throw new Error("presign failed");
      const body = await res.json();
      setSrc(body.url);
      setOpen(true);
    } catch (e) {
      // fallback to original url
      setSrc(url);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const onClose = () => {
    setOpen(false);
    setSrc(null);
  };

  return (
    <>
      <button onClick={onOpen} disabled={loading} style={{ color: BLUE, fontWeight: 600, textDecoration: "none", background: "transparent", border: "none", padding: 0, cursor: "pointer" }}>{loading ? "Loading…" : "View Document"}</button>
      {open && src && <MediaViewer src={src} type={guessMime(src)} onClose={onClose} />}
    </>
  );
}

function guessMime(url: string) {
  const lower = url.split("?")[0].toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.match(/\.(jpg|jpeg|png|gif|webp)$/)) return "image/" + lower.split('.').pop();
  return "";
}
