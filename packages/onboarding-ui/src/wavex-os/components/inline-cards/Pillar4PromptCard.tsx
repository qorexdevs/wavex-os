/** Inline prompt card for Pillar 4 — GTM motion (lead sources, sales motion,
 *  conditional close channel). */

import { useEffect, useState } from "react";
import type { Pillar4Response, LeadSource, SalesMotion, CloseChannel } from "@wavex-os/plugin-onboarding";
import { wavexOsOnboardingApi, ApiError } from "../../lib/api";
import { ResponseChips } from "../ResponseChips";
import { LEAD_SOURCES, SALES_MOTIONS, CLOSE_CHANNELS } from "../../lib/options";
import { deriveGtmProfile, displayGtmProfile } from "../../lib/gtm-profile";
import { usePillarSuggestion } from "../../lib/use-pillar-suggestion";

const LEAD_OPTS = LEAD_SOURCES.filter((o) => o.v !== "other").map((o) => ({ value: o.v, label: o.l }));
const MOTION_OPTS = SALES_MOTIONS.filter((o) => o.v !== "other").map((o) => ({ value: o.v, label: o.l }));
const CLOSE_OPTS = CLOSE_CHANNELS.filter((o) => o.v !== "other").map((o) => ({ value: o.v, label: o.l }));

const MAX_LEAD_SOURCES = 3;

interface Props {
  companyId: string;
  onDone: (response: Pillar4Response) => void;
}

