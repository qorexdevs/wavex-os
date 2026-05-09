/** Pillar 4 — GTM Motion. Op-omega upstream contract:
 *  Input  : { companyId, lead_sources[1..3], sales_motion, close_channel?, *_other? }
 *  Output : Pillar4Response with derived gtm_profile_enum */

import { useState } from "react";
import { opOmegaOnboardingApi, ApiError } from "../lib/api";
import type { Pillar4Response, LeadSource, SalesMotion, CloseChannel } from "@op-omega/plugin-onboarding";
import { Card, Field, H2, NavRow, P } from "../components/primitives";

const LEAD_SOURCES: Array<{ value: LeadSource; label: string }> = [
  { value: "inbound_ads_meta_google", label: "Inbound ads (Meta / Google)" },
  { value: "outbound_cold", label: "Outbound cold" },
  { value: "referral_word_of_mouth", label: "Referral / word-of-mouth" },
  { value: "content_seo", label: "Content / SEO" },
  { value: "product_led_viral", label: "Product-led / viral" },
  { value: "partnerships", label: "Partnerships" },
  { value: "events", label: "Events" },
  { value: "none_yet", label: "None yet" },
  { value: "other", label: "Other" },
];

const SALES_MOTIONS: Array<{ value: SalesMotion; label: string }> = [
  { value: "self_serve_plg", label: "Self-serve / PLG" },
  { value: "assisted_demo", label: "Assisted demo" },
  { value: "high_touch_enterprise", label: "High-touch enterprise" },
  { value: "none_yet", label: "None yet" },
  { value: "other", label: "Other" },
];

const CLOSE_CHANNELS: Array<{ value: CloseChannel; label: string }> = [
  { value: "mostly_phone_video", label: "Mostly phone / video" },
  { value: "mostly_email_text", label: "Mostly email / text" },
  { value: "mixed", label: "Mixed" },
  { value: "other", label: "Other" },
];

interface Props {
  companyId: string;
  initial: Pillar4Response | undefined;
  onComplete: () => void;
}

export function Pillar4({ companyId, initial, onComplete }: Props) {
  const [leadSources, setLeadSources] = useState<LeadSource[]>(initial?.lead_sources ?? ["referral_word_of_mouth"]);
  const [leadSourceOther, setLeadSourceOther] = useState(initial?.lead_source_other ?? "");
  const [salesMotion, setSalesMotion] = useState<SalesMotion>(initial?.sales_motion ?? "assisted_demo");
  const [salesMotionOther, setSalesMotionOther] = useState(initial?.sales_motion_other ?? "");
  const [closeChannel, setCloseChannel] = useState<CloseChannel | "">(initial?.close_channel ?? "");
  const [closeChannelOther, setCloseChannelOther] = useState(initial?.close_channel_other ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Pillar4Response | undefined>(initial);

  function toggleLeadSource(v: LeadSource): void {
    setLeadSources((prev) => {
      if (prev.includes(v)) return prev.filter((x) => x !== v);
      if (prev.length >= 3) return prev;
      return [...prev, v];
    });
  }

  async function submit(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const r = await opOmegaOnboardingApi.pillar4({
        companyId,
        lead_sources: leadSources,
        lead_source_other: leadSources.includes("other") && leadSourceOther.trim().length >= 40 ? leadSourceOther : undefined,
        sales_motion: salesMotion,
        sales_motion_other: salesMotion === "other" && salesMotionOther.trim().length >= 40 ? salesMotionOther : undefined,
        close_channel: closeChannel || undefined,
        close_channel_other: closeChannel === "other" && closeChannelOther.trim().length >= 40 ? closeChannelOther : undefined,
      });
      setResult(r.response);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = leadSources.length >= 1 && !busy
    && (!leadSources.includes("other") || leadSourceOther.trim().length >= 40)
    && (salesMotion !== "other" || salesMotionOther.trim().length >= 40);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "2rem" }}>
      <H2>Pillar 4 — GTM Motion</H2>
      <P>
        Where do leads come from, how do you close them, and on what channel?
        These choices derive your <code>gtm_profile_enum</code> which drives
        the swarm's go-to-market activation rules.
      </P>

      {error && <Card><p style={{ color: "var(--warning)", margin: 0 }}>✗ {error}</p></Card>}

      <Card>
        <Field label={`Lead sources (1–3) — ${leadSources.length} selected`} required>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
            {LEAD_SOURCES.map((s) => (
              <label key={s.value} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", opacity: !leadSources.includes(s.value) && leadSources.length >= 3 ? 0.4 : 1 }}>
                <input type="checkbox" checked={leadSources.includes(s.value)} onChange={() => toggleLeadSource(s.value)} />
                {s.label}
              </label>
            ))}
          </div>
        </Field>
        {leadSources.includes("other") && (
          <Field label="Describe other lead source (≥40 chars)">
            <textarea value={leadSourceOther} onChange={(e) => setLeadSourceOther(e.target.value)} rows={2} />
          </Field>
        )}

        <Field label="Sales motion" required>
          <select value={salesMotion} onChange={(e) => setSalesMotion(e.target.value as SalesMotion)}>
            {SALES_MOTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Field>
        {salesMotion === "other" && (
          <Field label="Describe sales motion (≥40 chars)">
            <textarea value={salesMotionOther} onChange={(e) => setSalesMotionOther(e.target.value)} rows={2} />
          </Field>
        )}

        <Field label="Close channel (optional)">
          <select value={closeChannel} onChange={(e) => setCloseChannel(e.target.value as CloseChannel | "")}>
            <option value="">— skip —</option>
            {CLOSE_CHANNELS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Field>
        {closeChannel === "other" && (
          <Field label="Describe close channel (≥40 chars)">
            <textarea value={closeChannelOther} onChange={(e) => setCloseChannelOther(e.target.value)} rows={2} />
          </Field>
        )}

        {result && (
          <div style={{ marginTop: "1rem", padding: "0.75rem", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 4, fontSize: 13 }}>
            <div className="text-dim" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
              GTM PROFILE DERIVED
            </div>
            <code>{result.gtm_profile_enum}</code>
          </div>
        )}
      </Card>

      <NavRow
        next={result
          ? { onClick: onComplete, label: "Continue →" }
          : { onClick: submit, label: busy ? "Saving…" : "Save →" }}
        nextDisabled={!result && !canSubmit}
      />
    </div>
  );
}
