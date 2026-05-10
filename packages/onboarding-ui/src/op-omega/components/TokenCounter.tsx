/** Live T2 token cost chip. Polls /api/instance/:id/token-usage every 5s
 *  while the wizard is open. Shows total tokens spent so far + cost USD.
 *  Hover for per-phase breakdown. Renders nothing while no T2 calls have
 *  been recorded yet (404 from the API → empty state). */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { opOmegaOnboardingApi, ApiError } from "../lib/api";

interface Props {
  companyId: string;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatCost(usd: number): string {
  if (usd < 0.01) return "<$0.01";
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

export function TokenCounter({ companyId }: Props) {
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ["token-usage", companyId],
    queryFn: () => opOmegaOnboardingApi.tokenUsage(companyId).catch((e: unknown) => {
      // 404 just means no T2 calls yet — render as "0 tokens", not an error.
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }),
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  const total = q.data?.usage?.total;
  const byPhase = q.data?.usage?.by_phase ?? {};
  const totalTokens = total ? total.input_tokens + total.output_tokens : 0;

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Click for per-phase breakdown"
        style={{
          fontSize: 11, padding: "0.2rem 0.55rem", borderRadius: 4,
          border: "1px solid var(--border)",
          background: "var(--surface-2)",
          color: "var(--text)",
          cursor: "pointer",
          fontFamily: "monospace",
        }}
      >
        🪙 {formatTokens(totalTokens)} · {formatCost(total?.cost_usd ?? 0)}
      </button>
      {open && total && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", right: 0,
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 6, padding: "0.6rem", minWidth: 280, zIndex: 20,
          fontSize: 11,
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        }}>
          <div style={{ fontWeight: 600, marginBottom: "0.4rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Per-phase breakdown · {total.calls} call{total.calls === 1 ? "" : "s"}
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "monospace" }}>
            <thead>
              <tr style={{ color: "var(--text-dim)", fontSize: 10 }}>
                <th style={{ textAlign: "left", padding: "2px 6px 2px 0" }}>phase</th>
                <th style={{ textAlign: "right", padding: "2px 6px" }}>in</th>
                <th style={{ textAlign: "right", padding: "2px 6px" }}>out</th>
                <th style={{ textAlign: "right", padding: "2px 0 2px 6px" }}>$</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(byPhase).map(([phase, agg]) => (
                <tr key={phase}>
                  <td style={{ padding: "2px 6px 2px 0" }}>{phase}</td>
                  <td style={{ textAlign: "right", padding: "2px 6px" }}>{formatTokens(agg.input_tokens)}</td>
                  <td style={{ textAlign: "right", padding: "2px 6px" }}>{formatTokens(agg.output_tokens)}</td>
                  <td style={{ textAlign: "right", padding: "2px 0 2px 6px" }}>{formatCost(agg.cost_usd)}</td>
                </tr>
              ))}
              <tr style={{ borderTop: "1px solid var(--border)", fontWeight: 600 }}>
                <td style={{ padding: "4px 6px 2px 0" }}>total</td>
                <td style={{ textAlign: "right", padding: "4px 6px 2px" }}>{formatTokens(total.input_tokens)}</td>
                <td style={{ textAlign: "right", padding: "4px 6px 2px" }}>{formatTokens(total.output_tokens)}</td>
                <td style={{ textAlign: "right", padding: "4px 0 2px 6px" }}>{formatCost(total.cost_usd)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