export function Pillar4PromptCard({ companyId, onDone }: Props) {
  const [leadsCanon, setLeadsCanon] = useState<string[]>([]);
  const [leadsCustom, setLeadsCustom] = useState<string[]>([]);
  const [motionCanon, setMotionCanon] = useState<string[]>([]);
  const [motionCustom, setMotionCustom] = useState<string[]>([]);
  const [closeCanon, setCloseCanon] = useState<string[]>([]);
  const [closeCustom, setCloseCustom] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inference-grounded suggestions from /pillar/4/suggest. Pre-fill the
  // primary lead source + sales motion when Claude has a confident pick;
  // operator can still add / remove freely. lead_sources is a ranked array.
  const suggestion = usePillarSuggestion(4, companyId);
  const suggestedLeads = (Array.isArray(suggestion.recommended.lead_sources)
    ? (suggestion.recommended.lead_sources as unknown[]).filter((v): v is string => typeof v === "string")
    : []);
  const suggestedMotion = typeof suggestion.recommended.sales_motion === "string"
    ? (suggestion.recommended.sales_motion as string)
    : null;

  useEffect(() => {
    if (!suggestion.loaded) return;
    if (leadsCanon.length > 0 || leadsCustom.length > 0) return;
    // Pre-fill up to the top 3 canonical leads.
    const canonicalSet = new Set<string>(LEAD_OPTS.map((o) => o.value));
    const initialLeads = suggestedLeads.filter((v) => canonicalSet.has(v)).slice(0, MAX_LEAD_SOURCES);
    if (initialLeads.length > 0) setLeadsCanon(initialLeads);
  }, [suggestion.loaded]);
  useEffect(() => {
    if (!suggestion.loaded) return;
    if (motionCanon.length > 0 || motionCustom.length > 0) return;
    if (suggestedMotion && MOTION_OPTS.some((o) => o.value === suggestedMotion)) {
      setMotionCanon([suggestedMotion]);
    }
  }, [suggestion.loaded, suggestedMotion]);

  const motionValue = motionCustom[0] ?? motionCanon[0] ?? "";
  const motionIsCustom = motionCustom.length > 0;
  const needsCloseChannel = motionValue === "assisted_demo" || motionValue === "high_touch_enterprise";
  const closeValue = closeCustom[0] ?? closeCanon[0] ?? "";
  const closeIsCustom = closeCustom.length > 0;

  const totalLeads = leadsCanon.length + leadsCustom.length;
  const ready = totalLeads > 0 && !!motionValue && (!needsCloseChannel || !!closeValue);

  async function handleSubmit(): Promise<void> {
    if (!ready) return;
    setSubmitting(true);
    setError(null);
    try {
      const canonicalLeads = leadsCanon as LeadSource[];
      const hasCustomLeads = leadsCustom.length > 0;
      const lead_sources: LeadSource[] = hasCustomLeads
        ? ([...canonicalLeads, "other"] as LeadSource[])
        : canonicalLeads;

      const result = await wavexOsOnboardingApi.pillar4({
        companyId,
        lead_sources: lead_sources.length > 0 ? lead_sources : ["other" as LeadSource],
        lead_source_other: hasCustomLeads ? leadsCustom.join(", ") : undefined,
        sales_motion: (motionIsCustom ? "other" : motionValue) as SalesMotion,
        sales_motion_other: motionIsCustom ? motionValue : undefined,
        close_channel: needsCloseChannel
          ? ((closeIsCustom ? "other" : closeValue) as CloseChannel)
          : undefined,
        close_channel_other: needsCloseChannel && closeIsCustom ? closeValue : undefined,
      });
      onDone(result.response);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.8rem" }}>
      {suggestion.loaded && suggestion.reasoning && (
        <div style={{
          padding: "0.4rem 0.6rem",
          background: "var(--bg)",
          border: "1px dashed var(--accent)",
          borderRadius: 6,
          fontSize: 11,
          color: "var(--text-dim)",
          lineHeight: 1.45,
        }}>
          <span style={{ color: "var(--accent)", fontWeight: 600 }}>✨ Suggested for you</span>
          {" — "}{suggestion.reasoning}
        </div>
      )}

      <div>
        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: "0.35rem", color: "var(--text-dim)" }}>
          Lead sources <span className="text-dim" style={{ fontWeight: 400 }}>(up to {MAX_LEAD_SOURCES}, primary first)</span>
        </div>
        <ResponseChips
          mode="multi"
          maxSelections={MAX_LEAD_SOURCES}
          options={LEAD_OPTS}
          values={leadsCanon}
          customValues={leadsCustom}
          allowCustom
          customLabel="Other source"
          onChange={setLeadsCanon}
          onCustomChange={setLeadsCustom}
          disabled={submitting}
          suggestedValues={suggestedLeads as readonly typeof LEAD_OPTS[number]["value"][]}
        />
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: "0.35rem", color: "var(--text-dim)" }}>
          How do they close?
        </div>
        <ResponseChips
          mode="single"
          options={MOTION_OPTS}
          values={motionCanon}
          customValues={motionCustom}
          allowCustom
          customLabel="Other motion"
          onChange={(v) => { setMotionCanon(v); setCloseCanon([]); setCloseCustom([]); }}
          onCustomChange={(v) => { setMotionCustom(v); setCloseCanon([]); setCloseCustom([]); }}
          disabled={submitting}
          suggestedValues={suggestedMotion ? [suggestedMotion as typeof MOTION_OPTS[number]["value"]] : []}
        />
      </div>

      {needsCloseChannel && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: "0.35rem", color: "var(--text-dim)" }}>
            Closing channel
          </div>
          <ResponseChips
            mode="single"
            options={CLOSE_OPTS}
            values={closeCanon}
            customValues={closeCustom}
            allowCustom
            customLabel="Other channel"
            onChange={setCloseCanon}
            onCustomChange={setCloseCustom}
            disabled={submitting}
          />
        </div>
      )}

      {/* Live GTM profile preview — derives the operator's go-to-market
       *  shape from lead_sources + sales_motion and names the primary
       *  agents that will activate. Display-only. */}
      {leadsCanon.length > 0 && motionValue && !motionIsCustom && (() => {
        const profile = deriveGtmProfile({ lead_sources: leadsCanon, sales_motion: motionValue });
        const display = displayGtmProfile(profile);
        return (
          <div style={{
            padding: "0.5rem 0.75rem",
            background: "var(--bg)",
            border: "1px solid var(--accent)",
            borderRadius: 6,
            fontSize: 11,
            color: "var(--text-dim)",
            lineHeight: 1.55,
          }}>
            <div style={{ fontWeight: 600, color: "var(--accent)", marginBottom: "0.2rem" }}>
              GTM profile · {display.name}
            </div>
            <div>Primary agents that activate: <span style={{ color: "var(--text)" }}>{display.primary_agents}</span></div>
          </div>
        );
      })()}

      {error && (
        <div style={{ color: "var(--warning)", fontSize: 12 }}>✗ {error}</div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          data-testid="pillar4-submit"
          onClick={() => void handleSubmit()}
          disabled={submitting || !ready}
          style={{
            padding: "0.4rem 0.85rem",
            borderRadius: 6,
            background: "var(--accent)",
            color: "var(--bg)",
            border: "none",
            fontWeight: 600,
            fontSize: 12,
            cursor: submitting || !ready ? "not-allowed" : "pointer",
            opacity: submitting || !ready ? 0.6 : 1,
          }}
        >
          {submitting ? "Saving…" : "Continue →"}
        </button>
      </div>
    </div>
  );
}
