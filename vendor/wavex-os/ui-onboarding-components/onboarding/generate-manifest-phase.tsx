import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Cable, Check, RefreshCw } from "lucide-react";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { ErrorLine, P } from "./primitives";

export function GenerateManifestPhase<
  T extends { manifest: unknown; source: "t2" | "fallback"; warnings: string[] },
>({
  title,
  description,
  icon: Icon,
  generate,
  renderManifest,
  onAccept,
  acceptLabel = "Accept & continue",
  skipInference = false,
  cached,
}: {
  title: string;
  description: string;
  icon: typeof Cable;
  generate: () => Promise<T>;
  renderManifest: (data: T) => React.ReactNode;
  onAccept: (data: T) => void;
  acceptLabel?: string;
  skipInference?: boolean;
  /**
   * Previously-accepted manifest from this phase. When set, the component
   * skips auto-generation and shows the cached value immediately — so the
   * back-nav doesn't trigger a fresh 5-15s T2 round-trip just to re-display
   * what the operator already saw and accepted. Operator can still click
   * "Regenerate" to rerun.
   */
  cached?: T;
}) {
  const [data, setData] = useState<T | null>(cached ?? null);
  const [err, setErr] = useState<string | null>(null);
  const run = useMutation({
    mutationFn: () => generate(),
    onSuccess: (r) => {
      setData(r);
      setErr(null);
    },
    onError: (e) => setErr(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <Card className="space-y-4 p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <Icon className="size-5 text-purple-600 dark:text-purple-400" />
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <P>{description}</P>
      {!data && (
        <div className="flex items-center justify-end gap-2">
          {skipInference && (
            <span className="text-[11px] text-amber-700 dark:text-amber-400">
              Skip-inference on: deterministic baseline only
            </span>
          )}
          <Button onClick={() => run.mutate()} disabled={run.isPending}>
            {run.isPending ? (skipInference ? "Generating…" : "Running T2…") : "Generate"}{" "}
            <ArrowRight className="ml-1 size-3.5" />
          </Button>
        </div>
      )}
      {err && <ErrorLine>{err}</ErrorLine>}
      {data && (
        <>
          {renderManifest(data)}
          {data.warnings.length > 0 && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] text-amber-700 dark:text-amber-400">
              {data.warnings.map((w, i) => (
                <div key={i}>· {w}</div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">
              {data.source === "t2"
                ? "Shaped by your specific answers"
                : "Built from your pillar signals"}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => run.mutate()}
                disabled={run.isPending}
                title="Re-run generation (slow — 5-15s for T2)"
              >
                <RefreshCw className={`size-3 ${run.isPending ? "animate-spin" : ""}`} />
                {run.isPending ? "Regenerating…" : "Regenerate"}
              </Button>
              <Button onClick={() => onAccept(data)}>
                {acceptLabel} <Check className="ml-1 size-3.5" />
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
