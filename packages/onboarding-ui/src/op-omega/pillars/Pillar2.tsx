/** Pillar 2 — Inference Bootstrap (gate). Op-omega upstream contract:
 *  Input  : { companyId, claude_plan, claude_plan_other_note? }
 *  Output : Pillar2Outcome { response, ok, fix_hint? }
 *    The plugin probes the configured claudeBin to verify install + auth. */

import { useEffect, useState } from "react";
import { opOmegaOnboardingApi, ApiError } from "../lib/api";
import type { ProbeResponse } from "../lib/api";
import type { Pillar2Outcome } from "@op-omega/plugin-onboarding";
import { Card, Field, H2, NavRow, P } from "../components/primitives";

interface Props {
  companyId: string;
  onComplete: () => void;
}

type Plan = "max_20x" | "max_5x" | "api_only" | "other";

export function Pillar2({ companyId, onComplete }: Props) {
  const [plan, setPlan] = useState<Plan>("max_5x");
  const [otherNote, setOtherNote] = useState("");
  const [probe, setProbe] = useState<ProbeResponse["probe"] | null>(null);
  const [outcome, setOutcome] = useState<Pillar2Outcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runProbe(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const r = await opOmegaOnboardingApi.claudeCodeCheck();
      setProbe(r.probe ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verify(): Promise<void> {
    setBusy(true);
    setError(null);
    setOutcome(null);
    try {
      const r = await opOmegaOnboardingApi.pillar2({
        companyId,
        claude_plan: plan,
        claude_plan_other_note: plan === "other" ? otherNote : undefined,
      });
      setOutcome(r);
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void runProbe(); }, []);

  const verified = outcome?.ok === true && outcome.response.claude_code_verified === true;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "2rem" }}>
      <H2>Pillar 2 — Inference Bootstrap</H2>
      <P>
        Your fleet needs Claude. Pick your plan + verify the keychain credential
        is reachable. Token never leaves your machine — the wrapper script reads
        it on every agent heartbeat.
      </P>

      {error && <Card><p style={{ color: "var(--warning)", margin: 0 }}>✗ {error}</p></Card>}

      <Card>
        <h3 style={{ margin: "0 0 0.5rem", fontSize: 14, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Live probe
        </h3>
        {!probe && busy && <p className="text-dim">Probing claude CLI…</p>}
        {probe && (
          <table style={{ width: "100%", fontSize: 13 }}>
            <tbody>
              <tr><td className="text-dim" style={{ padding: "0.3rem 0", width: 140 }}>Installed</td>
                  <td>{probe.installed ? `✓ ${probe.version ?? ""}` : "✗ not found"}</td></tr>
              <tr><td className="text-dim" style={{ padding: "0.3rem 0" }}>Authenticated</td>
                  <td>{probe.authenticated ? "✓ token valid" : `✗ ${probe.error ?? "auth failed"}`}</td></tr>
            </tbody>
          </table>
        )}
        <button type="button" className="secondary" onClick={() => void runProbe()} disabled={busy} style={{ marginTop: "0.5rem", fontSize: 12 }}>
          Re-probe
        </button>
      </Card>

      <Card>
        <Field label="Claude plan" required>
          <select value={plan} onChange={(e) => setPlan(e.target.value as Plan)}>
            <option value="max_20x">Max 20x (highest throughput)</option>
            <option value="max_5x">Max 5x (default)</option>
            <option value="api_only">API key only (no Max plan)</option>
            <option value="other">Other</option>
          </select>
        </Field>
        {plan === "other" && (
          <Field label="Plan note">
            <input value={otherNote} onChange={(e) => setOtherNote(e.target.value)} placeholder="Describe your plan" />
          </Field>
        )}

        {outcome && (
          <div style={{ marginTop: "1rem", padding: "0.75rem", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 4, fontSize: 13 }}>
            <div><strong>Verified:</strong> {outcome.response.claude_code_verified ? "yes" : "no"}</div>
            <div><strong>Plan:</strong> <code>{outcome.response.claude_plan}</code></div>
            {outcome.fix_hint && <div style={{ color: "var(--warning)" }}><strong>Fix:</strong> {outcome.fix_hint}</div>}
          </div>
        )}
      </Card>

      <NavRow
        next={verified
          ? { onClick: onComplete, label: "Continue →" }
          : { onClick: verify, label: busy ? "Verifying…" : "Verify →" }}
        nextDisabled={busy || (plan === "other" && otherNote.trim().length === 0)}
      />
    </div>
  );
}
