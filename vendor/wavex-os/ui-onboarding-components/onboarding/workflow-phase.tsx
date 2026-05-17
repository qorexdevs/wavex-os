import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Check, Workflow } from "lucide-react";
import {
  wavexOsOnboardingApi,
  parseHalt,
  type OnboardingHaltPayload,
  type WorkflowManifestResult,
} from "../../../api/wavexOsOnboarding";
import { ApiError } from "../../../api/client";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { PHASE_LABELS } from "../../../i18n/phase-labels";
import { ErrorLine, P } from "./primitives";
import { HaltScreen } from "./halt-screen";
import { WorkflowView } from "./workflow-view";

export function WorkflowPhase({
  companyId,
  skipInference,
  onAccept,
}: {
  companyId: string;
  skipInference: boolean;
  onAccept: (manifest: unknown) => void;
}) {
  const [data, setData] = useState<WorkflowManifestResult | null>(null);
  const [halt, setHalt] = useState<OnboardingHaltPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [bypass, setBypass] = useState(false);
  const [confirmBypass, setConfirmBypass] = useState(false);
  const run = useMutation({
    // Take `bypass` as a per-call argument so callers don't have to race a
    // setState commit against the mutation firing (was a `setTimeout(…, 0)`
    // workaround). Default to current state for the normal "Generate" button.
    mutationFn: (overrideBypass: boolean | undefined = undefined) =>
      wavexOsOnboardingApi.generateWorkflow(
        companyId,
        skipInference,
        overrideBypass ?? bypass,
      ),
    onSuccess: (r) => {
      setData(r);
      setHalt(null);
      setErr(null);
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        const h = parseHalt(e.body);
        if (h) {
          setHalt(h);
          setErr(null);
          return;
        }
      }
      setErr(e instanceof Error ? e.message : "Failed");
      setHalt(null);
    },
  });

  return (
    <Card className="space-y-4 p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <Workflow className="size-5 text-purple-600 dark:text-purple-400" />
        <h2 className="text-lg font-semibold">{PHASE_LABELS.workflow.title}</h2>
      </div>
      <P>{PHASE_LABELS.workflow.description}</P>
      {!data && !halt && (
        <div className="flex items-center justify-end gap-2">
          {skipInference && (
            <span className="text-[11px] text-amber-700 dark:text-amber-400">
              Skip-inference on: deterministic baseline only
            </span>
          )}
          <Button onClick={() => run.mutate(undefined)} disabled={run.isPending}>
            {run.isPending ? (skipInference ? "Generating…" : "Running T2…") : "Generate"}{" "}
            <ArrowRight className="ml-1 size-3.5" />
          </Button>
        </div>
      )}
      {halt && (
        <HaltScreen
          halt={halt}
          onRetry={() => {
            setHalt(null);
            setBypass(false);
            setConfirmBypass(false);
            run.mutate(undefined);
          }}
          onOverrideRequest={() => setConfirmBypass(true)}
          confirmBypass={confirmBypass}
          onConfirmOverride={() => {
            setBypass(true);
            setHalt(null);
            setConfirmBypass(false);
            // Pass bypass=true explicitly so the mutation doesn't depend on
            // the setBypass() commit landing first.
            run.mutate(true);
          }}
          onCancelOverride={() => setConfirmBypass(false)}
        />
      )}
      {err && <ErrorLine>{err}</ErrorLine>}
      {data && (
        <>
          <WorkflowView data={data.manifest} />
          {data.warnings.length > 0 && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] text-amber-700 dark:text-amber-400">
              {data.warnings.map((w, i) => (
                <div key={i}>· {w}</div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              {data.source === "t2"
                ? "Shaped by your specific answers"
                : "Built from your pillar signals"}
            </span>
            <Button onClick={() => onAccept(data.manifest)}>
              Accept &amp; continue <Check className="ml-1 size-3.5" />
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
