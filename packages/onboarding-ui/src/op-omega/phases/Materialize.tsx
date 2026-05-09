/** Finalize. Op-omega upstream `assembleCompanyManifest` produces the signed
 *  company.manifest.{json,yaml} + manifest.sig + mc-report.json. The wavex
 *  dashboard reads these via /api/instance/<companyId>/{manifest,kpis}. */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { opOmegaOnboardingApi, ApiError } from "../lib/api";
import type { CompanyManifest } from "@op-omega/plugin-onboarding";
import { Card, H2, NavRow, P } from "../components/primitives";
import { HaltScreen } from "../components/HaltScreen";

interface Props { companyId: string; }

interface FinalizeResult {
  manifest: CompanyManifest;
  sha256: string;
  source: "t2" | "fallback";
  warnings: string[];
}

export function Materialize({ companyId }: Props) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<FinalizeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [halt, setHalt] = useState<ApiError["halt"]>(undefined);
  const [skipInference, setSkipInference] = useState(false);

  async function finalize(): Promise<void> {
    setBusy(true);
    setError(null);
    setHalt(undefined);
    try {
      const r = await opOmegaOnboardingApi.finalize({
        companyId,
        skipInference,
        // Default MC params; production runs with horizon=30 cycles, n_runs=30, fixed seed for repro
        mc: { horizon_cycles: 30, n_runs: 30, seed: 42 },
      });
      setResult({ manifest: r.manifest, sha256: r.sha256, source: r.source, warnings: r.warnings });
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.halt) setHalt(e.halt);
        else setError(e.message);
      } else setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "2rem" }}>
      <H2>Finalize</H2>
      <P>
        Run Monte Carlo across 5 strategies, generate the imprint review,
        sign the manifest (sha256 over canonical JSON), and persist all
        files under <code>~/.wavex-os/instances/default/companies/{companyId}/onboarding/</code>.
        The dashboard at <code>/?companyId={companyId}</code> hydrates from there.
      </P>

      {error && <Card><p style={{ color: "var(--warning)", margin: 0 }}>✗ {error}</p></Card>}
      {halt && <HaltScreen halt={halt} onRetry={() => { setHalt(undefined); setError(null); }} />}

      {!result && !halt && (
        <Card>
          <label style={{ display: "block", marginBottom: "0.75rem", fontSize: 13 }}>
            <input type="checkbox" checked={skipInference} onChange={(e) => setSkipInference(e.target.checked)} />
            <span style={{ marginLeft: 6 }}>Skip T2 inference (fast deterministic-only finalize)</span>
          </label>
          <button onClick={() => void finalize()} type="button" disabled={busy}>
            {busy ? "Finalizing…" : "Finalize + sign →"}
          </button>
        </Card>
      )}

      {busy && (
        <Card>
          <div className="text-dim">
            Running Monte Carlo (30 cycles × 30 runs × 5 strategies)…
            {!skipInference && <> Generating imprint review via T2…</>}
            {" "}Signing canonical JSON…
          </div>
        </Card>
      )}

      {result && (
        <Card accent>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)", marginBottom: "0.5rem" }}>
            ✓ MATERIALIZED · source: {result.source}
          </div>

          <div style={{ fontSize: 13, marginBottom: "0.5rem" }}>
            <strong>Org:</strong> {result.manifest.org_id} · <strong>Finalized:</strong> {result.manifest.finalized_at.slice(0, 19)}
          </div>

          {result.manifest.mc_winner && (
            <div style={{ fontSize: 13, marginBottom: "0.5rem" }}>
              <strong>MC winner:</strong> <code>{result.manifest.mc_winner.strategy_id}</code>
              {" "}<span className="text-dim">
                · sharpe {result.manifest.mc_winner.sharpe.toFixed(3)}
                · MRR growth {result.manifest.mc_winner.mean_mrr_growth.toFixed(0)}
                · p_ruin {(result.manifest.mc_winner.p_ruin * 100).toFixed(1)}%
              </span>
            </div>
          )}

          {result.manifest.imprint_summary && (
            <div style={{ fontSize: 13, marginBottom: "0.5rem", padding: "0.5rem", background: "var(--bg)", borderRadius: 4 }}>
              <strong>Imprint:</strong> {result.manifest.imprint_summary}
            </div>
          )}

          <div className="text-dim" style={{ fontSize: 11, marginTop: "0.5rem" }} data-testid="finalize-sha256">
            sha256: <code>{result.sha256}</code>
          </div>

          {result.warnings.length > 0 && (
            <div style={{ marginTop: "0.5rem", padding: "0.5rem", background: "var(--bg)", border: "1px solid var(--warning)", borderRadius: 4, fontSize: 11 }}>
              <strong>Warnings:</strong>
              <ul style={{ margin: "0.25rem 0 0 1rem", padding: 0 }}>
                {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}
        </Card>
      )}

      <NavRow
        next={{ onClick: () => navigate(`/?companyId=${encodeURIComponent(companyId)}`), label: "Go to Mission Control →" }}
        nextDisabled={!result}
      />
    </div>
  );
}
