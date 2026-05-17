/**
 * Operator Ω · Flywheel Panel
 *
 * Dashboard widget that visualizes the closed-loop execution of the revenue
 * flywheel per OPERATOR Ω Master Spec v1.0:
 *
 *   1. Flywheel score — the 4 criticality conditions (NRR > 1.10, burn < 1.5,
 *      activation rising, sales cycle compressing). All four true = auto-catalytic.
 *   2. Activity bundle status — the 5 canonical bundles and their last cycle.
 *   3. KPI deltas — the state vector that feeds R(t+1) = R(t) · [growth · efficiency · narrative].
 *   4. Flow-type traffic — ASN / TLM / CON / VAL counts from the flow-types plugin.
 *
 * Data skeleton — returns zero-state when connectors have not yet populated
 * KPIs. As connectors wire up (starting with Stripe via the Ω-chat onboarding
 * subflow), real numbers replace the placeholders.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Gauge, Zap, Compass, Coins, Target, Activity, Plug } from "lucide-react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { ConnectorOnboardingDialog } from "./ConnectorOnboardingDialog";

interface CriticalityFlags {
  nrrAbove110: boolean;
  burnBelow15: boolean;
  activationRising: boolean;
  cycleCompressing: boolean;
}

interface KpiSnapshot {
  mrr: number;
  nrr: number;
  grr: number;
  burnMultiple: number;
  cacPaybackMonths: number;
  activationRate: number;
  salesCycleDays: number;
  winRate: number;
  narrativeStrength: number;
}

interface BundleStatus {
  id: "insight_activation" | "pipeline_velocity" | "expansion_engine" | "unit_econ_defender" | "strategic_positioning";
  lastRunAt: string | null;
  lastOutcome: "ok" | "partial" | "failed" | "idle";
  deliverable: string;
}

interface FlowTraffic {
  ASN: number;
  TLM: number;
  CON: number;
  VAL: number;
}

interface FlywheelSnapshot {
  criticality: CriticalityFlags;
  flywheelScore: 0 | 1 | 2 | 3 | 4;
  autoCatalytic: boolean;
  kpis: KpiSnapshot;
  bundles: BundleStatus[];
  flowTraffic: FlowTraffic;
  asOf: string;
  hasRealData: boolean;
}

const ZERO_SNAPSHOT: FlywheelSnapshot = {
  criticality: { nrrAbove110: false, burnBelow15: false, activationRising: false, cycleCompressing: false },
  flywheelScore: 0,
  autoCatalytic: false,
  kpis: {
    mrr: 0, nrr: 1.0, grr: 1.0, burnMultiple: 0, cacPaybackMonths: 0,
    activationRate: 0, salesCycleDays: 0, winRate: 0, narrativeStrength: 0,
  },
  bundles: [
    { id: "insight_activation", lastRunAt: null, lastOutcome: "idle", deliverable: "Activation lift + retention signal" },
    { id: "pipeline_velocity", lastRunAt: null, lastOutcome: "idle", deliverable: "Closed revenue + reallocated channel budget" },
    { id: "expansion_engine", lastRunAt: null, lastOutcome: "idle", deliverable: "NRR lift + case study + referral pipeline" },
    { id: "unit_econ_defender", lastRunAt: null, lastOutcome: "idle", deliverable: "Burn reduction + payback compression" },
    { id: "strategic_positioning", lastRunAt: null, lastOutcome: "idle", deliverable: "Narrative realignment + inbound lift" },
  ],
  flowTraffic: { ASN: 0, TLM: 0, CON: 0, VAL: 0 },
  asOf: new Date().toISOString(),
  hasRealData: false,
};

const BUNDLE_LABELS: Record<BundleStatus["id"], string> = {
  insight_activation: "Insight → Activation",
  pipeline_velocity: "Pipeline Velocity",
  expansion_engine: "Expansion Engine ★",
  unit_econ_defender: "Unit-Econ Defender",
  strategic_positioning: "Strategic Positioning",
};

const OUTCOME_COLORS: Record<BundleStatus["lastOutcome"], string> = {
  ok: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  partial: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  failed: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
  idle: "bg-muted text-muted-foreground border-border",
};

const FLOW_COLORS: Record<keyof FlowTraffic, string> = {
  ASN: "#c11b2a",
  TLM: "#1565c0",
  CON: "#d4751f",
  VAL: "#2e7d32",
};

async function fetchFlywheelSnapshot(_companyId: string): Promise<FlywheelSnapshot> {
  // TODO: replace with a real /api/wavex-os/flywheel endpoint once connectors
  // populate KPI state. For now the panel renders the zero-state skeleton so
  // the layout and wiring land first.
  return ZERO_SNAPSHOT;
}

function CriticalityChip({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
        ok
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-border bg-muted text-muted-foreground"
      }`}
    >
      <span
        className={`inline-block size-2 rounded-full ${ok ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
        aria-hidden
      />
      <span>{label}</span>
    </div>
  );
}

function KpiRow({ icon: Icon, label, value, tone }: { icon: typeof Coins; label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="size-3.5" />
        <span>{label}</span>
      </div>
      <span className={`font-mono font-medium tabular-nums ${tone ?? "text-foreground"}`}>{value}</span>
    </div>
  );
}

export function FlywheelPanel({ companyId }: { companyId: string }) {
  const [onboardOpen, setOnboardOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["wavex-os", "flywheel", companyId],
    queryFn: () => fetchFlywheelSnapshot(companyId),
    enabled: !!companyId,
  });
  const snap = data ?? ZERO_SNAPSHOT;
  const score = snap.flywheelScore;
  const scoreColor =
    score === 4 ? "text-emerald-500" : score >= 2 ? "text-amber-500" : "text-muted-foreground";

  const flowMax = Math.max(1, snap.flowTraffic.ASN, snap.flowTraffic.TLM, snap.flowTraffic.CON, snap.flowTraffic.VAL);

  return (
    <Card className="p-4 space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge className={`size-4 ${scoreColor}`} />
          <h3 className="text-sm font-semibold">Revenue Flywheel</h3>
          <span className={`text-sm font-mono font-medium ${scoreColor}`}>{score}/4</span>
          {snap.autoCatalytic && (
            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-300">
              AUTO-CATALYTIC
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">
            {isLoading ? "loading…" : snap.hasRealData ? `as of ${new Date(snap.asOf).toLocaleTimeString()}` : "zero-state · connectors not wired"}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 px-2 text-xs"
            onClick={() => setOnboardOpen(true)}
          >
            <Plug className="size-3.5" />
            Connect
          </Button>
        </div>
      </header>

      <ConnectorOnboardingDialog open={onboardOpen} onOpenChange={setOnboardOpen} companyId={companyId} />

      <section>
        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Criticality Conditions
        </div>
        <div className="flex flex-wrap gap-1.5">
          <CriticalityChip label="NRR > 1.10" ok={snap.criticality.nrrAbove110} />
          <CriticalityChip label="Burn < 1.5" ok={snap.criticality.burnBelow15} />
          <CriticalityChip label="Activation ↑" ok={snap.criticality.activationRising} />
          <CriticalityChip label="Cycle ↓" ok={snap.criticality.cycleCompressing} />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        <KpiRow icon={Coins} label="MRR" value={snap.kpis.mrr ? `$${snap.kpis.mrr.toLocaleString()}` : "—"} />
        <KpiRow icon={Target} label="NRR" value={snap.kpis.nrr ? `${(snap.kpis.nrr * 100).toFixed(1)}%` : "—"} />
        <KpiRow icon={Zap} label="Activation rate" value={snap.kpis.activationRate ? `${(snap.kpis.activationRate * 100).toFixed(1)}%` : "—"} />
        <KpiRow icon={Compass} label="Sales cycle" value={snap.kpis.salesCycleDays ? `${snap.kpis.salesCycleDays.toFixed(1)}d` : "—"} />
        <KpiRow icon={Activity} label="Burn multiple" value={snap.kpis.burnMultiple ? snap.kpis.burnMultiple.toFixed(2) : "—"} />
        <KpiRow icon={Gauge} label="Narrative" value={snap.kpis.narrativeStrength ? `${(snap.kpis.narrativeStrength * 100).toFixed(0)}` : "—"} />
      </section>

      <section>
        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Activity Bundles
        </div>
        <div className="space-y-1">
          {snap.bundles.map((b) => (
            <div key={b.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate">{BUNDLE_LABELS[b.id]}</span>
              <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${OUTCOME_COLORS[b.lastOutcome]}`}>
                {b.lastOutcome}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Flow-type Traffic (last 24h)
        </div>
        <div className="space-y-1">
          {(Object.keys(FLOW_COLORS) as Array<keyof FlowTraffic>).map((ft) => {
            const count = snap.flowTraffic[ft];
            const pct = (count / flowMax) * 100;
            return (
              <div key={ft} className="flex items-center gap-2 text-[11px]">
                <span className="w-8 font-mono font-semibold" style={{ color: FLOW_COLORS[ft] }}>{ft}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded bg-muted">
                  <div className="h-full rounded" style={{ width: `${pct}%`, background: FLOW_COLORS[ft] }} />
                </div>
                <span className="w-8 text-right font-mono tabular-nums text-muted-foreground">{count}</span>
              </div>
            );
          })}
        </div>
      </section>
    </Card>
  );
}
