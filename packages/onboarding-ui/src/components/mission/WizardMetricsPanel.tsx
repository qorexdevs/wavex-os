/** Wizard telemetry dashboard panel.
 *
 *  Fetches GET /api/wizard-metrics and renders:
 *   - TTV chips (median + p75)
 *   - Activation funnel bar
 *   - Weekly cohort table */

import { useQuery } from "@tanstack/react-query";

interface WizardMetrics {
  ok: boolean;
  ttv_hours: { median: number | null; p75: number | null };
  funnel: { start: number; step1: number; step2: number; step3: number; first_result: number };
  cohorts: Array<{ week: string; starts: number; completes: number; rate: number }>;
}

function TtvChip({ label, value }: { label: string; value: number | null }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "0.6rem 1.1rem",
      borderRadius: 8,
      background: "var(--surface-2, var(--surface))",
      border: "1px solid var(--border)",
      minWidth: 80,
    }}>
      <span style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 2 }}>{label}</span>
      <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em" }}>
        {value !== null ? `${value}h` : "—"}
      </span>
    </div>
  );
}

function FunnelBar({ funnel }: { funnel: WizardMetrics["funnel"] }) {
  const steps: Array<{ label: string; count: number }> = [
    { label: "Start", count: funnel.start },
    { label: "Step 1", count: funnel.step1 },
    { label: "Step 2", count: funnel.step2 },
    { label: "Step 3", count: funnel.step3 },
    { label: "1st test", count: funnel.first_result },
  ];
  const max = funnel.start || 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {steps.map(({ label, count }) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 48, fontSize: 11, color: "var(--text-dim)", textAlign: "right", flexShrink: 0 }}>
            {label}
          </span>
          <div style={{ flex: 1, height: 14, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${Math.round((count / max) * 100)}%`,
              background: "var(--accent)",
              borderRadius: 3,
              transition: "width 400ms ease",
            }} />
          </div>
          <span style={{ width: 28, fontSize: 12, color: "var(--text)", textAlign: "right", flexShrink: 0 }}>
            {count}
          </span>
        </div>
      ))}
    </div>
  );
}

function CohortTable({ cohorts }: { cohorts: WizardMetrics["cohorts"] }) {
  if (cohorts.length === 0) {
    return <p className="text-dim" style={{ fontSize: 12, margin: 0 }}>No cohort data yet.</p>;
  }
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
      <thead>
        <tr style={{ borderBottom: "1px solid var(--border)" }}>
          {["Week", "Starts", "Completes", "Rate"].map((h) => (
            <th key={h} style={{
              textAlign: h === "Week" ? "left" : "right",
              padding: "0.25rem 0.5rem",
              color: "var(--text-dim)",
              fontWeight: 600,
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {cohorts.map((row) => (
          <tr key={row.week} style={{ borderBottom: "1px solid var(--border)" }}>
            <td style={{ padding: "0.3rem 0.5rem", color: "var(--text-dim)" }}>{row.week}</td>
            <td style={{ padding: "0.3rem 0.5rem", textAlign: "right" }}>{row.starts}</td>
            <td style={{ padding: "0.3rem 0.5rem", textAlign: "right" }}>{row.completes}</td>
            <td style={{ padding: "0.3rem 0.5rem", textAlign: "right", color: row.rate >= 50 ? "var(--accent)" : "var(--text)" }}>
              {row.rate}%
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function WizardMetricsPanel() {
  const q = useQuery<WizardMetrics>({
    queryKey: ["wizard-metrics"],
    queryFn: async () => {
      const r = await fetch("/api/wizard-metrics");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    refetchInterval: 60_000,
    retry: 1,
  });

  return (
    <div className="card" style={{ marginBottom: "2.5rem" }}>
      <h3 style={{
        marginTop: 0, fontSize: 14,
        color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em",
      }}>
        Wizard metrics
      </h3>

      {q.isLoading && <p className="text-dim" style={{ fontSize: 12 }}>Loading…</p>}
      {q.isError && <p style={{ fontSize: 12, color: "var(--warning)" }}>Failed to load metrics.</p>}

      {q.data?.ok && (
        <>
          {/* TTV chips */}
          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem" }}>
            <TtvChip label="Median TTV" value={q.data.ttv_hours.median} />
            <TtvChip label="p75 TTV" value={q.data.ttv_hours.p75} />
          </div>

          {/* Activation funnel */}
          <div style={{ marginBottom: "1.25rem" }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: "0.5rem", color: "var(--text-dim)" }}>
              Activation funnel
            </div>
            <FunnelBar funnel={q.data.funnel} />
          </div>

          {/* Weekly cohort table */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: "0.5rem", color: "var(--text-dim)" }}>
              Weekly cohorts
            </div>
            <CohortTable cohorts={q.data.cohorts} />
          </div>
        </>
      )}

      {/* Zero-data state — renders headers even with no rows */}
      {q.data && !q.isLoading && q.data.funnel.start === 0 && (
        <p className="text-dim" style={{ fontSize: 12, marginBottom: 0 }}>
          No wizard events recorded yet. Events will appear here as users progress through onboarding.
        </p>
      )}
    </div>
  );
}
