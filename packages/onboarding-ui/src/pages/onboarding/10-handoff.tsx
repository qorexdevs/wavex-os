import { useEffect, useState } from "react";
import { NavButtons } from "../../components/NavButtons";

interface ProbeResult {
  ok: boolean;
  source?: "env" | "stub" | "keychain-macos" | "none";
  plan?: string;
  note?: string;
  error?: string;
}

type ProbeStatus = "idle" | "probing" | "ok" | "missing" | "error";

export default function Handoff() {
  const [status, setStatus] = useState<ProbeStatus>("idle");
  const [result, setResult] = useState<ProbeResult | null>(null);

  async function runProbe() {
    setStatus("probing");
    setResult(null);
    try {
      const resp = await fetch("/api/paperclip/probe/claude-max");
      const json = await resp.json() as ProbeResult;
      setResult(json);
      if (json.ok) setStatus("ok");
      else if (json.error) setStatus("error");
      else setStatus("missing");
    } catch (e) {
      setStatus("error");
      setResult({ ok: false, error: (e as Error).message });
    }
  }

  // Auto-probe on mount
  useEffect(() => { runProbe(); }, []);

  const sourceLabel: Record<NonNullable<ProbeResult["source"]>, string> = {
    "keychain-macos": "macOS Keychain (Claude Code-credentials)",
    "env": "ANTHROPIC_API_KEY environment variable",
    "stub": "synthetic stub (testing mode)",
    "none": "no credential source",
  };

  return (
    <>
      <h1>OAuth handoff</h1>
      <p className="text-dim" style={{ fontSize: 16, marginBottom: "1.5rem" }}>
        Bind your Claude Max subscription to your fleet. The token never leaves your machine —
        the wrapper script reads it from your keychain on every agent heartbeat.
      </p>

      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <h3 style={{ margin: 0, fontSize: 14, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Credential probe
          </h3>
          <button className="secondary" onClick={runProbe} disabled={status === "probing"} style={{ fontSize: 12 }}>
            {status === "probing" ? "Probing..." : "Re-probe"}
          </button>
        </div>

        {status === "idle" && <p className="text-dim">Initializing...</p>}
        {status === "probing" && <p className="text-dim">Calling wavex-claude probe...</p>}

        {status === "ok" && result && (
          <div>
            <p style={{ marginTop: 0 }}>
              <span className="text-accent" style={{ fontSize: 18, fontWeight: 700 }}>✓</span>{" "}
              <strong>Credential resolved</strong> — your fleet can spawn agents using your Claude Max plan.
            </p>
            <table style={{ width: "100%", fontSize: 13 }}>
              <tbody>
                <tr>
                  <td className="text-dim" style={{ padding: "0.4rem 0", width: 120 }}>Source</td>
                  <td>{result.source ? sourceLabel[result.source] : "—"}</td>
                </tr>
                <tr>
                  <td className="text-dim" style={{ padding: "0.4rem 0" }}>Plan tier</td>
                  <td><code>{result.plan ?? "—"}</code></td>
                </tr>
                <tr>
                  <td className="text-dim" style={{ padding: "0.4rem 0", verticalAlign: "top" }}>Privacy</td>
                  <td className="text-dim">{result.note}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {status === "missing" && (
          <div>
            <p style={{ marginTop: 0, color: "var(--warning)" }}>
              <strong>No Claude Max credential found.</strong>
            </p>
            <p className="text-dim" style={{ fontSize: 13 }}>
              {result?.note ?? "Sign in with the Claude desktop app or set ANTHROPIC_API_KEY, then re-probe."}
            </p>
            <p className="text-dim" style={{ fontSize: 13 }}>
              Quick check: <code>WAVEX_CLAUDE_STUB=1 ./scripts/wrappers/claude-anthropic-direct.sh probe</code>
            </p>
          </div>
        )}

        {status === "error" && (
          <div style={{ color: "var(--warning)" }}>
            <strong>Probe failed:</strong> {result?.error ?? "unknown error"}
          </div>
        )}
      </div>

      <p className="text-dim" style={{ fontSize: 13, marginTop: "1rem" }}>
        Phase F will perform a smoke heartbeat per spawned agent to confirm
        each one can actually call the wrapper.
      </p>

      <NavButtons
        back="spawn"
        next="subscription"
        nextLabel="Activate System Optimizer →"
        nextDisabled={status === "probing"}
      />
    </>
  );
}
