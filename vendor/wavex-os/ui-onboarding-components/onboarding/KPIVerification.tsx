/**
 * KPI verification · 3-tier progressive disclosure (Sprint 002 · Issue 3).
 *
 * Tier A · Foundation · 4 load-bearing KPIs (MRR, CAC, activation, burn).
 *   → [These look right] advances to MC
 *   → [Refine a few more] expands Tier B
 * Tier B · Refinement · 4 helpful KPIs (NRR, GRR, sales cycle, win rate).
 *   → [Good enough] advances to MC
 *   → [Add advanced inputs] expands Tier C
 * Tier C · Advanced · 2 input + 2 derived (pipeline velocity, narrative,
 *   CAC payback [derived], LTV:CAC [derived]).
 *
 * Confidence is a function of which tiers the operator engaged with.
 */

import { useMemo, useState } from "react";
import { Card } from "../../ui/card";
import { Button } from "../../ui/button";
import { ArrowRight, Check, Plus } from "lucide-react";
import { KPI_DESCRIPTORS, kpisByTier, type KPIDescriptor } from "../../../i18n/kpi-names";

export interface KPIVerificationInputs {
  mrr: number;
  nrr: number;
  grr: number;
  cac: number;
  cac_payback_months: number;
  burn_multiple: number;
  activation_rate: number;
  sales_cycle_days: number;
  win_rate: number;
  ltv_cac_ratio: number;
  pipeline_velocity: number;
  narrative_strength: number;
}

export type ConfidenceLevel = "high" | "medium" | "low";

export interface KPIVerificationState {
  values: KPIVerificationInputs;
  verified_fields: Set<string>;
  confidence: ConfidenceLevel;
}

export interface KPIVerificationProps {
  initial: KPIVerificationInputs;
  onSubmit: (state: KPIVerificationState) => void;
  onSkip: () => void;
}

function formatValue(key: string, v: number): string {
  const d = KPI_DESCRIPTORS.find((x) => x.key === key);
  if (!d) return String(v);
  if (d.unit === "pct") return `${(v * 100).toFixed(0)}%`;
  if (d.unit === "ratio") return v.toFixed(2);
  if (d.unit === "usd" || d.unit === "usd_per_month") return `$${Math.round(v).toLocaleString()}`;
  if (d.unit === "days") return `${v.toFixed(0)}`;
  return String(v);
}

function parseValue(key: string, input: string): number | null {
  const cleaned = input.replace(/[$,%]/g, "").trim();
  if (cleaned === "") return null;
  const n = parseFloat(cleaned);
  if (!Number.isFinite(n)) return null;
  const d = KPI_DESCRIPTORS.find((x) => x.key === key);
  if (d?.unit === "pct" && n > 1) return n / 100;
  return n;
}

/** Recompute derived KPIs from the primary inputs. */
function deriveValues(v: KPIVerificationInputs): KPIVerificationInputs {
  // CAC payback = CAC / (MRR × gross margin assumption). We don't capture gross margin,
  // so approximate payback ≈ CAC / (MRR per customer). Here we use `MRR / (cac / payback)`
  // inversion — a simpler stable derivation: payback_months = cac / (mrr per customer).
  // With no per-customer MRR, we fall back to: if CAC > 0 and MRR > 0, payback ≈ cac / (mrr * 0.02).
  const cacPayback = v.cac > 0 && v.mrr > 0 ? Math.min(60, v.cac / (v.mrr * 0.02)) : v.cac_payback_months;
  const ltvCac = v.cac > 0 && v.nrr > 0 ? (v.mrr * 12 * v.nrr) / Math.max(1, v.cac * 20) : v.ltv_cac_ratio;
  return {
    ...v,
    cac_payback_months: Math.round(cacPayback * 10) / 10,
    ltv_cac_ratio: Math.round(ltvCac * 100) / 100,
  };
}

function computeConfidence(verified: Set<string>): ConfidenceLevel {
  const foundation = kpisByTier("foundation").map((d) => d.key);
  const refinement = kpisByTier("refinement").map((d) => d.key);
  const foundationDone = foundation.every((k) => verified.has(k));
  const refinementDone = refinement.every((k) => verified.has(k));
  if (foundationDone && refinementDone) return "high";
  if (foundationDone) return "medium";
  return "low";
}

function KPIRow({
  descriptor,
  value,
  draft,
  verified,
  onChangeDraft,
  onCommit,
  readOnly,
  parseError,
}: {
  descriptor: KPIDescriptor;
  value: number;
  draft: string;
  verified: boolean;
  onChangeDraft: (v: string) => void;
  onCommit: () => void;
  readOnly?: boolean;
  parseError?: string;
}) {
  return (
    <div className={`rounded-md border p-3 text-sm ${verified ? "border-emerald-500/40 bg-emerald-500/5" : readOnly ? "border-muted/60 bg-muted/10" : "border-amber-500/40 bg-amber-500/5"}`}>
      <div className="flex items-center justify-between">
        <label className="font-medium">{descriptor.label}</label>
        {readOnly ? (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">Derived</span>
        ) : verified ? (
          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">Verified</span>
        ) : (
          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">AI estimate</span>
        )}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{descriptor.hint}</div>
      <div className="mt-2 flex items-center gap-2">
        {readOnly ? (
          <span className="font-mono text-sm">{formatValue(descriptor.key, value)}</span>
        ) : (
          <>
            <input
              type="text"
              className={`w-28 rounded border bg-background px-2 py-1 text-sm ${parseError ? "border-red-500/60" : ""}`}
              placeholder={formatValue(descriptor.key, value)}
              value={draft}
              onChange={(e) => onChangeDraft(e.target.value)}
              onBlur={onCommit}
              onKeyDown={(e) => { if (e.key === "Enter") onCommit(); }}
            />
            <span className="text-xs text-muted-foreground">
              Currently <code>{formatValue(descriptor.key, value)}</code>
            </span>
          </>
        )}
      </div>
      {parseError && (
        <div className="mt-1 text-xs text-red-700 dark:text-red-400">{parseError}</div>
      )}
    </div>
  );
}

