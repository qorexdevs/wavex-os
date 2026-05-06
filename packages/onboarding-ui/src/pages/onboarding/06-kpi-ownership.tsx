import { NavButtons } from "../../components/NavButtons";

export default function KpiOwnership() {
  return (
    <>
      <h1>KPI ownership</h1>
      <p className="text-dim" style={{ fontSize: 16, marginBottom: "2rem" }}>
        Each KPI gets exactly one accountable agent. The onboarding agent will auto-assign
        based on template defaults; you can drag-drop to override.
      </p>
      <div className="card">
        <table style={{ width: "100%", fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th style={{ textAlign: "left", padding: "0.5rem" }}>KPI</th>
              <th style={{ textAlign: "left", padding: "0.5rem" }}>Owner</th>
              <th style={{ textAlign: "left", padding: "0.5rem" }}>Direction</th>
              <th style={{ textAlign: "left", padding: "0.5rem" }}>Target</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style={{ padding: "0.5rem" }} colSpan={4} className="text-dim">
              Phase C: populate from goal + template defaults. For now, this is a stub.
            </td></tr>
          </tbody>
        </table>
      </div>
      <NavButtons back="template-picker" next="customize-chat" />
    </>
  );
}
