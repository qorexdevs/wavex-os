/** Pillar 2 — Inference Bootstrap (gate). */

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { opOmegaOnboardingApi } from "../lib/api";
import { Card, H2, NavRow, P } from "../components/primitives";

interface Props {
  companyId: string;
  onComplete: () => void;
}

interface ProbeOutcome {
  verified: boolean;
  fixHint?: string;
  plan?: string;
}

export function Pillar2({ companyId, onComplete }: Props) {
  // Use explicit local state instead of useMutation because the server returns
  // ok:false when verification fails, which the api adapter throws on. We
  // need both branches (success + verification-failure) to land in `data`,
  // not split between data and error.
  const [outcome, setOutcome] = useState<ProbeOutcome | null>(null);
  const [probing, setProbing] = useState(false);

  const runProbe = async (): Promise<void> => {
    setProbing(true);
    setOutcome(null);
    try {
      const r = await opOmegaOnboardingApi.pillar2({ companyId });
      setOutcome({
        verified: r.pillar2.claude_code_verified === true,
        fixHint: r.fix_hint,
        plan: r.pillar2.claude_plan,
      });
    } catch (e) {
      // ApiError or network — try to extract from response body manually
      const msg = (e as Error).message;
      setOutcome({ verified: false, fixHint: msg });
    } finally {
      setProbing(false);
    }
  };

  // Auto-probe on mount
  useEffect(() => { void runProbe(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [companyId]);

  const verified = outcome?.verified === true;
  const fixHint = outcome?.fixHint;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "2rem" }}>
      <H2>Pillar 2 — Inference Bootstrap</H2>
      <P>
        Your fleet needs Claude to think. We probe your keychain (or <code>ANTHROPIC_API_KEY</code>{" "}
        env var). The token never leaves your machine — the wrapper script reads it on every
        agent heartbeat.
      </P>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <h3 style={{ margin: 0, fontSize: 14, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Credential probe
          </h3>
          <button type="button" className="secondary" onClick={() => void runProbe()} disabled={probing}>
            {probing ? "Probing..." : "Re-probe"}
          </button>
        </div>

        {probing && <p className="text-dim">Calling claude-anthropic-direct.sh probe…</p>}

        {verified && (
          <div>
            <p style={{ marginTop: 0 }}>
              <span className="text-accent" style={{ fontSize: 18, fontWeight: 700 }}>✓</span>{" "}
              <strong>Credential resolved</strong> — your fleet can spawn agents using your Claude Max plan.
            </p>
            <table style={{ width: "100%", fontSize: 13 }}>
              <tbody>
                <tr>
                  <td className="text-dim" style={{ padding: "0.4rem 0", width: 120 }}>Plan</td>
                  <td><code>{outcome?.plan ?? "—"}</code></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {!probing && outcome && !verified && (
          <div style={{ color: "var(--warning)" }}>
            <p style={{ marginTop: 0 }}><strong>✗ Credential not resolved</strong></p>
            {fixHint && <p className="text-dim" style={{ fontSize: 13 }}>{fixHint}</p>}
          </div>
        )}
      </Card>

      <NavRow
        next={{ onClick: onComplete, label: "Continue →" }}
        nextDisabled={!verified}
      />
    </div>
  );
}
