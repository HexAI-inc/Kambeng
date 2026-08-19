"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { isAxiosError } from "axios";

import { api } from "@/lib/api";
import { StyledSelect } from "@/components/ui/styled-select";

const BLUE = "#1dc5ff";
const GREEN = "#1bbf88";
const RED = "#ef4444";
const AMBER = "#f59e0b";

const PROMO_TYPES = [
  { value: "campaign_fee_waiver", label: "Campaign fee waiver" },
  { value: "milestone_completion_rebate", label: "Milestone completion rebate" },
  { value: "transparency_rebate", label: "Transparency rebate" },
  { value: "donor_fee_free_day", label: "Donor fee-free day" },
  { value: "matched_donation", label: "Matched donation" },
  { value: "first_donation_bonus", label: "First donation bonus" },
  { value: "organiser_referral", label: "Organiser referral reward" },
  { value: "ngo_onboarding", label: "NGO onboarding" },
  { value: "diaspora_first_donation", label: "Diaspora first donation" },
];

const SELF_LIMITING = new Set(["organiser_referral", "ngo_onboarding"]);
const NEEDS_WAIVER_PCT = new Set(["campaign_fee_waiver", "ngo_onboarding", "organiser_referral"]);
const NEEDS_REBATE_PCT = new Set(["milestone_completion_rebate", "transparency_rebate"]);

type Promotion = {
  id: number;
  slug: string;
  name: string;
  promo_type: string;
  description: string | null;
  fee_waiver_pct: number | null;
  rebate_pct: number | null;
  match_pool_total: number | null;
  match_pool_remaining: number | null;
  match_ratio: number | null;
  max_campaigns: number | null;
  campaigns_used: number;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  total_fee_waived: number;
};

type PromoApplication = {
  id: number;
  campaign_id: number | null;
  campaign_title: string | null;
  donation_id: number | null;
  payout_id: number | null;
  fee_waived_amount: number;
  match_contributed_amount: number | null;
  reversed: boolean;
  applied_at: string;
};

function getServerErrorMessage(error: unknown) {
  if (!isAxiosError(error)) return "Server error";
  const detail = (error.response?.data as { detail?: string } | undefined)?.detail;
  return typeof detail === "string" && detail.trim() ? detail : "Server error";
}

function fadeUp(delay = 0) {
  return { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35, delay, ease: "easeOut" as const } };
}

function statusOf(promo: Promotion): { label: string; color: string } {
  if (!promo.is_active) return { label: "Off", color: "#8899aa" };
  const now = Date.now();
  if (new Date(promo.starts_at).getTime() > now) return { label: "Scheduled", color: AMBER };
  if (promo.ends_at && new Date(promo.ends_at).getTime() < now) return { label: "Ended", color: "#8899aa" };
  return { label: "Active", color: GREEN };
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 13px", borderRadius: 9, boxSizing: "border-box",
  border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)",
  color: "#f0f6ff", fontSize: 13, outline: "none",
};

const labelStyle: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 600, color: "#8899aa", marginBottom: 5 };