export function KPIVerification({ initial, onSubmit, onSkip }: KPIVerificationProps) {
  const [values, setValues] = useState<KPIVerificationInputs>(initial);
  const [verified, setVerified] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [openTier, setOpenTier] = useState<"foundation" | "refinement" | "advanced">("foundation");

  const confidence = useMemo(() => computeConfidence(verified), [verified]);

  const commit = (key: keyof KPIVerificationInputs) => {
    const raw = drafts[key] ?? "";
    if (raw.trim() === "") {
      // Empty draft is fine (operator just blurred without typing).
      setErrors((cur) => {
        const { [key]: _drop, ...rest } = cur;
        return rest;
      });
      return;
    }
    const parsed = parseValue(key, raw);
    if (parsed !== null) {
      setValues((cur) => deriveValues({ ...cur, [key]: parsed }));
      setVerified((prev) => new Set(prev).add(key));
      setErrors((cur) => {
        const { [key]: _drop, ...rest } = cur;
        return rest;
      });
    } else {
      setErrors((cur) => ({ ...cur, [key]: "Couldn't parse — try a number like 5000 or 0.85." }));
    }
  };

  const advance = () => {
    onSubmit({ values: deriveValues(values), verified_fields: verified, confidence });
  };

  const renderRow = (d: KPIDescriptor) => (
    <KPIRow
      key={d.key}
      descriptor={d}
      value={values[d.key as keyof KPIVerificationInputs]}
      draft={drafts[d.key] ?? ""}
      verified={verified.has(d.key)}
      readOnly={d.derived}
      onChangeDraft={(v) => {
        setDrafts({ ...drafts, [d.key]: v });
        // Clear stale parse error as soon as the operator starts typing again.
        if (errors[d.key]) {
          setErrors((cur) => {
            const { [d.key]: _drop, ...rest } = cur;
            return rest;
          });
        }
      }}
      onCommit={() => commit(d.key as keyof KPIVerificationInputs)}
      parseError={errors[d.key]}
    />
  );

  return (
    <Card className="space-y-5 p-6">
      <div>
        <h2 className="text-lg font-semibold">A quick check before we run your projection</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          We'll show you the numbers that matter most first. If you know them, correct them — even rough
          corrections dramatically improve the strategy recommendation. You can stop at any tier.
        </p>
      </div>

      {/* Tier A — Foundation (always visible) */}
      <section>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">The four that matter most</div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {kpisByTier("foundation").map(renderRow)}
        </div>
      </section>

      {openTier === "foundation" && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={advance}>
            These look right <ArrowRight className="ml-1 size-3.5" />
          </Button>
          <Button variant="outline" onClick={() => setOpenTier("refinement")}>
            <Plus className="mr-1 size-3.5" /> Refine a few more
          </Button>
        </div>
      )}

      {/* Tier B — Refinement */}
      {(openTier === "refinement" || openTier === "advanced") && (
        <section>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">These help us tune the projection</div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {kpisByTier("refinement").map(renderRow)}
          </div>
        </section>
      )}

      {openTier === "refinement" && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={advance}>
            Good enough <ArrowRight className="ml-1 size-3.5" />
          </Button>
          <Button variant="outline" onClick={() => setOpenTier("advanced")}>
            <Plus className="mr-1 size-3.5" /> Add advanced inputs
          </Button>
        </div>
      )}

      {/* Tier C — Advanced */}
      {openTier === "advanced" && (
        <>
          <section>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">For operators who track these</div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {kpisByTier("advanced").map(renderRow)}
            </div>
          </section>
          <div>
            <Button onClick={advance}>
              Run projection <ArrowRight className="ml-1 size-3.5" />
            </Button>
          </div>
        </>
      )}

      {/* Soft low-confidence note (instead of the prior terminal-style banner) */}
      {confidence === "low" && (
        <div className="rounded-md border p-3 text-xs text-muted-foreground">
          We'll flag this projection as a <strong>rough draft</strong>. You can refine it anytime from your dashboard.
          <div className="mt-2 flex gap-2">
            <Button variant="outline" size="sm" onClick={onSkip}>
              Skip for now
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <span>
          {verified.size} of {KPI_DESCRIPTORS.filter((d) => !d.derived).length} verified ·
          confidence: <strong>{confidence}</strong>
          {confidence === "high" && <Check className="ml-1 inline size-3 text-emerald-500" />}
        </span>
        <button
          type="button"
          className="underline-offset-2 hover:underline"
          onClick={onSkip}
        >
          Skip this step
        </button>
      </div>
    </Card>
  );
}
