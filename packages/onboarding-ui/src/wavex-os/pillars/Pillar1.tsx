/** Pillar 1 — Identity. Mirrors upstream wavex-os's interaction pattern:
 *  - Two inputs initially (org_name + raw_input). No manual_context until halt.
 *  - On submit: 5-stage progressive enrichment indicator (Connecting →
 *    Reading → Inferring → Sketching ICP → Finalizing) with 30s timeout.
 *  - On HALT (URL_ENRICHMENT_UNMEANINGFUL / PILLAR_1_ENRICHMENT_FAILED):
 *    inline transform — same screen — into a "tell us about your product"
 *    textarea (≥40 chars). Continue with that as manual_context.
 *  - On success: show inference preview where operator confirms or edits
 *    the AI-inferred industry / business_model / has_product before advancing. */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { wavexOsOnboardingApi, ApiError } from "../lib/api";
import { preserveDevFlags } from "../lib/dev-flags";
import type { Pillar1Response } from "@wavex-os/plugin-onboarding";
import { Card, Field, H2, P } from "../components/primitives";
import { T2ProgressIndicator } from "../components/T2ProgressIndicator";

/** URL-safe slug from a free-text company name. Used for first-submit rename:
 *  if the operator lands on Pillar 1 with a stale `?companyId=…` (e.g. from
 *  a bookmarked URL or a Reset+restart) and types a different name, we route
 *  the writes to the new slug instead of the URL's id. */
