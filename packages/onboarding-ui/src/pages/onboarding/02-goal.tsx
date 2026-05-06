import { useOnboarding } from "../../store";
import { NavButtons } from "../../components/NavButtons";

export default function Goal() {
  const { goalKpiId, goalCurrent, goalTarget, goalWindowDays, setGoal } = useOnboarding();

  const canProceed = goalKpiId.length > 0 && goalTarget > 0;

  return (
    <>
      <h1>What's your one number?</h1>
      <p className="text-dim" style={{ fontSize: 16, marginBottom: "2rem" }}>
        Pick the single KPI that matters most for the next 90 days. Everything in your
        company tree will be evaluated against this.
      </p>

      <div className="card">
        <label style={{ display: "block", marginBottom: "1.25rem" }}>
          <div style={{ marginBottom: "0.5rem" }}>KPI name</div>
          <input
            type="text"
            value={goalKpiId}
            onChange={(e) => setGoal(e.target.value, goalCurrent, goalTarget, goalWindowDays)}
            placeholder="e.g. monthly_recurring_revenue, new_auth_users_7d, booking_gmv"
            autoFocus
          />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
          <label>
            <div style={{ marginBottom: "0.5rem" }}>Current value</div>
            <input
              type="number"
              value={goalCurrent}
              onChange={(e) => setGoal(goalKpiId, Number(e.target.value), goalTarget, goalWindowDays)}
              placeholder="0"
            />
          </label>
          <label>
            <div style={{ marginBottom: "0.5rem" }}>Target by day N</div>
            <input
              type="number"
              value={goalTarget}
              onChange={(e) => setGoal(goalKpiId, goalCurrent, Number(e.target.value), goalWindowDays)}
              placeholder="25000"
            />
          </label>
          <label>
            <div style={{ marginBottom: "0.5rem" }}>Window (days)</div>
            <input
              type="number"
              value={goalWindowDays}
              onChange={(e) => setGoal(goalKpiId, goalCurrent, goalTarget, Number(e.target.value))}
              placeholder="90"
            />
          </label>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0, fontSize: 14, color: "var(--text-dim)" }}>SUPPORTING KPIS (Phase C will populate these via the onboarding agent)</h3>
        <p className="text-dim" style={{ fontSize: 13, marginBottom: 0 }}>
          Based on your industry + goal, the onboarding agent will suggest 3–5 lead-indicator
          KPIs. For now, we'll pick reasonable defaults.
        </p>
      </div>

      <NavButtons back="welcome" next="connectors" nextDisabled={!canProceed} />
    </>
  );
}