export default function AdminPromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [applications, setApplications] = useState<PromoApplication[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [assignCampaignId, setAssignCampaignId] = useState("");
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignResult, setAssignResult] = useState<string | null>(null);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    slug: "", name: "", promo_type: "campaign_fee_waiver", description: "",
    fee_waiver_pct: "", rebate_pct: "", match_pool_total: "", match_ratio: "",
    max_campaigns: "", ends_at: "",
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadPromotions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<{ total: number; items: Promotion[] }>("/admin/promotions");
      setPromotions(response.data.items);
      setError(null);
    } catch (err) {
      setError(getServerErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPromotions(); }, [loadPromotions]);

  const toggleExpand = async (promo: Promotion) => {
    if (expandedId === promo.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(promo.id);
    setAssignResult(null);
    setApplicationsLoading(true);
    try {
      const response = await api.get<{ total: number; items: PromoApplication[] }>(`/admin/promotions/${promo.id}/applications`);
      setApplications(response.data.items);
    } catch {
      setApplications([]);
    } finally {
      setApplicationsLoading(false);
    }
  };

  const toggleActive = async (promo: Promotion) => {
    try {
      await api.patch(`/admin/promotions/${promo.id}`, { is_active: !promo.is_active });
      await loadPromotions();
    } catch (err) {
      setError(getServerErrorMessage(err));
    }
  };

  const assignToCampaign = async (promo: Promotion) => {
    const campaignId = parseInt(assignCampaignId, 10);
    if (!campaignId) return;
    setAssignBusy(true);
    setAssignResult(null);
    try {
      await api.post(`/admin/campaigns/${campaignId}/assign-promo`, { promotion_id: promo.id });
      setAssignResult(`Assigned to campaign #${campaignId}.`);
      setAssignCampaignId("");
      await loadPromotions();
    } catch (err) {
      setAssignResult(`Error: ${getServerErrorMessage(err)}`);
    } finally {
      setAssignBusy(false);
    }
  };

  const createPromotion = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const payload: Record<string, unknown> = {
        slug: form.slug.trim(),
        name: form.name.trim(),
        promo_type: form.promo_type,
        description: form.description.trim() || null,
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      };
      if (NEEDS_WAIVER_PCT.has(form.promo_type)) payload.fee_waiver_pct = form.fee_waiver_pct ? Number(form.fee_waiver_pct) : null;
      if (NEEDS_REBATE_PCT.has(form.promo_type)) payload.rebate_pct = form.rebate_pct ? Number(form.rebate_pct) : null;
      if (form.promo_type === "matched_donation") {
        payload.match_pool_total = form.match_pool_total ? Number(form.match_pool_total) : null;
        payload.match_ratio = form.match_ratio ? Number(form.match_ratio) : null;
      }
      if (form.max_campaigns) payload.max_campaigns = Number(form.max_campaigns);

      await api.post("/admin/promotions", payload);
      setShowCreate(false);
      setForm({ slug: "", name: "", promo_type: "campaign_fee_waiver", description: "", fee_waiver_pct: "", rebate_pct: "", match_pool_total: "", match_ratio: "", max_campaigns: "", ends_at: "" });
      await loadPromotions();
    } catch (err) {
      setCreateError(getServerErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const canCreate = form.slug.trim().length >= 3 && form.name.trim().length >= 3 && (SELF_LIMITING.has(form.promo_type) || form.ends_at);

  return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", padding: "28px clamp(16px,4vw,48px)" }}>
    <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
      <motion.div {...fadeUp(0)} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 900, color: "#f0f6ff", letterSpacing: "-0.03em" }}>Promotions</h1>
          <p style={{ margin: 0, fontSize: 13, color: "#8899aa" }}>
            Fee waivers, rebates, matched donations, and the organiser referral reward — one engine, configured as rows.
          </p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${BLUE}, #079bd4)`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          {showCreate ? "Cancel" : "+ New promotion"}
        </button>
      </motion.div>

      {error && (
        <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: RED, fontSize: 13 }}>{error}</div>
      )}

      {showCreate && (
        <motion.div {...fadeUp(0.05)} style={{ background: "#0d1120", border: "1px solid rgba(29,197,255,0.18)", borderRadius: 14, padding: 20 }}>
          <div className="promo-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Slug</label>
              <input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder="founding-campaigns-2026" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Display name</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Founding Campaigns" style={inputStyle} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Type</label>
            <StyledSelect
              value={form.promo_type}
              onChange={(v) => setForm((f) => ({ ...f, promo_type: v }))}
              options={PROMO_TYPES}
              style={{ width: "100%" }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Description (optional)</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
          </div>

          <div className="promo-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            {NEEDS_WAIVER_PCT.has(form.promo_type) && (
              <div>
                <label style={labelStyle}>Fee waiver % (0-100)</label>
                <input type="number" min={0} max={100} value={form.fee_waiver_pct} onChange={(e) => setForm((f) => ({ ...f, fee_waiver_pct: e.target.value }))} placeholder="100" style={inputStyle} />
              </div>
            )}
            {NEEDS_REBATE_PCT.has(form.promo_type) && (
              <div>
                <label style={labelStyle}>Rebate % (0-100)</label>
                <input type="number" min={0} max={100} value={form.rebate_pct} onChange={(e) => setForm((f) => ({ ...f, rebate_pct: e.target.value }))} placeholder="50" style={inputStyle} />
              </div>
            )}
            {form.promo_type === "matched_donation" && (
              <>
                <div>
                  <label style={labelStyle}>Match pool total (GMD)</label>
                  <input type="number" min={0} value={form.match_pool_total} onChange={(e) => setForm((f) => ({ ...f, match_pool_total: e.target.value }))} placeholder="10000" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Match ratio (1.0 = 100%)</label>
                  <input type="number" min={0} step="0.1" value={form.match_ratio} onChange={(e) => setForm((f) => ({ ...f, match_ratio: e.target.value }))} placeholder="1.0" style={inputStyle} />
                </div>
              </>
            )}
            <div>
              <label style={labelStyle}>Max campaigns (optional)</label>
              <input type="number" min={1} value={form.max_campaigns} onChange={(e) => setForm((f) => ({ ...f, max_campaigns: e.target.value }))} placeholder="20" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>
                Ends {SELF_LIMITING.has(form.promo_type) ? "(optional — self-limiting)" : "(required)"}
              </label>
              <input type="datetime-local" value={form.ends_at} onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))} style={inputStyle} />
            </div>
          </div>

          {createError && <div style={{ marginBottom: 10, fontSize: 12, color: RED }}>{createError}</div>}
          <button
            onClick={createPromotion}
            disabled={creating || !canCreate}
            style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${BLUE}, #079bd4)`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: creating || !canCreate ? 0.5 : 1 }}
          >
            {creating ? "Creating…" : "Create promotion"}
          </button>
        </motion.div>
      )}

      {loading ? (
        <div style={{ padding: "32px 0", textAlign: "center", color: "#4a5568", fontSize: 13 }}>Loading…</div>
      ) : promotions.length === 0 ? (
        <div style={{ padding: "32px 0", textAlign: "center", color: "#4a5568", fontSize: 13 }}>No promotions yet — create one above.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {promotions.map((promo) => {
            const status = statusOf(promo);
            const typeLabel = PROMO_TYPES.find((t) => t.value === promo.promo_type)?.label ?? promo.promo_type;
            return (
              <motion.div key={promo.id} {...fadeUp(0.02)} style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden" }}>
                <div
                  onClick={() => toggleExpand(promo)}
                  style={{ padding: "16px 18px", cursor: "pointer", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}
                >
                  <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#f0f6ff" }}>{promo.name}</div>
                    <div style={{ fontSize: 11, color: "#4a5568", marginTop: 2 }}>{typeLabel} · {promo.slug}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 20, color: status.color, background: `${status.color}18`, border: `1px solid ${status.color}35` }}>
                    {status.label}
                  </span>
                  {promo.max_campaigns != null && (
                    <span style={{ fontSize: 11, color: "#8899aa" }}>{promo.campaigns_used} / {promo.max_campaigns} campaigns</span>
                  )}
                  {promo.match_pool_total != null && (
                    <span style={{ fontSize: 11, color: "#8899aa" }}>{promo.match_pool_remaining?.toLocaleString()} / {promo.match_pool_total.toLocaleString()} GMD pool</span>
                  )}
                  <span style={{ fontSize: 12, fontWeight: 700, color: GREEN }}>{promo.total_fee_waived.toLocaleString()} GMD waived</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleActive(promo); }}
                    style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.14)", background: promo.is_active ? "rgba(239,68,68,0.1)" : "rgba(27,191,136,0.1)", color: promo.is_active ? RED : GREEN, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                  >
                    {promo.is_active ? "Turn off" : "Turn on"}
                  </button>
                </div>

                {expandedId === promo.id && (
                  <div style={{ padding: "0 18px 18px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ paddingTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
                      <input
                        value={assignCampaignId}
                        onChange={(e) => setAssignCampaignId(e.target.value)}
                        placeholder="Campaign ID"
                        style={{ ...inputStyle, width: 140 }}
                      />
                      <button
                        onClick={() => assignToCampaign(promo)}
                        disabled={assignBusy || !assignCampaignId.trim()}
                        style={{ padding: "9px 16px", borderRadius: 9, border: "none", background: `${BLUE}20`, color: BLUE, fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: assignBusy || !assignCampaignId.trim() ? 0.5 : 1 }}
                      >
                        Assign campaign
                      </button>
                      {assignResult && (
                        <span style={{ fontSize: 12, color: assignResult.startsWith("Error") ? RED : GREEN }}>{assignResult}</span>
                      )}
                    </div>

                    <div style={{ fontSize: 12, fontWeight: 700, color: "#f0f6ff", marginBottom: 8 }}>Applications</div>
                    {applicationsLoading ? (
                      <div style={{ fontSize: 12, color: "#4a5568" }}>Loading…</div>
                    ) : applications.length === 0 ? (
                      <div style={{ fontSize: 12, color: "#4a5568" }}>No applications yet.</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {applications.map((app) => (
                          <div key={app.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                            <span style={{ color: "#c0ccd8" }}>
                              {app.campaign_title ?? `Campaign #${app.campaign_id ?? "—"}`}
                              {app.reversed && <span style={{ color: RED, marginLeft: 8 }}>(reversed)</span>}
                            </span>
                            <span style={{ color: GREEN, fontWeight: 600 }}>
                              {app.fee_waived_amount > 0 && `${app.fee_waived_amount.toLocaleString()} GMD waived`}
                              {app.match_contributed_amount ? ` · ${app.match_contributed_amount.toLocaleString()} GMD matched` : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      <style>{`
        @media (max-width: 700px) {
          .promo-form-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
    </div>
  );
}
