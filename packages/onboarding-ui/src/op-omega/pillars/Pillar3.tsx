/** Pillar 3 — Product & Stage. Drives swarm activation rules. */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { opOmegaOnboardingApi } from "../lib/api";
import type { Pillar3Response, ProductStage, ProductState } from "@op-omega/plugin-onboarding";
import { Card, Field, H2, NavRow, P, RadioGroup } from "../components/primitives";

const STAGES: Array<{ value: ProductStage; label: string }> = [
  { value: "pre_product", label: "Pre-product" },
  { value: "alpha", label: "Alpha (private testing)" },
  { value: "beta", label: "Beta (public, no charging)" },
  { value: "live_pre_revenue", label: "Live, no revenue" },
  { value: "live_paying", label: "Live, paying customers" },
  { value: "scaling", label: "Scaling ($10k-$1M MRR)" },
  { value: "post_one_million_arr", label: "Post-$1M ARR" },
];

const PRODUCT_STATES: Array<{ value: ProductState; label: string; description: string }> = [
  { value: "none", label: "No product yet", description: "Pre-build / research mode" },
  { value: "in_progress", label: "In progress", description: "Building / pre-launch" },
  { value: "live", label: "Live", description: "Real users on it" },
];

interface Props {
  companyId: string;
  initial: Pillar3Response | undefined;
  onComplete: () => void;
}

export function Pillar3({ companyId, initial, onComplete }: Props) {
  const [productState, setProductState] = useState<ProductState>(initial?.product_state ?? "in_progress");
  const [stage, setStage] = useState<ProductStage>(initial?.stage ?? "live_pre_revenue");
  const [goalKpiId, setGoalKpiId] = useState(initial?.goalKpiId ?? "");
  const [goalCurrent, setGoalCurrent] = useState(initial?.goalCurrent ?? 0);
  const [goalTarget, setGoalTarget] = useState(initial?.goalTarget ?? 0);
  const [goalWindowDays, setGoalWindowDays] = useState(initial?.goalWindowDays ?? 90);

  const submit = useMutation({
    mutationFn: () => opOmegaOnboardingApi.pillar3({
      companyId,
      product_state: productState, stage,
      goalKpiId: goalKpiId.trim(),
      goalCurrent, goalTarget, goalWindowDays,
    }),
    onSuccess: onComplete,
  });

  const canProceed = goalKpiId.trim().length > 0 && goalTarget > 0;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "2rem" }}>
      <H2>Pillar 3 — Product & Stage</H2>
      <P>Where you are in the lifecycle drives which C-suite roles get spawned (Phase 3) and which workflow templates apply (Phase 4).</P>

      <Card>
        <Field label="Product state">
          <RadioGroup value={productState} onChange={setProductState} options={PRODUCT_STATES} />
        </Field>
        <Field label="Stage">
          <select value={stage} onChange={(e) => setStage(e.target.value as ProductStage)}>
            {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Field>
      </Card>

      <Card>
        <h3 style={{ marginTop: 0, fontSize: 14, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Headline KPI</h3>
        <p className="text-dim" style={{ fontSize: 13, marginTop: 0, marginBottom: "1rem" }}>The single number every CxO is judged against. Auto-assigned to CEO.</p>

        <Field label="KPI name" required>
          <input value={goalKpiId} onChange={(e) => setGoalKpiId(e.target.value)} placeholder="e.g. monthly_recurring_revenue" />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
          <Field label="Current"><input type="number" value={goalCurrent} onChange={(e) => setGoalCurrent(Number(e.target.value))} /></Field>
          <Field label="Target" required><input type="number" value={goalTarget} onChange={(e) => setGoalTarget(Number(e.target.value))} /></Field>
          <Field label="Window (days)"><input type="number" value={goalWindowDays} onChange={(e) => setGoalWindowDays(Number(e.target.value))} /></Field>
        </div>
      </Card>

      <NavRow
        next={{ onClick: () => submit.mutate(), label: submit.isPending ? "Saving..." : "Continue →" }}
        nextDisabled={!canProceed || submit.isPending}
      />
      {submit.isError && <div style={{ color: "var(--warning)", fontSize: 13, marginTop: "0.5rem" }}>{(submit.error as Error).message}</div>}
    </div>
  );
}
