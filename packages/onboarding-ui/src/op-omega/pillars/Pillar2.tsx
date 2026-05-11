/** Pillar 2 — Verify your setup. Mirrors upstream pillar-2.tsx:
 *  - 4 radio plan options (Max 20× / Max 5× / API only / Other)
 *  - Single "Verify & Continue" submit. Server probes the configured claudeBin
 *    to confirm install + auth, then returns Pillar2Outcome { ok, response, fix_hint? }
 *  - On ok: advance. On !ok: render the fix_hint inline so the operator can
 *    address (sign in, install, etc.) and re-verify. */

import { useState } from "react";
import { opOmegaOnboardingApi, ApiError } from "../lib/api";
import { Card, H2, P } from "../components/primitives";

type Plan = "max_20x" | "max_5x" | "api_only" | "other";

const PLAN_OPTIONS: Array<{ value: Plan; label: string }> = [
  { value: "max_20x", label: "Claude Max 20×" },
  { value: "max_5x", label: "Claude Max 5×" },
  { value: "api_only", label: "API only (pay-as-you-go)" },
  { value: "other", label: "Other — specify" },
];

interface Props {
  companyId: string;
  initial?: { claude_plan?: Plan; claude_plan_other_note?: string };
  onComplete: () => void;
}

export function Pillar2({ companyId, initial, onComplete }: Props) {
  const [plan, setPlan] = useState<Plan>(initial?.claude_plan ?? "max_5x");
  const [note, setNote] = useState(initial?.claude_plan_other_note ?? "");
  const [busy, setBusy] = useState(false);
  const [fixHint, setFixHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function verify(): Promise<void> {
    setBusy(true);
    setFixHint(null);
    setError(null);
    try {
      const r = await opOmegaOnboardingApi.pillar2({
        companyId,
        claude_plan: plan,
        claude_plan_other_note: plan === "other" ? note : undefined,
      });
      if (r.ok) onComplete();
      else setFixHint(r.fix_hint ?? "Claude Code verification failed.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "2rem" }}>
      <H2>Verifying your setup</H2>
      <P>
        Every downstream step uses Claude. We'll verify <code>claude</code> is
        installed and signed in to your plan before we go further.
      </P>

      {error && <Card><p style={{ color: "var(--warning)", margin: 0 }}>✗ {error}</p></Card>}

      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {PLAN_OPTIONS.map((o) => (
            <label
              key={o.value}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "0.75rem",
                border: `1px solid ${plan === o.value ? "var(--accent)" : "var(--border)"}`,
                background: plan === o.value ? "var(--surface-2)" : "transparent",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              <input
                type="radio"
                checked={plan === o.value}
                onChange={() => setPlan(o.value)}
              />
              <span style={{ fontWeight: 500 }}>{o.label}</span>
            </label>
          ))}
        </div>

        {plan === "other" && (
          <div style={{ marginTop: "0.75rem" }}>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Describe your plan"
              style={{ width: "100%" }}
            />
          </div>
        )}

        {fixHint && (
          <div style={{
            marginTop: "0.75rem",
            padding: "0.75rem",
            border: "1px solid var(--warning)",
            background: "var(--bg)",
            borderRadius: 4,
            fontSize: 13,
          }}>
            <div style={{ fontWeight: 600, color: "var(--warning)", marginBottom: "0.25rem" }}>
              ◷ Setup needed
            </div>
            <div className="text-dim" style={{ whiteSpace: "pre-wrap" }}>{fixHint}</div>
          </div>
        )}
      </Card>

      <div className="nav-buttons">
        <span />
        <button type="button" onClick={() => void verify()} disabled={busy}>
          {busy ? "Verifying Claude Code…" : "Verify & Continue ⚡"}
        </button>
      </div>
    </div>
  );
}
