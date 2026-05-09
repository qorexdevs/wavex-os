/** Pillar 1 — Identity. Mirrors upstream op-omega's interaction pattern:
 *  - Two inputs initially (org_name + raw_input). No manual_context until halt.
 *  - On submit: 5-stage progressive enrichment indicator (Connecting →
 *    Reading → Inferring → Sketching ICP → Finalizing) with 30s timeout.
 *  - On HALT (URL_ENRICHMENT_UNMEANINGFUL / PILLAR_1_ENRICHMENT_FAILED):
 *    inline transform — same screen — into a "tell us about your product"
 *    textarea (≥40 chars). Continue with that as manual_context.
 *  - On success: show inference preview where operator confirms or edits
 *    the AI-inferred industry / business_model / has_product before advancing. */

import { useEffect, useState } from "react";
import { opOmegaOnboardingApi, ApiError } from "../lib/api";
import type { Pillar1Response } from "@op-omega/plugin-onboarding";
import { Card, Field, H2, P } from "../components/primitives";

interface Props {
  companyId: string;
  initial: Pillar1Response | undefined;
  onComplete: () => void;
}

const ENRICHMENT_PHASES: Array<{ delayMs: number; label: string }> = [
  { delayMs: 0, label: "Connecting to your site…" },
  { delayMs: 2000, label: "Reading content…" },
  { delayMs: 5000, label: "Inferring industry & business model…" },
  { delayMs: 9000, label: "Sketching your customer profile…" },
  { delayMs: 13000, label: "Almost done — finalizing inferences…" },
];

const PILLAR1_TIMEOUT_MS = 30_000;

const INDUSTRY_OPTIONS = [
  "dev_tools", "dev_infrastructure", "fintech", "fintech_retail", "healthtech",
  "legal_tech", "dtc_ecommerce", "consumer_mobile", "enterprise_saas",
  "marketplace", "edtech", "agency_services", "unknown",
];

const BUSINESS_MODEL_OPTIONS = [
  "subscription", "usage_based", "marketplace_take_rate", "one_time_purchase",
  "freemium", "enterprise_license", "services_retainer", "unknown",
];

