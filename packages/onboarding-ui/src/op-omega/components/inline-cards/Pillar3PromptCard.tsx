/** Inline prompt card for Pillar 3 — product_state + conditional stage.
 *
 *  The chat asks "Where are you in the product journey?" and renders this
 *  card as the assistant's response. The operator picks a product state
 *  chip; if the choice is non-pre-product, a revenue-stage chip group
 *  appears. Submit fires POST /pillar/3 and the chat continues. */

import { useEffect, useState } from "react";
import type { Pillar3Response } from "@op-omega/plugin-onboarding";
import { opOmegaOnboardingApi, ApiError } from "../../lib/api";
import { ResponseChips } from "../ResponseChips";
import { PRODUCT_STATES, STAGE_PRE, STAGE_REVENUE } from "../../lib/options";
import { previewBaseline, formatBaselinePreview } from "../../lib/stage-baselines";
import { usePillarSuggestion } from "../../lib/use-pillar-suggestion";

const PRODUCT_OPTS = PRODUCT_STATES.filter((o) => o.v !== "other").map((o) => ({ value: o.v, label: o.l }));
const STAGE_PRE_OPTS = STAGE_PRE.filter((o) => o.v !== "other").map((o) => ({ value: o.v, label: o.l }));
const STAGE_REV_OPTS = STAGE_REVENUE.filter((o) => o.v !== "other").map((o) => ({ value: o.v, label: o.l }));

interface Props {
  companyId: string;
  onDone: (response: Pillar3Response) => void;
}

export function Pillar3PromptCard({ companyId, onDone }: Props) {
  const [productCanon, setProductCanon] = useState<string[]>([]);
  const [productCustom, setProductCustom] = useState<string[]>([]);
  const [stageCanon, setStageCanon] = useState<string[]>([]);
  const [stageCustom, setStageCustom] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pull inference-grounded suggestions on mount based on Pillar 1 context.
  // Chips that match get a ✨ sparkle outline; the operator can still pick
  // anything. Once a suggestion lands, auto-preselect the product_state so
  // the customer just confirms / overrides (one less click in the common case).
  const suggestion = usePillarSuggestion(3, companyId);
  const suggestedProduct = typeof suggestion.recommended.product_state === "string"
    ? (suggestion.recommended.product_state as string)
    : null;
  const suggestedStage = typeof suggestion.recommended.stage === "string"
    ? (suggestion.recommended.stage as string)
    : null;

  useEffect(() => {
    if (!suggestion.loaded) return;
    if (productCanon.length > 0 || productCustom.length > 0) return;  // operator already picked
    if (suggestedProduct && PRODUCT_OPTS.some((o) => o.value === suggestedProduct)) {
      setProductCanon([suggestedProduct]);
    }
  }, [suggestion.loaded, suggestedProduct]);
  useEffect(() => {
    if (!suggestion.loaded) return;
    if (stageCanon.length > 0 || stageCustom.length > 0) return;
    if (suggestedStage) {
      const inPre = STAGE_PRE_OPTS.some((o) => o.value === suggestedStage);
      const inRev = STAGE_REV_OPTS.some((o) => o.value === suggestedStage);
      if (inPre || inRev) setStageCanon([suggestedStage]);
    }
  }, [suggestion.loaded, suggestedStage]);

  const productValue = productCustom[0] ?? productCanon[0] ?? "";
  const productIsCustom = productCustom.length > 0;
  // Pre-product / idea-only states show the pre-launch stage options; anything
  // else (live, built, custom) gets revenue brackets.
  const showStage = !!productValue;
  const isPre = productValue === "idea_only" || productValue === "prototype_mvp";
  const stageOpts = isPre ? STAGE_PRE_OPTS : STAGE_REV_OPTS;
  const stageValue = stageCustom[0] ?? stageCanon[0] ?? "";
  const stageIsCustom = stageCustom.length > 0;

  const ready = !!productValue && !!stageValue;

  async function handleSubmit(): Promise<void> {
    if (!ready) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await opOmegaOnboardingApi.pillar3({
        companyId,
        product_state: (productIsCustom ? "other" : productValue) as Pillar3Response["product_state"],
        product_state_other: productIsCustom ? productValue : undefined,
        stage: stageIsCustom ? "other" : stageValue,
        stage_other: stageIsCustom ? stageValue : undefined,
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
      {/* Inference-grounded reasoning chip. Renders only after the suggest
          call resolves and only when Claude returned a one-sentence why. */}
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
          Product
        </div>
        <ResponseChips
          mode="single"
          options={PRODUCT_OPTS}
          values={productCanon}
          customValues={productCustom}
          allowCustom
          customLabel="Other product status"
          onChange={(v) => { setProductCanon(v); setStageCanon([]); setStageCustom([]); }}
          onCustomChange={(v) => { setProductCustom(v); setStageCanon([]); setStageCustom([]); }}
          disabled={submitting}
          suggestedValues={suggestedProduct ? [suggestedProduct] : []}
        />
      </div>

      {showStage && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: "0.35rem", color: "var(--text-dim)" }}>
            {isPre ? "Where exactly?" : "Revenue?"}
          </div>
          <ResponseChips
            mode="single"
            options={stageOpts}
            values={stageCanon}
            customValues={stageCustom}
            allowCustom
            customLabel={isPre ? "Other launch state" : "Other revenue"}
            onChange={setStageCanon}
            onCustomChange={setStageCustom}
            disabled={submitting}
            suggestedValues={suggestedStage ? [suggestedStage] : []}
          />
        </div>
      )}

      {/* Baseline preview — shows the KPI defaults we'll seed for the
       *  selected (product_state, stage) combo. Display-only. */}
      {productValue && stageValue && (() => {
        const ps = productIsCustom ? "other" : productValue;
        const st = stageIsCustom ? "other" : stageValue;
        const b = previewBaseline(ps, st);
        if (!b) return null;
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
              Baseline KPIs we'll seed
            </div>
            {formatBaselinePreview(b)}
          </div>
        );
      })()}

      {error && (
        <div style={{ color: "var(--warning)", fontSize: 12 }}>✗ {error}</div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          data-testid="pillar3-submit"
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
