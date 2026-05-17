import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Check, Loader2, ShieldAlert } from "lucide-react";
import {
  wavexOsOnboardingApi,
  parseHalt,
  type OnboardingHaltPayload,
} from "../../../api/wavexOsOnboarding";
import { ApiError } from "../../../api/client";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { PHASE_LABELS } from "../../../i18n/phase-labels";
import { ErrorLine, H2, P } from "./primitives";
import { useFormDraft } from "../../../lib/use-form-draft";

/**
 * Progressive messages shown during T2 enrichment so the operator gets
 * useful feedback instead of a blank "Reading your site..." for 5–15 seconds.
 *
 * Note: these are advisory — the server isn't actually streaming progress.
 * Each phase represents a likely sub-step inside `handlePillar1`'s T2 enrichment.
 */
const ENRICHMENT_PHASES: Array<{ delayMs: number; label: string }> = [
  { delayMs: 0, label: "Connecting to your site…" },
  { delayMs: 2000, label: "Reading content…" },
  { delayMs: 5000, label: "Inferring industry & business model…" },
  { delayMs: 9000, label: "Sketching your customer profile…" },
  { delayMs: 13000, label: "Almost done — finalizing inferences…" },
];

export function Pillar1({
  companyId,
  onDone,
  initial,
}: {
  companyId: string;
  onDone: () => void;
  initial?: { org_name?: string; raw_input?: string };
}) {
  // Persist drafts so a mid-enrichment refresh (Pillar 1's T2 call can take
  // 5-15s — easy to lose patience and reload) doesn't wipe what the operator
  // typed. Server-side answers always win on remount via `initial`, so once
  // Pillar 1 succeeds the draft is also cleared via clear*() in onSuccess.
  const [orgName, setOrgName, clearOrgNameDraft] = useFormDraft(
    `pillar1.${companyId}.org_name`,
    initial?.org_name ?? "",
  );
  const [rawInput, setRawInput, clearRawInputDraft] = useFormDraft(
    `pillar1.${companyId}.raw_input`,
    initial?.raw_input ?? "",
  );
  const [manualContext, setManualContext, clearManualContextDraft] = useFormDraft(
    `pillar1.${companyId}.manual_context`,
    "",
  );
  const [halt, setHalt] = useState<OnboardingHaltPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [enrichmentPhase, setEnrichmentPhase] = useState<number>(0);
  // T2 enrichment can take 5-15s normally; cap at 30s so a hung Anthropic
  // call doesn't trap the operator behind an infinite spinner. On abort the
  // mutation surfaces an AbortError, which translateError below maps to
  // actionable copy.
  const PILLAR1_TIMEOUT_MS = 30_000;
  const submit = useMutation({
    mutationFn: (opts: { manual?: boolean }) => {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), PILLAR1_TIMEOUT_MS);
      return wavexOsOnboardingApi
        .pillar1(
          {
            companyId,
            org_name: orgName,
            raw_input: rawInput,
            manual_context: opts.manual ? manualContext : undefined,
          },
          { signal: controller.signal },
        )
        .finally(() => window.clearTimeout(timeoutId));
    },
    onSuccess: () => {
      clearOrgNameDraft();
      clearRawInputDraft();
      clearManualContextDraft();
      onDone();
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
      // AbortError surfaces from fetch when the AbortController fires. The
      // name is the most reliable cross-browser signal (DOMException name).
      if (e instanceof DOMException && e.name === "AbortError") {
        setErr(
          `Took longer than ${PILLAR1_TIMEOUT_MS / 1000}s — the inference service may be slow. Try again, or paste a manual description below.`,
        );
        return;
      }
      setErr(e instanceof Error ? e.message : "Failed");
      // Preserve any in-progress manual_context the operator typed — only
      // clear the halt screen on actual mutation success (handled implicitly
      // because onSuccess routes to onDone()).
    },
  });

  // Advance the enrichment-progress message while the request is in flight.
  // Resets to phase 0 when the request finishes so a follow-up retry starts fresh.
  useEffect(() => {
    if (!submit.isPending) {
      setEnrichmentPhase(0);
      return;
    }
    const timers = ENRICHMENT_PHASES.map((p, i) =>
      window.setTimeout(() => setEnrichmentPhase(i), p.delayMs),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [submit.isPending]);
  return (
    <>
      <H2>{PHASE_LABELS.pillars.step} · who you are</H2>
      <P>One line about your company: paste your website URL, a GitHub repo, or just say "no product yet."</P>
      <Input
        autoFocus
        placeholder="Company name (e.g. Acme Tools)"
        value={orgName}
        onChange={(e) => setOrgName(e.target.value)}
      />
      <Input
        placeholder="URL / repo / 'no product yet'"
        value={rawInput}
        onChange={(e) => setRawInput(e.target.value)}
      />
      {!halt && submit.isPending && (
        <div className="rounded-md border border-sky-500/30 bg-sky-500/5 p-3">
          <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold text-sky-700 dark:text-sky-400">
            <div className="flex items-center gap-2">
              <Loader2 className="size-3.5 animate-spin" /> Working on your context
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">
              {enrichmentPhase + 1}/{ENRICHMENT_PHASES.length}
            </span>
          </div>
          {/* Friction-fix #4: thin progress bar gives stronger perceived
              progress than the step list alone, even though the underlying
              inference time is unchanged. Animated transition smooths the
              ~3s hops between phase advances. */}
          <div className="mb-3 h-1 w-full overflow-hidden rounded bg-sky-500/10">
            <div
              className="h-full rounded bg-sky-500 transition-all duration-500 ease-out"
              style={{
                width: `${((enrichmentPhase + 1) / ENRICHMENT_PHASES.length) * 100}%`,
              }}
            />
          </div>
          <ol className="space-y-1 text-xs">
            {ENRICHMENT_PHASES.map((p, i) => {
              const reached = i <= enrichmentPhase;
              const isCurrent = i === enrichmentPhase;
              return (
                <li
                  key={i}
                  className={
                    reached
                      ? isCurrent
                        ? "flex items-center gap-1.5 text-foreground"
                        : "flex items-center gap-1.5 text-muted-foreground"
                      : "flex items-center gap-1.5 text-muted-foreground/50"
                  }
                >
                  {!reached ? (
                    <span className="size-3.5 rounded-full border border-muted-foreground/30" />
                  ) : isCurrent ? (
                    <Loader2 className="size-3.5 shrink-0 animate-spin text-sky-600 dark:text-sky-400" />
                  ) : (
                    <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  )}
                  <span>{p.label}</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
      {!halt && (
        <div className="flex justify-end">
          <Button onClick={() => submit.mutate({})} disabled={!orgName || !rawInput || submit.isPending}>
            {submit.isPending ? "Reading…" : "Next"} <ArrowRight className="ml-1 size-3.5" />
          </Button>
        </div>
      )}
      {halt && (
        <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
          <div className="flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-400">
            <ShieldAlert className="size-4" /> Tell us about your product
          </div>
          <div>{halt.operator_message}</div>
          <textarea
            className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="e.g. We help outpatient clinics transcribe visits. Clinics pay per provider per month. We're early — 8 clinics on trial, 3 paid."
            value={manualContext}
            onChange={(e) => setManualContext(e.target.value)}
            minLength={40}
            required
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{manualContext.trim().length} / 40 minimum characters</span>
            <Button
              onClick={() => {
                // Don't clear halt here — onSuccess advances out of this view;
                // onError keeps the halt + textarea state intact so the operator
                // doesn't lose what they typed if the server returns another halt.
                submit.mutate({ manual: true });
              }}
              disabled={manualContext.trim().length < 40 || submit.isPending}
            >
              Continue with this description <ArrowRight className="ml-1 size-3.5" />
            </Button>
          </div>
        </div>
      )}
      {err && <ErrorLine>{err}</ErrorLine>}
    </>
  );
}
