/** Op-omega onboarding host shell. Single-SPA pattern (no react-router
 * subroutes) — the Phase state machine drives subview switches. Hydrates
 * from /op-omega/onboarding/status on mount + after each pillar/phase. */

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { opOmegaOnboardingApi } from "./lib/api";
import { useCompany } from "./lib/CompanyContext";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { Pillar1 } from "./pillars/Pillar1";
import { Pillar2 } from "./pillars/Pillar2";
import { Pillar3 } from "./pillars/Pillar3";
import { Pillar4 } from "./pillars/Pillar4";
import { Pillar5 } from "./pillars/Pillar5";
import { Phase2Connectors } from "./phases/Phase2Connectors";
import { Phase3Swarm } from "./phases/Phase3Swarm";
import { Phase4Workflows } from "./phases/Phase4Workflows";
import { Materialize } from "./phases/Materialize";

type Phase =
  | "welcome"
  | "pillar-1" | "pillar-2" | "pillar-3" | "pillar-4" | "pillar-5"
  | "phase-2-connectors" | "phase-3-swarm" | "phase-4-workflows"
  | "materialize"
  | "done";

export function OmegaOnboarding() {
  const { companyId } = useCompany();
  const qc = useQueryClient();

  // No company yet → welcome screen
  if (!companyId) return <WelcomeScreen />;

  return <CompanyWizard companyId={companyId} qc={qc} />;
}

function CompanyWizard({ companyId, qc }: { companyId: string; qc: ReturnType<typeof useQueryClient> }) {
  const status = useQuery({
    queryKey: ["status", companyId],
    queryFn: () => opOmegaOnboardingApi.status(companyId),
  });

  const [phase, setPhase] = useState<Phase>("welcome");

  // Auto-route from server status
  useEffect(() => {
    if (!status.data) return;
    const s = status.data;
    if (s.complete) { setPhase("done"); return; }
    if (s.has_workflow_manifest) { setPhase("materialize"); return; }
    if (s.has_swarm_manifest) { setPhase("phase-4-workflows"); return; }
    if (s.has_connector_manifest) { setPhase("phase-3-swarm"); return; }
    if (s.phase_1_complete) { setPhase("phase-2-connectors"); return; }
    if (s.next_pillar) { setPhase(`pillar-${s.next_pillar}` as Phase); return; }
    setPhase("pillar-1");
  }, [status.data]);

  const advance = (next: Phase) => {
    setPhase(next);
    qc.invalidateQueries({ queryKey: ["status", companyId] });
  };

  if (status.isLoading) {
    return <div style={{ padding: "2rem", color: "var(--text-dim)" }}>Loading state for {companyId}…</div>;
  }
  if (status.isError) {
    return <div style={{ padding: "2rem", color: "var(--warning)" }}>Status fetch failed: {(status.error as Error).message}</div>;
  }

  const pr = status.data?.pillar_responses;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Header companyId={companyId} phase={phase} />

      {phase === "pillar-1" && (
        <Pillar1 companyId={companyId} initial={pr?.pillar1} onComplete={() => advance("pillar-2")} />
      )}
      {phase === "pillar-2" && (
        <Pillar2 companyId={companyId} onComplete={() => advance("pillar-3")} />
      )}
      {phase === "pillar-3" && (
        <Pillar3 companyId={companyId} initial={pr?.pillar3} onComplete={() => advance("pillar-4")} />
      )}
      {phase === "pillar-4" && (
        <Pillar4 companyId={companyId} initial={pr?.pillar4} onComplete={() => advance("pillar-5")} />
      )}
      {phase === "pillar-5" && (
        <Pillar5 companyId={companyId} initial={pr?.pillar5} onComplete={() => advance("phase-2-connectors")} />
      )}
      {phase === "phase-2-connectors" && (
        <Phase2Connectors companyId={companyId} onComplete={() => advance("phase-3-swarm")} />
      )}
      {phase === "phase-3-swarm" && (
        <Phase3Swarm companyId={companyId} onComplete={() => advance("phase-4-workflows")} />
      )}
      {phase === "phase-4-workflows" && (
        <Phase4Workflows companyId={companyId} onComplete={() => advance("materialize")} />
      )}
      {phase === "materialize" && (
        <Materialize companyId={companyId} />
      )}
      {phase === "done" && (
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "2rem" }}>
          <h2>Already materialized</h2>
          <p className="text-dim">
            <code>{companyId}</code> has a signed manifest. Visit Mission Control to see the fleet.
          </p>
          <a href={`/?companyId=${encodeURIComponent(companyId)}`}><button>Go to Mission Control →</button></a>
        </div>
      )}
    </div>
  );
}

function Header({ companyId, phase }: { companyId: string; phase: Phase }) {
  const STEPS: Array<{ key: Phase; label: string }> = [
    { key: "pillar-1", label: "1·Identity" },
    { key: "pillar-2", label: "2·Inference" },
    { key: "pillar-3", label: "3·Stage" },
    { key: "pillar-4", label: "4·GTM" },
    { key: "pillar-5", label: "5·Comms" },
    { key: "phase-2-connectors", label: "Connectors" },
    { key: "phase-3-swarm", label: "Swarm" },
    { key: "phase-4-workflows", label: "Workflows" },
    { key: "materialize", label: "Finalize" },
  ];
  const idx = STEPS.findIndex((s) => s.key === phase);

  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 10,
      background: "var(--surface)", borderBottom: "1px solid var(--border)",
      padding: "0.75rem 2rem",
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem",
    }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem" }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>WaveX OS</span>
        <span className="text-dim" style={{ fontSize: 12 }}>· Onboarding · <code>{companyId}</code></span>
      </div>
      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
        {STEPS.map((s, i) => (
          <span
            key={s.key}
            style={{
              fontSize: 11, padding: "0.2rem 0.5rem", borderRadius: 4,
              border: "1px solid var(--border)",
              background: i === idx ? "var(--accent)" : i < idx ? "var(--surface-2)" : "transparent",
              color: i === idx ? "var(--bg)" : i < idx ? "var(--text)" : "var(--text-dim)",
              fontWeight: i === idx ? 700 : 400,
            }}
          >
            {s.label}
          </span>
        ))}
      </div>
    </header>
  );
}
