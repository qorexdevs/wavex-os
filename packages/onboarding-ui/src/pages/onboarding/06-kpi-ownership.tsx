import { useMemo } from "react";
import { NavButtons } from "../../components/NavButtons";
import { useOnboarding } from "../../store";
import { DEFAULT_ORG, TEMPLATES_BY_ID } from "../../data/templates";

interface KpiRow {
  kpiId: string;
  ownerSlot: string;
  ownerLabel: string;
  isPrimary: boolean;
  source: "primary-goal" | "template-default";
}

function buildKpiRows(primaryKpi: string): KpiRow[] {
  const rows: KpiRow[] = [];
  const seen = new Set<string>();

  // 1. Primary goal pinned to top, owned by CEO by default
  if (primaryKpi.trim().length > 0) {
    rows.push({
      kpiId: primaryKpi.trim(),
      ownerSlot: "ceo",
      ownerLabel: "CEO",
      isPrimary: true,
      source: "primary-goal",
    });
    seen.add(primaryKpi.trim());
  }

  // 2. Template default KPIs — each owned by the role that ships them
  for (const node of DEFAULT_ORG) {
    const tpl = TEMPLATES_BY_ID[node.templateId];
    if (!tpl) continue;
    for (const kpi of tpl.defaultKpis ?? []) {
      if (seen.has(kpi)) continue;
      seen.add(kpi);
      rows.push({
        kpiId: kpi,
        ownerSlot: node.slot,
        ownerLabel: node.label,
        isPrimary: false,
        source: "template-default",
      });
    }
  }

  return rows;
}

export default function KpiOwnership() {
  const { goalKpiId } = useOnboarding();
  const rows = useMemo(() => buildKpiRows(goalKpiId), [goalKpiId]);

  return (
    <>
      <h1>KPI ownership</h1>
      <p className="text-dim" style={{ fontSize: 16, marginBottom: "2rem" }}>
        Every KPI gets exactly one accountable agent. Below is the auto-assigned mapping based
        on your goal and the templates you picked. Phase D will let you reassign by drag-drop.
      </p>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
              <th style={{ textAlign: "left", padding: "0.75rem 1rem", fontWeight: 600 }}>KPI</th>
              <th style={{ textAlign: "left", padding: "0.75rem 1rem", fontWeight: 600 }}>Owner</th>
              <th style={{ textAlign: "left", padding: "0.75rem 1rem", fontWeight: 600 }}>Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} style={{ padding: "1rem", color: "var(--text-dim)" }}>
                  No KPIs yet. Go back to step 2 and define your goal.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.kpiId} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "0.6rem 1rem", fontFamily: "monospace", fontSize: 12 }}>
                  {row.kpiId}
                  {row.isPrimary && (
                    <span style={{
                      marginLeft: "0.5rem",
                      background: "var(--accent)",
                      color: "var(--bg)",
                      padding: "0.1rem 0.4rem",
                      borderRadius: 3,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                    }}>PRIMARY</span>
                  )}
                </td>
                <td style={{ padding: "0.6rem 1rem", fontWeight: 600 }}>
                  {row.ownerLabel}
                  <span className="text-dim" style={{ fontWeight: 400, marginLeft: "0.4rem", fontSize: 11 }}>
                    {row.ownerSlot}
                  </span>
                </td>
                <td style={{ padding: "0.6rem 1rem" }} className="text-dim">
                  {row.source === "primary-goal" ? "your goal (step 2)" : "template default"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <NavButtons back="template-picker" next="customize-chat" />
    </>
  );
}
