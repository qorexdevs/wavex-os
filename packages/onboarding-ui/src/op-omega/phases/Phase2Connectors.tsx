/** Phase 2 — derived connector manifest. */

import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { opOmegaOnboardingApi } from "../lib/api";
import { Card, H2, NavRow, P } from "../components/primitives";

interface Props { companyId: string; onComplete: () => void; }

export function Phase2Connectors({ companyId, onComplete }: Props) {
  const generate = useMutation({
    mutationFn: () => opOmegaOnboardingApi.generateConnector(companyId),
  });
  useEffect(() => { generate.mutate(); /* eslint-disable-next-line */ }, [companyId]);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "2rem" }}>
      <H2>Phase 2 — Connectors</H2>
      <P>Derived deterministically from Pillars 3, 4, 5. Required connectors must succeed before materialize. Suggested can be skipped now.</P>

      {generate.isPending && <div className="text-dim">Deriving from your pillar responses…</div>}

      {generate.data?.manifest.entries.map((c) => (
        <Card key={c.id}>
          <div style={{ fontWeight: 600 }}>
            {c.id}
            <span style={{
              marginLeft: "0.5rem", fontSize: 11, fontWeight: 600, textTransform: "uppercase",
              color: c.bucket === "required" ? "var(--warning)" : c.bucket === "suggested" ? "var(--accent)" : "var(--text-dim)",
            }}>{c.bucket}</span>
          </div>
          <div className="text-dim" style={{ fontSize: 13, marginTop: "0.25rem" }}>{c.rationale}</div>
          <div className="text-dim" style={{ fontSize: 11, marginTop: "0.25rem" }}>signals: {c.pillar_signals.join(", ")}</div>
          {c.credential_keys && (
            <div className="text-dim" style={{ fontSize: 11, marginTop: "0.25rem" }}>
              vault keys: {c.credential_keys.join(", ")}
            </div>
          )}
        </Card>
      ))}

      <NavRow next={{ onClick: onComplete, label: "Continue → derive swarm" }} nextDisabled={generate.isPending} />
    </div>
  );
}
