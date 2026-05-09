/** Pillar 3 — Product/Stage. Op-omega upstream contract:
 *  Input  : { companyId, product_state, product_state_other?, stage, stage_other? }
 *    product_state ∈ live_paying_customers | built_not_selling | prototype_mvp | idea_only | other
 *  Output : Pillar3Response (kpi_snapshot_initial captured automatically) */

import { useState } from "react";
import { opOmegaOnboardingApi, ApiError } from "../lib/api";
import type { Pillar3Response, ProductState } from "@op-omega/plugin-onboarding";
import { Card, Field, H2, NavRow, P } from "../components/primitives";

const PRODUCT_STATES: Array<{ value: ProductState; label: string }> = [
  { value: "live_paying_customers", label: "Live with paying customers" },
  { value: "built_not_selling", label: "Built but not selling" },
  { value: "prototype_mvp", label: "Prototype / MVP" },
  { value: "idea_only", label: "Idea only" },
  { value: "other", label: "Other" },
];

const STAGE_BY_STATE: Record<ProductState, string[]> = {
  live_paying_customers: ["pre_seed_revenue", "seed_revenue", "series_a", "growth", "scale"],
  built_not_selling: ["pre_launch", "private_beta", "public_beta", "ga"],
  prototype_mvp: ["weekend_hack", "scoped_mvp", "private_alpha"],
  idea_only: ["napkin", "research", "validation"],
  other: ["other"],
};

interface Props {
  companyId: string;
  initial: Pillar3Response | undefined;
  onComplete: () => void;
}

export function Pillar3({ companyId, initial, onComplete }: Props) {
  const [productState, setProductState] = useState<ProductState>(initial?.product_state ?? "live_paying_customers");
  const [productStateOther, setProductStateOther] = useState(initial?.product_state_other ?? "");
  const [stage, setStage] = useState(initial?.stage ?? STAGE_BY_STATE.live_paying_customers[0]);
  const [stageOther, setStageOther] = useState(initial?.stage_other ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await opOmegaOnboardingApi.pillar3({
        companyId,
        product_state: productState,
        product_state_other: productState === "other" ? productStateOther : undefined,
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

  const stageOptions = STAGE_BY_STATE[productState];

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "2rem" }}>
      <H2>Pillar 3 — Product / Stage</H2>
      <P>
        What's the product like, and where is it on the maturity curve? This drives
        which agents activate (CFO + CRO only when live and selling) and which
        workflows the kernel bundles into the L0/L1 priority allocation.
      </P>

      {error && <Card><p style={{ color: "var(--warning)", margin: 0 }}>✗ {error}</p></Card>}

      <Card>
        <Field label="Product state" required>
          <select value={productState} onChange={(e) => {
            const v = e.target.value as ProductState;
            setProductState(v);
            const opts = STAGE_BY_STATE[v];
            if (!opts.includes(stage)) setStage(opts[0]);
          }}>
            {PRODUCT_STATES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Field>
        {productState === "other" && (
          <Field label="Describe product state">
            <input value={productStateOther} onChange={(e) => setProductStateOther(e.target.value)} />
          </Field>
        )}

        <Field label="Stage" required>
          <select value={stage} onChange={(e) => setStage(e.target.value)}>
            {stageOptions.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            <option value="other">other</option>
          </select>
        </Field>
        {stage === "other" && (
          <Field label="Describe stage">
            <input value={stageOther} onChange={(e) => setStageOther(e.target.value)} />
          </Field>
        )}
      </Card>

      <NavRow
        next={{ onClick: submit, label: busy ? "Saving…" : "Continue →" }}
        nextDisabled={busy
          || (productState === "other" && productStateOther.trim().length === 0)
          || (stage === "other" && stageOther.trim().length === 0)}
      />
    </div>
  );
}
