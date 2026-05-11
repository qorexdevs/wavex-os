/** Token budget chip — opt-in spending guard for the operator. Shows the
 *  current cap (or "no cap") and a usage gauge. Click to open the modal
 *  that sets/raises/clears the cap. When the cap is exceeded, T2 routes
 *  return 429 with a "raise budget" hint. */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { opOmegaOnboardingApi, ApiError } from "../lib/api";

interface Props { companyId: string; }

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

const PRESETS: Array<{ label: string; tokens: number }> = [
  { label: "50k",  tokens:    50_000 },
  { label: "250k", tokens:   250_000 },
  { label: "1M",   tokens: 1_000_000 },
  { label: "5M",   tokens: 5_000_000 },
];

export function BudgetChip({ companyId }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["token-budget", companyId],
    queryFn: () => opOmegaOnboardingApi.getTokenBudget(companyId),
    refetchInterval: 5000,
  });

  const cap = q.data?.budget?.cap_tokens ?? null;
  const used = q.data?.used ?? 0;
  const pct = cap !== null && cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  const overCap = cap !== null && used >= cap;

  async function setCap(value: number | null): Promise<void> {
    setSubmitting(true);
    setError(null);
    try {
      await opOmegaOnboardingApi.setTokenBudget(companyId, value);
      await qc.invalidateQueries({ queryKey: ["token-budget", companyId] });
      setOpen(false);
      setCustom("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const label = cap === null
    ? "🛡 no cap"
    : overCap
      ? `🛡 ${formatTokens(used)} / ${formatTokens(cap)} · over`
      : `🛡 ${formatTokens(used)} / ${formatTokens(cap)} · ${pct}%`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Click to set a token spending cap for this onboarding"
        style={{
          fontSize: 11, padding: "0.2rem 0.55rem", borderRadius: 4,
          border: `1px solid ${overCap ? "var(--warning)" : "var(--border)"}`,
          background: overCap ? "var(--warning)" : "var(--surface-2)",
          color: overCap ? "var(--bg)" : "var(--text)",
          cursor: "pointer",
          fontFamily: "monospace",
          fontWeight: overCap ? 700 : 400,
        }}
      >
        {label}
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 8, padding: "1.25rem", minWidth: 380, maxWidth: 480,
            }}
          >
            <h3 style={{ marginTop: 0, fontSize: 16 }}>Token budget</h3>
            <p className="text-dim" style={{ fontSize: 12, marginBottom: "0.75rem" }}>
              When the cap is reached, T2 calls (industry inference, agent recommendation,
              workflow generation) will return 429 until you raise it. Calls already in flight
              are not aborted.
            </p>
            <div style={{ fontSize: 12, marginBottom: "0.75rem" }}>
              Currently used: <code>{formatTokens(used)}</code> tokens
              {cap !== null && <> · cap <code>{formatTokens(cap)}</code> ({pct}%)</>}
            </div>
            {cap !== null && cap > 0 && (
              <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden", marginBottom: "1rem" }}>
                <div style={{
                  height: "100%", width: `${pct}%`,
                  background: overCap ? "var(--warning)" : "var(--accent)",
                }} />
              </div>
            )}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
              {PRESETS.map((p) => (
                <button
                  key={p.tokens}
                  type="button"
                  className={cap === p.tokens ? "" : "secondary"}
                  onClick={() => void setCap(p.tokens)}
                  disabled={submitting}
                  style={{ fontSize: 12 }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <input
                type="number"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="custom (tokens)"
                disabled={submitting}
                style={{ flex: 1, fontSize: 12 }}
              />
              <button
                type="button"
                onClick={() => {
                  const n = parseInt(custom, 10);
                  if (Number.isFinite(n) && n > 0) void setCap(n);
                }}
                disabled={submitting || !custom.trim()}
                style={{ fontSize: 12 }}
              >
                Set
              </button>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                type="button"
                className="secondary"
                onClick={() => void setCap(null)}
                disabled={submitting || cap === null}
                style={{ fontSize: 12, color: "var(--warning)" }}
              >
                Remove cap
              </button>
              <button type="button" className="secondary" onClick={() => setOpen(false)} disabled={submitting} style={{ fontSize: 12 }}>
                Close
              </button>
            </div>
            {error && (
              <div style={{ marginTop: "0.5rem", fontSize: 12, color: "var(--warning)" }}>
                ✗ {error}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
