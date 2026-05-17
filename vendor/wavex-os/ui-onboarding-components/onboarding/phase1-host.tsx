import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { wavexOsOnboardingApi } from "../../../api/wavexOsOnboarding";
import { Pillar1 } from "./pillar-1";
import { Pillar2 } from "./pillar-2";
import { Pillar3 } from "./pillar-3";
import { Pillar4 } from "./pillar-4";
import { Pillar5 } from "./pillar-5";
import { Pillar1InferencePreview } from "./Pillar1InferencePreview";

type PillarNum = 1 | 2 | 3 | 4 | 5;

const PILLAR_TITLES: Record<PillarNum, string> = {
  1: "Who you are",
  2: "Inference bootstrap",
  3: "Product & stage",
  4: "GTM motion",
  5: "Board comms",
};

export function Phase1Host({
  companyId,
  status,
  onComplete,
}: {
  companyId: string;
  status: NonNullable<Awaited<ReturnType<typeof wavexOsOnboardingApi.status>>>;
  onComplete: () => void;
}) {
  const next = status.next_pillar;
  const qc = useQueryClient();
  const [revisitPillar, setRevisitPillar] = useState<PillarNum | null>(null);
  const pillar1 = status.responses?.pillar_1;
  const pillar2 = status.responses?.pillar_2 as
    | { claude_plan?: "max_20x" | "max_5x" | "api_only" | "other"; claude_plan_other_note?: string }
    | null
    | undefined;
  const pillar3 = status.responses?.pillar_3 as
    | { product_state?: string; product_state_other?: string; stage?: string; stage_other?: string }
    | null
    | undefined;
  const pillar4 = status.responses?.pillar_4 as
    | {
        lead_sources?: string[];
        lead_source_other?: string;
        sales_motion?: string;
        sales_motion_other?: string;
        close_channel?: string;
        close_channel_other?: string;
      }
    | null
    | undefined;
  const pillar5 = status.responses?.pillar_5 as
    | {
        comm_channel?: string;
        comm_channel_other?: string;
        urgency_routing?: string;
        urgency_routing_other?: string;
        board_endpoint_config?: Record<string, string>;
      }
    | null
    | undefined;

  const completed: Record<PillarNum, boolean> = {
    1: !!pillar1,
    2: !!pillar2,
    3: !!pillar3,
    4: !!pillar4,
    5: !!pillar5,
  };
  const inferenceConfirmed = pillar1?.inference_confirmed === true;

  const showInferencePreview =
    revisitPillar === null && next === 2 && !!pillar1 && !inferenceConfirmed;

  const confirm = useMutation({
    mutationFn: wavexOsOnboardingApi.pillar1ConfirmInference,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wavex-os", "onboarding-status", companyId] });
    },
  });

  // Active pillar = revisit override (if any) → otherwise next_pillar from server.
  const activePillar = revisitPillar ?? next;

  const onPillarDone = () => {
    setRevisitPillar(null);
    onComplete();
  };

  // Pillar tab strip — shows whenever Pillar 1 is done, so the operator can
  // jump back to revise even from the inference-confirm screen.
  const anyCompleted = Object.values(completed).some((c) => c);
  const stripVisible = anyCompleted;

  if (showInferencePreview && pillar1) {
    return (
      <div className="space-y-3">
        {stripVisible && (
          <PillarTabStrip
            completed={completed}
            activePillar={activePillar}
            revisiting={revisitPillar !== null}
            onSelect={(p) => setRevisitPillar(p)}
            onCancelRevisit={() => setRevisitPillar(null)}
          />
        )}
        <Pillar1InferencePreview
          enriched={{
            industry_hint: pillar1.industry_hint,
            business_model_hint: pillar1.business_model_hint,
            has_product: pillar1.has_product,
          }}
          onConfirm={({ corrections }) => {
            confirm.mutate({
              companyId,
              inference_corrections: corrections,
            });
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {stripVisible && (
        <PillarTabStrip
          completed={completed}
          activePillar={activePillar}
          revisiting={revisitPillar !== null}
          onSelect={(p) => setRevisitPillar(p)}
          onCancelRevisit={() => setRevisitPillar(null)}
        />
      )}

      <Card className="space-y-4 p-4 sm:p-6">
        {activePillar === 1 && (
          <Pillar1
            companyId={companyId}
            onDone={onPillarDone}
            initial={pillar1 ? { org_name: pillar1.org_name, raw_input: pillar1.raw_input } : undefined}
          />
        )}
        {activePillar === 2 && (
          <Pillar2
            companyId={companyId}
            onDone={onPillarDone}
            initial={pillar2 ?? undefined}
          />
        )}
        {activePillar === 3 && (
          <Pillar3 companyId={companyId} onDone={onPillarDone} initial={pillar3 ?? undefined} />
        )}
        {activePillar === 4 && (
          <Pillar4 companyId={companyId} onDone={onPillarDone} initial={pillar4 ?? undefined} />
        )}
        {activePillar === 5 && (
          <Pillar5 companyId={companyId} onDone={onPillarDone} initial={pillar5 ?? undefined} />
        )}
        {activePillar === null && (
          <div className="text-sm text-muted-foreground">
            Phase 1 already complete.{" "}
            <Button size="sm" onClick={onPillarDone}>
              Continue to Phase 2
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

function PillarTabStrip({
  completed,
  activePillar,
  revisiting,
  onSelect,
  onCancelRevisit,
}: {
  completed: Record<PillarNum, boolean>;
  activePillar: PillarNum | null;
  revisiting: boolean;
  onSelect: (p: PillarNum) => void;
  onCancelRevisit: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {revisiting ? "Revising a previous answer" : "Your progress"}
        </div>
        {revisiting && (
          <button
            type="button"
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={onCancelRevisit}
          >
            <ChevronLeft className="size-3" /> Back to current step
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {([1, 2, 3, 4, 5] as PillarNum[]).map((p) => {
          const isDone = completed[p];
          const isActive = activePillar === p;
          const clickable = isDone && !isActive;
          return (
            <button
              key={p}
              type="button"
              disabled={!clickable}
              onClick={() => onSelect(p)}
              title={clickable ? `Revise Pillar ${p}` : undefined}
              className={cn(
                "flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition",
                isActive
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : isDone
                    ? "cursor-pointer border-muted bg-muted/40 hover:bg-accent"
                    : "border-muted bg-muted/20 text-muted-foreground/60",
              )}
            >
              <span className="font-mono text-[10px]">P{p}</span>
              <span>{PILLAR_TITLES[p]}</span>
              {isDone && <Check className="size-3" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
