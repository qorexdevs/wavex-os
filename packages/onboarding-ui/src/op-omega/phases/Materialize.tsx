/** Finalize + Materialize. Signs the manifest, projects to wavex shapes,
 * shows post-spawn ready state with link to dashboard. */

import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { opOmegaOnboardingApi, ApiError } from "../lib/api";
import { Card, H2, NavRow, P } from "../components/primitives";
import { HaltScreen } from "../components/HaltScreen";

interface Props { companyId: string; }

export function Materialize({ companyId }: Props) {
  const navigate = useNavigate();
  const finalize = useMutation({
    mutationFn: () => opOmegaOnboardingApi.complete(companyId),
  });

  const halt = finalize.error instanceof ApiError ? finalize.error.halt : undefined;
  const ready = finalize.data?.ok === true;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "2rem" }}>
      <H2>Finalize</H2>
      <P>
        Sign the manifest (sha256 over canonical JSON), persist all 4 op-omega native files,
        and project the wavex contract: <code>agents.json</code>, <code>kpi-registry.json</code>,
        <code>wavex-os.config.json</code>. The runtime layer (healing/observability/launchd)
        consumes the projection.
      </P>

      {!finalize.isPending && !ready && !halt && (
        <Card>
          <button onClick={() => finalize.mutate()} type="button">Materialize + spawn →</button>
        </Card>
      )}

      {finalize.isPending && (
        <Card>
          <div className="text-dim">Signing manifest, persisting projection, emitting spawn events…</div>
        </Card>
      )}

      {halt && <HaltScreen halt={halt} onRetry={() => finalize.reset()} />}

      {ready && (
        <Card accent>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)", marginBottom: "0.5rem" }}>
            ✓ MATERIALIZED
          </div>
          <div className="text-dim" style={{ fontSize: 12, marginBottom: "0.5rem" }}>files:</div>
          <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: 12, color: "var(--text-dim)" }}>
            {(finalize.data?.files ?? []).map((f) => <li key={f}><code>{f}</code></li>)}
          </ul>
          <div className="text-dim" style={{ fontSize: 11, marginTop: "0.75rem" }} data-testid="finalize-sha256">
            sha256: {finalize.data?.sha256}
          </div>
        </Card>
      )}

      <NavRow
        next={{ onClick: () => navigate(`/?companyId=${encodeURIComponent(companyId)}`), label: "Go to Mission Control →" }}
        nextDisabled={!ready}
      />
    </div>
  );
}
