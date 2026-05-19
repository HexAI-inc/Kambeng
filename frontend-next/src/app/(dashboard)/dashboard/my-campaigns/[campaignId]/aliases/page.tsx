"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { useCampaignAliases, useCreateCampaignAlias, useDeleteCampaignAlias } from "@/hooks/use-frontend-data";
import { useAppFeedback } from "@/components/ui";

const BLUE = "#1dc5ff";

function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.38, delay, ease: "easeOut" as const },
  };
}

export default function CampaignAliasesPage() {
  const params = useParams();
  const campaignId = typeof params.campaignId === "string" ? parseInt(params.campaignId, 10) : null;
  const { data: aliases, isLoading } = useCampaignAliases(campaignId || undefined);
  const createAlias = useCreateCampaignAlias();
  const deleteAlias = useDeleteCampaignAlias();
  const { message } = useAppFeedback();
  const [shortCode, setShortCode] = useState("");

  if (campaignId === null) return <div style={{ color: "#f0f6ff", padding: 32 }}>Invalid campaign ID</div>;

  const origin = typeof window !== "undefined" ? window.location.origin : "kambeng.hexai.gm";

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shortCode.trim()) { message.error("Short code cannot be empty"); return; }
    if (!/^[a-z0-9-]+$/i.test(shortCode)) { message.error("Only letters, numbers, and hyphens allowed"); return; }
    try {
      await createAlias.mutateAsync({ campaignId, shortCode: shortCode.toLowerCase() });
      message.success("Short code created");
      setShortCode("");
    } catch (err: any) {
      message.error(err?.response?.data?.detail ?? "Failed to create short code");
    }
  };

  const handleDelete = async (aliasId: number, code: string) => {
    if (!window.confirm(`Delete short code "${code}"? Existing links will break.`)) return;
    try {
      await deleteAlias.mutateAsync({ campaignId, aliasId });
      message.success("Short code deleted");
    } catch {
      message.error("Failed to delete short code");
    }
  };

  const copy = (text: string) => { navigator.clipboard.writeText(text); message.success("Copied"); };

  return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", padding: "28px clamp(16px, 4vw, 48px)" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Header */}
        <motion.div {...fadeUp(0)}>
          <Link href="/dashboard/my-campaigns" style={{ fontSize: 12, color: "#4a5568", display: "inline-block", marginBottom: 8 }}>← My Campaigns</Link>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.03em", marginBottom: 4 }}>Short Codes</div>
          <div style={{ fontSize: 13, color: "#6b7a8d" }}>Create memorable short links for easy sharing on social media.</div>
        </motion.div>

        {/* Create form */}
        <motion.div {...fadeUp(0.06)}>
          <form onSubmit={(e) => void handleCreate(e)}>
            <div style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "22px" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#f0f6ff", marginBottom: 4 }}>Create Short Code</div>
              <div style={{ fontSize: 13, color: "#6b7a8d", marginBottom: 16 }}>
                Makes your campaign URL easier to share — e.g. <span style={{ color: BLUE, fontFamily: "monospace" }}>{origin}/c/yourcode</span>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
                <div style={{
                  display: "flex", alignItems: "center",
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8, overflow: "hidden", flex: 1,
                }}>
                  <span style={{ padding: "10px 12px", fontSize: 12, color: "#4a5568", fontFamily: "monospace", whiteSpace: "nowrap", borderRight: "1px solid rgba(255,255,255,0.07)" }}>
                    /c/
                  </span>
                  <input
                    value={shortCode}
                    onChange={(e) => setShortCode(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                    placeholder="my-campaign"
                    maxLength={50}
                    style={{
                      flex: 1, padding: "10px 12px", background: "transparent", border: "none",
                      color: "#f0f6ff", fontSize: 13, outline: "none", fontFamily: "monospace",
                    }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!shortCode.trim() || createAlias.isPending}
                  style={{
                    padding: "10px 20px", borderRadius: 8, border: "none", flexShrink: 0,
                    background: shortCode.trim() ? `linear-gradient(135deg, ${BLUE}, #079bd4)` : "rgba(255,255,255,0.06)",
                    color: shortCode.trim() ? "#fff" : "#4a5568",
                    fontSize: 13, fontWeight: 700, cursor: shortCode.trim() ? "pointer" : "not-allowed",
                    boxShadow: shortCode.trim() ? "0 2px 12px rgba(29,197,255,0.3)" : "none",
                  }}
                >
                  {createAlias.isPending ? "Creating…" : "Create"}
                </button>
              </div>
              <div style={{ fontSize: 11, color: "#4a5568", marginTop: 8 }}>Letters, numbers, and hyphens only</div>
            </div>
          </form>
        </motion.div>

        {/* Aliases list */}
        <motion.div {...fadeUp(0.12)}>
          <div style={{ fontSize: 11, color: "#4a5568", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 12 }}>
            {isLoading ? "Loading…" : `${aliases?.length ?? 0} short code${aliases?.length !== 1 ? "s" : ""}`}
          </div>

          {isLoading ? (
            <div style={{ height: 80, borderRadius: 12, background: "rgba(255,255,255,0.04)" }} />
          ) : !aliases || aliases.length === 0 ? (
            <div style={{
              padding: "36px 24px", textAlign: "center",
              background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 14,
            }}>
              <div style={{ fontSize: 13, color: "#4a5568" }}>No short codes yet — create your first one above.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {aliases.map((alias) => (
                <div key={alias.id} style={{
                  background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 12, padding: "14px 16px",
                  display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, color: "#4a5568", fontFamily: "monospace" }}>{origin}/c/</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: BLUE, fontFamily: "monospace" }}>{alias.short_code}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#4a5568" }}>
                      Created {new Date(alias.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => copy(`${origin}/c/${alias.short_code}`)}
                      style={{
                        padding: "6px 14px", borderRadius: 7,
                        border: "1px solid rgba(29,197,255,0.25)", background: "rgba(29,197,255,0.08)",
                        color: BLUE, fontSize: 11, fontWeight: 700, cursor: "pointer",
                      }}
                    >Copy</button>
                    <button
                      onClick={() => void handleDelete(alias.id, alias.short_code)}
                      disabled={deleteAlias.isPending}
                      style={{
                        padding: "6px 14px", borderRadius: 7,
                        border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.08)",
                        color: "#ef4444", fontSize: 11, fontWeight: 700, cursor: "pointer",
                      }}
                    >Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Warning note */}
        <motion.div {...fadeUp(0.18)} style={{
          padding: "12px 16px", borderRadius: 10,
          background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)",
          display: "flex", gap: 10, alignItems: "flex-start",
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#fbbf24" strokeWidth="1.8"/>
            <path d="M12 9v4M12 17h.01" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <div style={{ fontSize: 12, color: "#6b7a8d", lineHeight: 1.65 }}>
            <span style={{ color: "#fbbf24", fontWeight: 600 }}>Deleting a short code breaks existing links</span> — anyone who saved or shared that URL will get a 404. Each code must be unique across all campaigns.
          </div>
        </motion.div>
      </div>
    </div>
  );
}
