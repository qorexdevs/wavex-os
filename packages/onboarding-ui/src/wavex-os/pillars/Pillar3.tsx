/** Pillar 3 — Product & Stage. Mirrors upstream pillar-3.tsx:
 *  - RadioGroup for product_state (5 options including "other")
 *  - Stage options change shape based on product_state:
 *      idea_only / prototype_mvp → STAGE_PRE (4 options)
 *      everything else           → STAGE_REVENUE (5 options including "other")
 *  - "Other" fields require ≥40 chars
 *  - Baseline preview card (sky-blue) shows what KPI defaults will be
 *    seeded for the chosen (product_state × stage) combo */

import { useMemo, useState } from "react";
import { wavexOsOnboardingApi, ApiError } from "../lib/api";
import type { Pillar3Response, ProductState } from "@wavex-os/plugin-onboarding";
import { Card, Field, H2, P } from "../components/primitives";
import { PRODUCT_STATES, STAGE_PRE, STAGE_REVENUE } from "../lib/options";
import { previewBaseline, formatBaselinePreview } from "../lib/stage-baselines";

interface Props {
  companyId: string;
  initial: Pillar3Response | undefined;
  onComplete: () => void;
}

export function Pillar3({ companyId, initial, onComplete }: Props) {
  const [ps, setPs] = useState<ProductState>(initial?.product_state ?? "live_paying_customers");
  const [psOther, setPsOther] = useState(initial?.product_state_other ?? "");
  const [stage, setStage] = useState(initial?.stage ?? "10k_100k_mrr");
  const [stageOther, setStageOther] = useState(initial?.stage_other ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stageOptions = useMemo(
    () => (ps === "idea_only" || ps === "prototype_mvp" ? STAGE_PRE : STAGE_REVENUE),
    [ps],
  );

  // Reset stage to first valid option when product_state shape changes.
  // (Use derived check rather than useEffect to avoid stale state on initial render.)
  const validStage = stageOptions.some((o) => o.v === stage);
  if (!validStage && stage !== "other") {
    setStage(stageOptions[0].v);
  }

  const baseline = useMemo(() => previewBaseline(ps, stage), [ps, stage]);
  const psOtherMissing = ps === "other" && psOther.trim().length < 40;
  const stageOtherMissing = stage === "other" && stageOther.trim().length < 40;

  async function submit(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await wavexOsOnboardingApi.pillar3({
        companyId,
        product_state: ps,
        product_state_other: ps === "other" ? psOther : undefined,
        stage,
        stage_other: stage === "other" ? stageOther : undefined,
      });
      onComplete();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "2rem" }}>
      <H2>Pillar 3 · Product & Stage</H2>
      <P>
        Shapes the flywheel's starting KPIs and which bundles fire hardest in
        the first 30 cycles.
      </P>

      {error && <Card><p style={{ color: "var(--warning)", margin: 0 }}>✗ {error}</p></Card>}

      <Card>
        <RadioRow title="Product state" value={ps} onChange={(v) => setPs(v as ProductState)} options={PRODUCT_STATES.map((o) => ({ v: o.v, l: o.l }))} />
        {ps === "other" && (
          <Field label="Describe your product state (≥40 chars)">
            <textarea
              value={psOther}
              onChange={(e) => setPsOther(e.target.value)}
              rows={2}
              placeholder="In 2–3 sentences, describe your product state — what's built, what's missing, what customers have access to."
            />
            <span className="text-dim" style={{ fontSize: 11 }}>{psOther.trim().length} / 40 minimum</span>
          </Field>
        )}

        <RadioRow title="Stage" value={stage} onChange={setStage} options={[...stageOptions]} />
        {stage === "other" && (
          <Field label="Describe your stage (≥40 chars)">
            <textarea
              value={stageOther}
              onChange={(e) => setStageOther(e.target.value)}
              rows={2}
              placeholder="Time since launch, rough revenue, growth trajectory."
            />
            <span className="text-dim" style={{ fontSize: 11 }}>{stageOther.trim().length} / 40 minimum</span>
          </Field>
        )}

        {baseline && stage !== "other" && ps !== "other" && (
          <div style={{
            marginTop: "0.75rem",
            padding: "0.75rem",
            border: "1px solid var(--accent)",
            background: "var(--bg)",
            borderRadius: 4,
            fontSize: 12,
          }}>
            <div style={{ color: "var(--accent)", fontWeight: 600, marginBottom: 4 }}>
              ✦ Baseline preview
            </div>
            <div className="text-dim">{formatBaselinePreview(baseline)}</div>
          </div>
        )}
      </Card>

      <div className="nav-buttons">
        <span />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || psOtherMissing || stageOtherMissing}
        >
          {busy ? "Saving…" : "Next →"}
        </button>
      </div>
    </div>
  );
}

function RadioRow({
  title,
  value,
  onChange,
  options,
}: {
  title: string;
  value: string;
  onChange: (v: string) => void;
  options: ReadonlyArray<{ v: string; l: string }>;
}) {
  return (
    <div style={{ marginBottom: "1rem" }}>
      <div style={{ marginBottom: "0.5rem", fontSize: 13, fontWeight: 500 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {options.map((o) => (
          <label
            key={o.v}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "0.5rem 0.75rem",
              border: `1px solid ${value === o.v ? "var(--accent)" : "var(--border)"}`,
              background: value === o.v ? "var(--surface-2)" : "transparent",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            <input type="radio" checked={value === o.v} onChange={() => onChange(o.v)} />
            <span>{o.l}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
