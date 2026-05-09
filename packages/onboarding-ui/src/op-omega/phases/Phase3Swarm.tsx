/** Phase 3 — derived swarm manifest. */

import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { opOmegaOnboardingApi } from "../lib/api";
import { Card, H2, NavRow, P } from "../components/primitives";

interface Props { companyId: string; onComplete: () => void; }

export function Phase3Swarm({ companyId, onComplete }: Props) {
  const generate = useMutation({
    mutationFn: () => opOmegaOnboardingApi.generateSwarm(companyId),
  });
  useEffect(() => { generate.mutate(); /* eslint-disable-next-line */ }, [companyId]);

  const agents = generate.data?.manifest.agents ?? [];

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "2rem" }}>
      <H2>Phase 3 — Swarm</H2>
      <P>Predicate-driven activation per docs/MINIMAL_INCEPTION.md L60-72. Kernel always active; C-suite roles activate by signal.</P>

      {generate.isPending && <div className="text-dim">Deriving activation rules…</div>}

      {agents.length > 0 && (
        <Card>
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Slot", "Reports to", "Confidence", "Adapter / Model", "Heartbeat", "KPIs"].map((h) =>
                  <th key={h} style={{ textAlign: "left", padding: "0.5rem 0.75rem", fontWeight: 600, color: "var(--text-dim)" }}>{h}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.slot} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.5rem 0.75rem", fontWeight: 600 }}>{a.slot}</td>
                  <td style={{ padding: "0.5rem 0.75rem", color: "var(--text-dim)" }}>{a.reportsToSlot ?? "—"}</td>
                  <td style={{ padding: "0.5rem 0.75rem", color: "var(--text-dim)" }}>{a.confidenceLevel}</td>
                  <td style={{ padding: "0.5rem 0.75rem", fontSize: 11, color: "var(--text-dim)" }}>{a.adapter} / {a.model}</td>
                  <td style={{ padding: "0.5rem 0.75rem", color: "var(--text-dim)" }}>{a.heartbeat}</td>
                  <td style={{ padding: "0.5rem 0.75rem", fontSize: 11, color: "var(--text-dim)" }}>{a.ownedKpiIds.join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <NavRow next={{ onClick: onComplete, label: "Continue → workflows" }} nextDisabled={generate.isPending} />
    </div>
  );
}
