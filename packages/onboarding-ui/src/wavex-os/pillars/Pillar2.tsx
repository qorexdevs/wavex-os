/** Pillar 2 — Verify your setup.
 *
 *  Two-mode rendering:
 *
 *  - **Hosted mode** (customer's installer pointed the runtime at the
 *    operator's hub): the customer doesn't have Claude Code locally and
 *    doesn't need a Claude plan. We auto-pass with a one-line "Inference
 *    provided by WaveX hub" confirmation and call onComplete() as soon as
 *    the probe confirms the hub is reachable. No plan picker, no verify
 *    button, no manual gate. Detected via probe.billing_type === "wavex_pool_a".
 *
 *  - **OAuth / API-key mode** (customer has their own Claude): the legacy
 *    4-radio plan picker + Verify & Continue flow. Server probes the
 *    configured claudeBin and returns Pillar2Outcome { ok, response, fix_hint? }.
 *
 *  We probe ONCE on mount to decide which surface to render. */

import { useEffect, useState } from "react";
import { wavexOsOnboardingApi, ApiError } from "../lib/api";
import { Card, H2, P } from "../components/primitives";
import { AllocationSlider } from "../../components/AllocationSlider";

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
  /** Mode resolution: undefined = still probing, "hosted" = skip plan picker
   *  and auto-advance, "local" = render the legacy plan picker flow. */
  const [mode, setMode] = useState<"hosted" | "local" | undefined>(undefined);
  const [hubInfo, setHubInfo] = useState<{ version?: string; test_output?: string } | null>(null);

  // On mount: probe the runtime. If hosted, auto-record + advance.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const probe = await wavexOsOnboardingApi.claudeCodeCheck();
        if (cancelled) return;
        const isHosted = probe.ok === true && probe.probe?.billing_type === "wavex_pool_a";
        if (isHosted && probe.probe) {
          setHubInfo({ version: probe.probe.version, test_output: probe.probe.test_output });
          setMode("hosted");
          // Record a synthetic "other" plan with a hub note so the manifest
          // stays valid + auto-advance. The upstream schema doesn't yet have
          // a `hosted` enum value; the note documents what actually happened.
          try {
            const r = await wavexOsOnboardingApi.pillar2({
              companyId,
              claude_plan: "other",
              claude_plan_other_note: "WaveX hub Pool A — inference provided by operator",
            });
            if (!cancelled && r.ok) {
              // Brief hold so the customer sees the confirmation before we
              // navigate away. 800ms is enough to register without feeling slow.
              setTimeout(() => { if (!cancelled) onComplete(); }, 800);
            }
          } catch { /* fall through — operator can manually click below */ }
        } else {
          setMode("local");
        }
      } catch {
        // Probe failed entirely → default to local-mode UI so the operator
        // can still verify manually (covers offline / firewalled cases).
        if (!cancelled) setMode("local");
      }
    })();
    return () => { cancelled = true; };
  }, [companyId, onComplete]);

  async function verify(): Promise<void> {
    setBusy(true);
    setFixHint(null);
    setError(null);
    try {
      const r = await wavexOsOnboardingApi.pillar2({
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

  // ── Hosted mode: customer's runtime delegates inference to the WaveX hub.
  // No plan picker, no Claude install, no verify button — auto-advance.
  if (mode === "hosted") {
    return (
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "2rem" }}>
        <H2>Inference is ready</H2>
        <P>
          Your install is configured to use the WaveX hub for inference.
          You don't need to install Claude Code or bring your own plan — the
          operator's Pool A serves your onboarding under a rate-limited
          session token. Continuing in a moment…
        </P>
        <Card>
          <div style={{ fontSize: 13, color: "var(--accent)", marginBottom: "0.5rem" }}>
            ✓ Connected to WaveX hub
          </div>
          {hubInfo?.version && (
            <div className="text-dim" style={{ fontSize: 12 }}>
              <code>{hubInfo.version}</code>
            </div>
          )}
          {hubInfo?.test_output && (
            <div className="text-dim" style={{ fontSize: 11, marginTop: "0.25rem" }}>
              {hubInfo.test_output}
            </div>
          )}
        </Card>
      </div>
    );
  }

  // ── Probing (very brief — usually <200ms): minimal placeholder so we
  // don't flash the plan picker before mode is resolved.
  if (mode === undefined) {
    return (
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "2rem", color: "var(--text-dim)" }}>
        Checking your inference setup…
      </div>
    );
  }

  // ── Local mode (oauth / apikey): the legacy plan picker + verify UI.
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "2rem" }}>
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

      {/* Claude Max allocation — set the swarm-vs-Pool-A split here as a
          default; the operator can re-tune it live in Mission Control
          once the fleet is running. Only meaningful in local (oauth)
          mode where the operator's own Max plan is the inference source. */}
      <Card>
        <AllocationSlider variant="wizard" />
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
