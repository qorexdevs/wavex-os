import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Sparkles } from "lucide-react";
import { wavexOsOnboardingApi } from "../../../api/wavexOsOnboarding";
import { Button } from "../../ui/button";
import { ExpandedTextInput } from "./ExpandedTextInput";
import { transitionHints } from "./transition-hints";
import { PRODUCT_STATES, STAGE_PRE, STAGE_REVENUE } from "./options";
import { H2, P, RadioGroup } from "./primitives";
import { formatBaselinePreview, previewBaseline } from "./stage-baselines";

export function Pillar3({
  companyId,
  onDone,
  initial,
}: {
  companyId: string;
  onDone: () => void;
  initial?: { product_state?: string; product_state_other?: string; stage?: string; stage_other?: string };
}) {
  const [ps, setPs] = useState(initial?.product_state ?? "live_paying_customers");
  const [psOther, setPsOther] = useState(initial?.product_state_other ?? "");
  const [stage, setStage] = useState(initial?.stage ?? "10k_100k_mrr");
  const [stageOther, setStageOther] = useState(initial?.stage_other ?? "");
  const stageOptions = useMemo(
    () => (ps === "idea_only" || ps === "prototype_mvp" ? STAGE_PRE : STAGE_REVENUE),
    [ps],
  );
  const baselinePreview = useMemo(() => previewBaseline(ps, stage), [ps, stage]);
  const psOtherMissing = ps === "other" && psOther.trim().length < 40;
  const stageOtherMissing = stage === "other" && stageOther.trim().length < 40;
  const submit = useMutation({
    mutationFn: () =>
      wavexOsOnboardingApi.pillar3({
        companyId,
        product_state: ps,
        product_state_other: ps === "other" ? psOther : undefined,
        stage,
        stage_other: stage === "other" ? stageOther : undefined,
      }),
    onSuccess: (resp) => {
      transitionHints.current = resp.transition?.next_question_modifications ?? [];
      onDone();
    },
  });
  return (
    <>
      <H2>Pillar 3 · Product & Stage</H2>
      <P>Shapes the flywheel's starting KPIs and which bundles fire hardest in the first 30 cycles.</P>
      <RadioGroup
        title="Product state"
        value={ps}
        onChange={setPs}
        options={PRODUCT_STATES.map((o) => ({ value: o.v, label: o.l }))}
      />
      {ps === "other" && (
        <ExpandedTextInput
          value={psOther}
          onChange={setPsOther}
          placeholder="In 2–3 sentences, describe your product state — what's built, what's missing, what customers have access to."
        />
      )}
      <RadioGroup
        title="Stage"
        value={stage}
        onChange={setStage}
        options={stageOptions.map((o) => ({ value: o.v, label: o.l }))}
      />
      {stage === "other" && (
        <ExpandedTextInput
          value={stageOther}
          onChange={setStageOther}
          placeholder="Describe your stage — time since launch, rough revenue, growth trajectory."
        />
      )}
      {baselinePreview && stage !== "other" && ps !== "other" && (
        <div className="flex items-start gap-2 rounded-md border border-sky-500/30 bg-sky-500/5 p-3 text-xs text-sky-800 dark:text-sky-200">
          <Sparkles className="mt-0.5 size-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
          <span>{formatBaselinePreview(baselinePreview)}</span>
        </div>
      )}
      <div className="flex justify-end">
        <Button
          onClick={() => submit.mutate()}
          disabled={submit.isPending || psOtherMissing || stageOtherMissing}
        >
          Next <ArrowRight className="ml-1 size-3.5" />
        </Button>
      </div>
    </>
  );
}
