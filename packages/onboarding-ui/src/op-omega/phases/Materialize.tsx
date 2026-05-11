/** Finalize. Op-omega upstream `assembleCompanyManifest` produces the signed
 *  company.manifest.{json,yaml} + manifest.sig + mc-report.json. The wavex
 *  dashboard reads these via /api/instance/<companyId>/{manifest,kpis}. */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { opOmegaOnboardingApi, ApiError } from "../lib/api";
import type { CompanyManifest } from "@op-omega/plugin-onboarding";
import { Card, H2, P } from "../components/primitives";
import { HaltScreen } from "../components/HaltScreen";
import { RefinementPanel } from "./RefinementPanel";
import { RedundancyReview } from "../components/RedundancyReview";

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
  const [activating, setActivating] = useState(false);
  const [activated, setActivated] = useState<{ companies: number; agents: number } | null>(null);
  const [activateError, setActivateError] = useState<string | null>(null);

  async function activateAndNavigate(): Promise<void> {
    setActivating(true);
    setActivateError(null);
    try {
      const r = await opOmegaOnboardingApi.activate(companyId);
      setActivated(r.inserted);
      // Brief pause so the operator sees the summary before navigating
      setTimeout(() => navigate(`/?companyId=${encodeURIComponent(companyId)}`), 800);
    } catch (e) {
      setActivateError(e instanceof Error ? e.message : String(e));
    } finally {
      setActivating(false);
    }
  }

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
    // paddingBottom leaves room for the sticky footer so the last bit of
    // content (errors, redundancy panel, refinement) isn't hidden behind it.
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "2rem", paddingBottom: "6rem" }}>
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

      {result && (
        <RefinementPanel
          companyId={companyId}
          hasRefinementHistory={Boolean(
            (result.manifest as CompanyManifest & { refinement_history?: unknown[] })
              .refinement_history?.length,
          )}
          onManifestUpdated={(manifest, sha256) =>
            setResult({ manifest, sha256, source: "t2", warnings: [] })}
        />
      )}

      {/* Redundancy review — operator can mute duplicate-template slots
          before the bridge writes them to DB. Only renders once finalize
          has produced the manifest. */}
      {result && <RedundancyReview companyId={companyId} />}

      {activated && (
        <Card accent>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>
            ✓ Activated · {activated.companies} company / {activated.agents} agents written to db
          </div>
        </Card>
      )}

      {activateError && (
        <Card>
          <p style={{ color: "var(--warning)", margin: 0 }}>✗ Activation failed: {activateError}</p>
        </Card>
      )}

      {/* Sticky activate footer — keeps the primary CTA reachable no matter
          how tall the redundancy review or refinement panels grow. We
          render the button directly (rather than via NavRow) because
          .nav-buttons applies margin-top: 3rem + padding-top: 2rem from
          the global stylesheet, which would push the button below the
          viewport edge inside this fixed container. */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "color-mix(in srgb, var(--surface) 92%, transparent)",
        borderTop: "1px solid var(--border)",
        backdropFilter: "blur(6px)",
        padding: "0.75rem 2rem",
        zIndex: 20,
      }}>
        <div style={{
          maxWidth: 1280, margin: "0 auto",
          display: "flex", justifyContent: "flex-end",
        }}>
          <button
            type="button"
            onClick={() => void activateAndNavigate()}
            disabled={!result || activating}
          >
            {activating ? "Activating…" : "Activate fleet →"}
          </button>
        </div>
      </div>
    </div>
  );
}
