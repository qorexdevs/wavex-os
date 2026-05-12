/** Wavex KPI scoreboard rendered on the Paperclip Dashboard.
 *
 *  Pulls the signed company manifest (headline goal) + KPI registry from
 *  wavex mock-core via cross-origin fetch. Hides itself for non-wavex
 *  Paperclip companies so plain Paperclip use stays untouched. */

import { useQuery } from "@tanstack/react-query";
import { Target } from "lucide-react";
import { wavexApi, deriveWavexCompanyId } from "../lib/wavex-link";

interface Props {
  paperclipCompany: { name: string; description?: string | null } | null | undefined;
}

export function WavexKpiPanel({ paperclipCompany }: Props) {
  const wavexId = deriveWavexCompanyId(paperclipCompany);
  const manifestQ = useQuery({
    enabled: !!wavexId,
    queryKey: ["wavex-manifest", wavexId],
    queryFn: () => wavexApi.manifest(wavexId!),
    refetchInterval: 30_000,
    retry: false,
  });
  const kpisQ = useQuery({
    enabled: !!wavexId && manifestQ.data?.ok === true,
    queryKey: ["wavex-kpis", wavexId],
    queryFn: () => wavexApi.kpis(wavexId!),
    refetchInterval: 30_000,
    retry: false,
  });

  // Hide entirely for non-wavex companies — no regression for plain Paperclip
  if (!wavexId) return null;
  // Manifest fetch failed (e.g. wavex mock-core down) — also hide quietly
  if (manifestQ.isError) return null;
  if (manifestQ.isLoading) return null;
  if (!manifestQ.data?.ok) return null;

  const goal = manifestQ.data.manifest?.goal;
  const kpis = kpisQ.data?.kpis ?? [];
  const headline = kpis[0];

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Target className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">
          KPI scoreboard
          <span className="text-muted-foreground font-normal ml-2">
            {manifestQ.data.manifest?.company?.name ?? wavexId}
          </span>
        </h3>
      </div>
      {headline && (
        <div className="mb-3 rounded-lg border bg-background p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Headline goal
          </div>
          <div className="text-base font-semibold mt-1">{headline.label}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {goal?.current != null && goal?.target != null
              ? `${goal.current.toLocaleString()} → ${goal.target.toLocaleString()} (${goal.days}d window)`
              : "No baseline captured yet"}
          </div>
        </div>
      )}
      {kpis.length > 1 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
            Supporting KPIs
          </div>
          <ul className="divide-y divide-border">
            {kpis.slice(1).map((k) => (
              <li key={k.kpiId} className="flex items-center justify-between py-1.5 text-sm">
                <span>{k.label}</span>
                <span className="text-xs text-muted-foreground">
                  {k.ownerRole ? `owned by ${k.ownerRole}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {kpis.length === 0 && (
        <p className="text-xs text-muted-foreground">No KPIs in registry.</p>
      )}
    </div>
  );
}
