import { Building2, FileText, Gauge, Network, ShieldCheck, Target } from "lucide-react";
import { contextualizeMCResult, mcStatLabels, type MCWinner } from "../../../i18n/mc-context";
import { displayStrategy } from "../../../i18n/strategy-names";
import { Stat } from "./primitives";

/**
 * Section labels mirror the 4-paragraph structure the imprint-review prompt
 * asks T2 to produce (`packages/plugins/onboarding/src/phases/finalize/imprint-review.ts`):
 *  ¶1 who + current state
 *  ¶2 deployed system
 *  ¶3 MC strategy
 *  ¶4 dry-run expectations
 *
 * If the model returns more or fewer paragraphs we render whatever we have
 * without forcing exactly four.
 */
const IMPRINT_SECTION_LABELS = [
  { label: "Who you are today", icon: Building2 },
  { label: "What we deployed", icon: Network },
  { label: "Recommended path", icon: Target },
  { label: "Dry-run expectations", icon: ShieldCheck },
] as const;

function splitImprintSections(summary: string): string[] {
  return summary
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

export function CompanyView({
  data,
  stage,
}: {
  data: {
    org_id: string;
    mc_winner: MCWinner;
    imprint_summary: string;
    dry_run: { enabled: boolean; expires_at: string };
    signatures: { manifest_hash: string };
  };
  stage?: string;
}) {
  const w = data.mc_winner;
  const d = displayStrategy(w.strategy_id);
  const labels = mcStatLabels(stage ?? "");
  const contextLine = contextualizeMCResult(w, stage ?? "");
  const paragraphs = splitImprintSections(data.imprint_summary);
  return (
    <div className="space-y-3 text-sm">
      <section className="rounded-md border bg-emerald-500/5 p-3">
        <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase text-emerald-700 dark:text-emerald-400">
          <Gauge className="size-3.5" /> Recommended strategy
        </div>
        <div className="text-lg font-bold">{d.display_name}</div>
        <div className="mt-1 text-xs text-muted-foreground">{contextLine}</div>
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <Stat label={labels.primary_label} v={labels.primary_value(w)} />
          <Stat label={labels.secondary_label} v={labels.secondary_value(w)} />
        </div>
      </section>
      <section>
        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase text-muted-foreground">
          <FileText className="size-3.5" /> Your strategy review
        </div>
        {paragraphs.length === 0 ? (
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{data.imprint_summary}</div>
        ) : (
          <div className="space-y-3">
            {paragraphs.map((p, i) => {
              const meta = IMPRINT_SECTION_LABELS[i];
              const Icon = meta?.icon ?? FileText;
              return (
                <div key={i} className="rounded-md border p-3">
                  <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <Icon className="size-3.5" /> {meta?.label ?? `Section ${i + 1}`}
                  </div>
                  <div className="text-sm leading-relaxed">{p}</div>
                </div>
              );
            })}
          </div>
        )}
      </section>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>
          {data.dry_run.enabled
            ? `Actions held for your review until ${new Date(data.dry_run.expires_at).toLocaleDateString()}`
            : "Actions going live"}
        </span>
      </div>
    </div>
  );
}
