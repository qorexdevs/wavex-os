/** Phase 4 — derived workflow manifest. */

import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { opOmegaOnboardingApi } from "../lib/api";
import { Card, H2, NavRow, P } from "../components/primitives";

interface Props { companyId: string; onComplete: () => void; }

export function Phase4Workflows({ companyId, onComplete }: Props) {
  const generate = useMutation({
    mutationFn: () => opOmegaOnboardingApi.generateWorkflow(companyId),
  });
  useEffect(() => { generate.mutate(); /* eslint-disable-next-line */ }, [companyId]);

  const m = generate.data?.manifest;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "2rem" }}>
      <H2>Phase 4 — Workflows</H2>
      <P>Per-agent on_fire sequences + scheduled routines. Op-omega F5 audit trail (T2 patches with rationale + pillar_signal) lands when wavex-server inference is wired.</P>

      {generate.isPending && <div className="text-dim">Deriving workflow templates…</div>}

      {m && (
        <>
          <Card>
            <h3 style={{ marginTop: 0, fontSize: 14, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Workflows ({m.workflows.length})</h3>
            {m.workflows.map((w) => (
              <div key={w.slot} style={{ borderBottom: "1px solid var(--border)", padding: "0.5rem 0", fontSize: 13 }}>
                <div style={{ fontWeight: 600 }}>{w.slot}</div>
                <div className="text-dim" style={{ fontSize: 11 }}>triggers: {w.triggers.join(", ")}</div>
                <div className="text-dim" style={{ fontSize: 11 }}>steps: {w.on_fire.map((s) => s.action).join(" → ")}</div>
              </div>
            ))}
          </Card>
          {m.routines.length > 0 && (
            <Card>
              <h3 style={{ marginTop: 0, fontSize: 14, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Scheduled routines ({m.routines.length})</h3>
              {m.routines.map((r) => (
                <div key={r.name} style={{ borderBottom: "1px solid var(--border)", padding: "0.5rem 0", fontSize: 13 }}>
                  <div style={{ fontWeight: 600 }}><code>{r.name}</code> <span className="text-dim" style={{ fontWeight: 400 }}>· {r.cadence} · owner {r.owner_slot}</span></div>
                  <div className="text-dim" style={{ fontSize: 12 }}>{r.description}</div>
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      <NavRow next={{ onClick: onComplete, label: "Continue → finalize" }} nextDisabled={generate.isPending} />
    </div>
  );
}