export function Pillar1({ companyId, initial, onComplete }: Props) {
  const [orgName, setOrgName] = useState(initial?.org_name ?? "");
  const [rawInput, setRawInput] = useState("");
  const [manualContext, setManualContext] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [enrichmentPhase, setEnrichmentPhase] = useState(0);
  const [halt, setHalt] = useState<ApiError["halt"]>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [enriched, setEnriched] = useState<Pillar1Response | undefined>(initial);

  const [previewIndustry, setPreviewIndustry] = useState("");
  const [previewBusinessModel, setPreviewBusinessModel] = useState("");
  const [previewHasProduct, setPreviewHasProduct] = useState(true);

  useEffect(() => {
    if (enriched) {
      setPreviewIndustry(enriched.industry_hint ?? "unknown");
      setPreviewBusinessModel(enriched.business_model_hint ?? "unknown");
      setPreviewHasProduct(enriched.has_product ?? true);
    }
  }, [enriched]);

  useEffect(() => {
    if (!submitting) {
      setEnrichmentPhase(0);
      return;
    }
    const timers = ENRICHMENT_PHASES.map((p, i) =>
      window.setTimeout(() => setEnrichmentPhase(i), p.delayMs),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [submitting]);

  async function submit(useManual: boolean): Promise<void> {
    setSubmitting(true);
    setError(null);
    setHalt(undefined);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), PILLAR1_TIMEOUT_MS);
    try {
      const resp = await opOmegaOnboardingApi.pillar1({
        companyId,
        org_name: orgName.trim(),
        raw_input: rawInput.trim(),
        manual_context: useManual && manualContext.trim().length >= 40 ? manualContext.trim() : undefined,
      });
      setEnriched(resp.response);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setError(`Took longer than ${PILLAR1_TIMEOUT_MS / 1000}s — inference may be slow. Try again, or describe your product manually below.`);
      } else if (e instanceof ApiError) {
        if (e.halt) setHalt(e.halt);
        else setError(e.message);
      } else {
        setError((e as Error).message);
      }
    } finally {
      window.clearTimeout(timeoutId);
      setSubmitting(false);
    }
  }

  if (enriched) {
    return (
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "2rem" }}>
        <H2>Pillar 1 — confirm what we inferred</H2>
        <P>
          Quick check: does this look right? These three signals cascade into
          your connector + agent + workflow choices, so corrections matter.
        </P>

        <Card>
          <div style={{ marginBottom: "1rem", padding: "0.75rem", background: "var(--bg)", borderRadius: 4, fontSize: 13 }}>
            <strong>Context:</strong> {enriched.company_context}
          </div>

          <Field label="Industry" required>
            <select value={previewIndustry} onChange={(e) => setPreviewIndustry(e.target.value)}>
              {INDUSTRY_OPTIONS.map((i) => <option key={i} value={i}>{i.replace(/_/g, " ")}</option>)}
              {!INDUSTRY_OPTIONS.includes(previewIndustry) && <option value={previewIndustry}>{previewIndustry} (inferred)</option>}
            </select>
          </Field>

          <Field label="Business model" required>
            <select value={previewBusinessModel} onChange={(e) => setPreviewBusinessModel(e.target.value)}>
              {BUSINESS_MODEL_OPTIONS.map((b) => <option key={b} value={b}>{b.replace(/_/g, " ")}</option>)}
              {!BUSINESS_MODEL_OPTIONS.includes(previewBusinessModel) && <option value={previewBusinessModel}>{previewBusinessModel} (inferred)</option>}
            </select>
          </Field>

          <Field label="Do you have a live product?">
            <select value={String(previewHasProduct)} onChange={(e) => setPreviewHasProduct(e.target.value === "true")}>
              <option value="true">Yes — built and/or selling</option>
              <option value="false">No — pre-product</option>
            </select>
          </Field>

          {(enriched.ideal_customer_profile || enriched.competitive_position || enriched.tone_signal) && (
            <div style={{ marginTop: "1rem", padding: "0.75rem", background: "var(--bg)", borderRadius: 4, fontSize: 12, color: "var(--text-dim)" }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>OTHER INFERRED SIGNALS</div>
              {enriched.ideal_customer_profile && <div><strong>ICP:</strong> {enriched.ideal_customer_profile}</div>}
              {enriched.competitive_position && <div><strong>Position:</strong> {enriched.competitive_position}</div>}
              {enriched.tone_signal && <div><strong>Tone:</strong> {enriched.tone_signal}</div>}
              {enriched.primary_acquisition_channel && enriched.primary_acquisition_channel !== "unspecified" && (
                <div><strong>Acquisition:</strong> {enriched.primary_acquisition_channel}</div>
              )}
              <div className="text-dim" style={{ fontSize: 10, marginTop: 6 }}>
                Source: <code>{enriched.enrichment_status ?? "unknown"}</code>
              </div>
            </div>
          )}
        </Card>

        <div className="nav-buttons">
          <button type="button" className="secondary" onClick={() => setEnriched(undefined)}>← Re-enrich</button>
          <button type="button" onClick={onComplete}>Confirm + continue →</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "2rem" }}>
      <H2>Pillar 1 — who you are</H2>
      <P>
        One line about your company: paste your website URL, a GitHub repo,
        or just say "no product yet."
      </P>

      <Card>
        <Field label="Company name" required>
          <input
            type="text"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="e.g. Acme Tools"
            autoFocus
            disabled={submitting}
          />
        </Field>

        <Field label="URL or short pitch" required>
          <input
            type="text"
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder="acme.com  /  github.com/you/repo  /  no product yet"
            disabled={submitting}
          />
        </Field>

        {submitting && (
          <div style={{ padding: "0.75rem", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 4, marginTop: "0.75rem" }}>
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: "0.5rem", color: "var(--text-dim)" }}>
              ⟲ Working on your context — {enrichmentPhase + 1}/{ENRICHMENT_PHASES.length}
            </div>
            <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden", marginBottom: "0.5rem" }}>
              <div style={{
                height: "100%", width: `${((enrichmentPhase + 1) / ENRICHMENT_PHASES.length) * 100}%`,
                background: "var(--accent)", transition: "width 0.5s ease-out",
              }} />
            </div>
            <ol style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 12 }}>
              {ENRICHMENT_PHASES.map((p, i) => (
                <li key={i} style={{
                  padding: "2px 0",
                  color: i < enrichmentPhase ? "var(--text)" : i === enrichmentPhase ? "var(--accent)" : "var(--text-dim)",
                  opacity: i > enrichmentPhase ? 0.5 : 1,
                }}>
                  {i < enrichmentPhase ? "✓ " : i === enrichmentPhase ? "⟲ " : "○ "}
                  {p.label}
                </li>
              ))}
            </ol>
          </div>
        )}

        {halt && (
          <div style={{ marginTop: "0.75rem", padding: "0.75rem", border: "1px solid var(--warning)", borderRadius: 4, background: "var(--bg)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--warning)", marginBottom: "0.5rem" }}>
              ◷ Tell us about your product
            </div>
            <div style={{ fontSize: 13, marginBottom: "0.75rem" }}>{halt.operator_message}</div>
            <textarea
              value={manualContext}
              onChange={(e) => setManualContext(e.target.value)}
              rows={3}
              placeholder="e.g. We help outpatient clinics transcribe visits. Clinics pay per provider per month. We're early — 8 clinics on trial, 3 paid."
              style={{ width: "100%" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem", gap: "0.5rem" }}>
              <span className="text-dim" style={{ fontSize: 11 }}>
                {manualContext.trim().length} / 40 minimum characters
              </span>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => void submit(false)}
                  disabled={submitting}
                  title="Re-run T2 enrichment against the URL — sometimes the call comes back richer"
                >
                  ⟲ Retry T2
                </button>
                <button
                  type="button"
                  onClick={() => void submit(true)}
                  disabled={manualContext.trim().length < 40 || submitting}
                >
                  Continue with this description →
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div style={{ marginTop: "0.75rem", padding: "0.5rem", color: "var(--warning)", fontSize: 13 }}>
            ✗ {error}
          </div>
        )}
      </Card>

      {!halt && (
        <div className="nav-buttons">
          <span />
          <button
            type="button"
            onClick={() => void submit(false)}
            disabled={!orgName.trim() || !rawInput.trim() || submitting}
          >
            {submitting ? "Reading…" : "Next →"}
          </button>
        </div>
      )}
    </div>
  );
}
