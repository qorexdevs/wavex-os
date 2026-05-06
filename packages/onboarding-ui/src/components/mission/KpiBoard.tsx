import { useOnboarding } from "../../store";
import { DEFAULT_ORG, TEMPLATES_BY_ID } from "../../data/templates";

export function KpiBoard() {
  const { goalKpiId, goalCurrent, goalTarget, goalWindowDays, companyName } = useOnboarding();

  // Primary KPI card
  const hasGoal = goalKpiId.trim().length > 0 && goalTarget > 0;
  const progressPct = hasGoal && goalTarget !== goalCurrent
    ? Math.max(0, Math.min(100, Math.round(((goalCurrent - 0) / goalTarget) * 100)))
    : 0;

  // Supporting KPIs from templates
  const supportingKpis: { kpiId: string; ownerLabel: string }[] = [];
  const seen = new Set<string>([goalKpiId.trim()]);
  for (const node of DEFAULT_ORG) {
    const tpl = TEMPLATES_BY_ID[node.templateId];
    for (const k of tpl?.defaultKpis ?? []) {
      if (seen.has(k)) continue;
      seen.add(k);
      supportingKpis.push({ kpiId: k, ownerLabel: node.label });
    }
  }

  if (!hasGoal && supportingKpis.length === 0) {
    return (
      <div className="card">
        <h3 style={{ marginTop: 0 }}>KPI scoreboard</h3>
        <p className="text-dim" style={{ margin: 0 }}>
          No KPIs registered yet. Complete onboarding (steps 2 and 5) to populate this scoreboard.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ margin: "0 0 1rem", fontSize: 16, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        KPI scoreboard {companyName && <span style={{ color: "var(--text)", textTransform: "none", fontSize: 14, fontWeight: 400, marginLeft: "0.5rem" }}>· {companyName}</span>}
      </h2>

      {hasGoal && (
        <div className="card" style={{ borderColor: "var(--accent)", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <span className="text-accent" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em" }}>PRIMARY · {goalWindowDays}-DAY GOAL</span>
            <span className="text-dim" style={{ fontSize: 11 }}>owner: CEO</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", marginBottom: "0.75rem" }}>
            <span style={{ fontSize: 28, fontWeight: 700, fontFamily: "ui-monospace, monospace" }}>{goalKpiId}</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "1.5rem", marginBottom: "0.5rem" }}>
            <div>
              <div className="text-dim" style={{ fontSize: 11 }}>current</div>
              <div style={{ fontSize: 22, fontWeight: 600, fontFamily: "ui-monospace, monospace" }}>{goalCurrent.toLocaleString()}</div>
            </div>
            <div className="text-dim" style={{ fontSize: 18 }}>→</div>
            <div>
              <div className="text-dim" style={{ fontSize: 11 }}>target</div>
              <div style={{ fontSize: 22, fontWeight: 600, fontFamily: "ui-monospace, monospace", color: "var(--accent)" }}>{goalTarget.toLocaleString()}</div>
            </div>
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div className="text-dim" style={{ fontSize: 11 }}>progress</div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>{progressPct}%</div>
            </div>
          </div>
          <div style={{ height: 4, background: "var(--surface-2)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progressPct}%`, background: "var(--accent)", transition: "width 240ms" }} />
          </div>
        </div>
      )}

      {supportingKpis.length > 0 && (
        <div className="card">
          <h3 style={{ margin: "0 0 1rem", fontSize: 13, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Supporting KPIs · {supportingKpis.length}
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.5rem" }}>
            {supportingKpis.map((k) => (
              <div key={k.kpiId} style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "0.6rem 0.75rem",
              }}>
                <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, fontWeight: 600 }}>{k.kpiId}</div>
                <div className="text-dim" style={{ fontSize: 11, marginTop: 2 }}>owner: {k.ownerLabel}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