function slugify(s: string): string {
  return s.toLowerCase().trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface Props {
  companyId: string;
  initial: Pillar1Response | undefined;
  onComplete: () => void;
}

// Timings spread across the actual T2 window (avg 85s, p90 ~110s) so the
// checklist stays honest rather than showing "done" at 13s while the API
// call continues for another 70+ seconds.
const ENRICHMENT_PHASES: Array<{ delayMs: number; label: string }> = [
  { delayMs: 0,      label: "Connecting to your site…" },
  { delayMs: 15_000, label: "Reading content…" },
  { delayMs: 35_000, label: "Inferring industry & business model…" },
  { delayMs: 60_000, label: "Sketching your customer profile…" },
  { delayMs: 80_000, label: "Almost done — finalizing inferences…" },
];

// T2 enrichment averages 85s with p90 around 110s — give it 2 minutes before
// surfacing a timeout error.
const PILLAR1_TIMEOUT_MS = 120_000;

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
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState(initial?.org_name ?? "");
  const [rawInput, setRawInput] = useState("");
  const [manualContext, setManualContext] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [enrichmentPhase, setEnrichmentPhase] = useState(0);
  const [halt, setHalt] = useState<ApiError["halt"]>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [enriched, setEnriched] = useState<Pillar1Response | undefined>(initial);

  // Once a pillar_1 exists for this companyId (either hydrated from server or
  // just written), the URL id is locked. Mid-wizard renames of org_name don't
  // fork the data folder — only the very first write can pick the slug.
  const [firstSubmitDone, setFirstSubmitDone] = useState<boolean>(!!initial);
  const proposedSlug = slugify(orgName);
  const willRename = !firstSubmitDone && proposedSlug.length > 0 && proposedSlug !== companyId;

  const [previewIndustry, setPreviewIndustry] = useState("");
  const [previewBusinessModel, setPreviewBusinessModel] = useState("");
  const [previewHasProduct, setPreviewHasProduct] = useState(true);
  // "Other" mode: dropdown reads "__other__"; the free-text input below
  // captures the operator-typed industry/business-model. We track these
  // separately so toggling the dropdown back to a canonical option doesn't
  // wipe what they typed.
  const [otherIndustry, setOtherIndustry] = useState("");
  const [otherBusinessModel, setOtherBusinessModel] = useState("");
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  useEffect(() => {
    if (enriched) {
      setPreviewIndustry(enriched.industry_hint ?? "unknown");
      setPreviewBusinessModel(enriched.business_model_hint ?? "unknown");
      setPreviewHasProduct(enriched.has_product ?? true);
    }
  }, [enriched]);

  // Resolved values that get persisted on Confirm — either the canonical
  // dropdown selection or the free-text override when "Other" is picked.
  const OTHER_SENTINEL = "__other__";
  const resolvedIndustry = previewIndustry === OTHER_SENTINEL ? otherIndustry.trim() : previewIndustry;
  const resolvedBusinessModel = previewBusinessModel === OTHER_SENTINEL ? otherBusinessModel.trim() : previewBusinessModel;
  const otherIndustryInvalid = previewIndustry === OTHER_SENTINEL && resolvedIndustry.length === 0;
  const otherBusinessInvalid = previewBusinessModel === OTHER_SENTINEL && resolvedBusinessModel.length === 0;

  async function persistAndContinue(): Promise<void> {
    setConfirmSubmitting(true);
    setConfirmError(null);
    try {
      // Only patch fields that diverge from what T2 enriched, so a no-op
      // confirm doesn't write a redundant pillar_1 update.
      const patch: Parameters<typeof wavexOsOnboardingApi.pillar1Edit>[0] = { companyId };
      if (resolvedIndustry && resolvedIndustry !== enriched?.industry_hint) {
        patch.industry_hint = resolvedIndustry;
      }
      if (resolvedBusinessModel && resolvedBusinessModel !== enriched?.business_model_hint) {
        patch.business_model_hint = resolvedBusinessModel;
      }
      if (previewHasProduct !== enriched?.has_product) {
        patch.has_product = previewHasProduct;
      }
      const hasOverride = patch.industry_hint || patch.business_model_hint || patch.has_product !== undefined;
      if (hasOverride) await wavexOsOnboardingApi.pillar1Edit(patch);
      onComplete();
    } catch (e) {
      setConfirmError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setConfirmSubmitting(false);
    }
  }

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
    // Pick the storage key BEFORE the network call so a successful write lands
    // in the right folder. If we're renaming, also flip the URL after success
    // so the breadcrumb + downstream phases see the new id.
    const targetCompanyId = willRename ? proposedSlug : companyId;
    try {
      const resp = await wavexOsOnboardingApi.pillar1({
        companyId: targetCompanyId,
        org_name: orgName.trim(),
        raw_input: rawInput.trim(),
        manual_context: useManual && manualContext.trim().length >= 40 ? manualContext.trim() : undefined,
      });
      setEnriched(resp.response);
      setFirstSubmitDone(true);
      if (targetCompanyId !== companyId) {
        navigate(
          `/onboarding?${preserveDevFlags(`companyId=${encodeURIComponent(targetCompanyId)}&phase=pillar-1`)}`,
          { replace: true },
        );
      }
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
              {!INDUSTRY_OPTIONS.includes(previewIndustry) && previewIndustry !== OTHER_SENTINEL && (
                <option value={previewIndustry}>{previewIndustry} (inferred)</option>
              )}
              <option value={OTHER_SENTINEL}>Other — type your own…</option>
            </select>
            {previewIndustry === OTHER_SENTINEL && (
              <input
                type="text"
                value={otherIndustry}
                onChange={(e) => setOtherIndustry(e.target.value)}
                placeholder="e.g. embroidery_hardware, robotic_dental"
                autoFocus
                style={{ marginTop: 6, width: "100%" }}
              />
            )}
            {otherIndustryInvalid && (
              <div className="text-dim" style={{ fontSize: 11, marginTop: 4, color: "var(--warning)" }}>
                Type your industry above (or pick a canonical option).
              </div>
            )}
          </Field>

          <Field label="Business model" required>
            <select value={previewBusinessModel} onChange={(e) => setPreviewBusinessModel(e.target.value)}>
              {BUSINESS_MODEL_OPTIONS.map((b) => <option key={b} value={b}>{b.replace(/_/g, " ")}</option>)}
              {!BUSINESS_MODEL_OPTIONS.includes(previewBusinessModel) && previewBusinessModel !== OTHER_SENTINEL && (
                <option value={previewBusinessModel}>{previewBusinessModel} (inferred)</option>
              )}
              <option value={OTHER_SENTINEL}>Other — type your own…</option>
            </select>
            {previewBusinessModel === OTHER_SENTINEL && (
              <input
                type="text"
                value={otherBusinessModel}
                onChange={(e) => setOtherBusinessModel(e.target.value)}
                placeholder="e.g. equipment_lease_to_own, value_pricing"
                style={{ marginTop: 6, width: "100%" }}
              />
            )}
            {otherBusinessInvalid && (
              <div className="text-dim" style={{ fontSize: 11, marginTop: 4, color: "var(--warning)" }}>
                Type your business model above (or pick a canonical option).
              </div>
            )}
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

        {confirmError && (
          <div style={{ marginTop: "0.75rem", padding: "0.5rem", color: "var(--warning)", fontSize: 13 }}>
            ✗ {confirmError}
          </div>
        )}

        <div className="nav-buttons">
          <button type="button" className="secondary" onClick={() => setEnriched(undefined)} disabled={confirmSubmitting}>← Re-enrich</button>
          <button
            type="button"
            onClick={() => void persistAndContinue()}
            disabled={confirmSubmitting || otherIndustryInvalid || otherBusinessInvalid}
          >
            {confirmSubmitting ? "Saving…" : "Confirm + continue →"}
          </button>
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
          {willRename && (
            <div className="text-dim" style={{ fontSize: 11, marginTop: 4 }}>
              → will be saved under company id <code>{proposedSlug}</code> (currently <code>{companyId}</code>)
            </div>
          )}
        </Field>

        <Field label="URL or short pitch" required>
          <input
            type="text"
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder="acme.com  /  github.com/you/repo  /  no product yet"
            disabled={submitting}
          />
          {!submitting && (
            <div className="text-dim" style={{ fontSize: 11, marginTop: 4 }}>
              Context enrichment usually takes 60–90 seconds.
            </div>
          )}
        </Field>

        {/* Authoritative progress: real elapsed time + history-backed ETA. */}
        <div style={{ marginTop: submitting ? "0.75rem" : 0 }}>
          <T2ProgressIndicator active={submitting} phase="pillar-1" />
        </div>

        {submitting && (
          <div style={{ padding: "0.75rem", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 4, marginTop: "0.75rem" }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: "0.5rem" }}>
              Analysing your company — this usually takes 60–90 seconds. Hold tight!
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
