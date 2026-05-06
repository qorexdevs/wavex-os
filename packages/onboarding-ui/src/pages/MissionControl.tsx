import { Link } from "react-router-dom";
import { HealthStrip } from "../components/mission/HealthStrip";
import { KpiBoard } from "../components/mission/KpiBoard";
import { FleetGraph } from "../components/mission/FleetGraph";
import { useOnboarding } from "../store";

export default function MissionControl() {
  const { companyName, sessionId } = useOnboarding();
  const onboardingComplete = !!sessionId || companyName.trim().length > 0;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Top bar */}
      <header style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "1rem 2rem",
        borderBottom: "1px solid var(--border)",
        background: "var(--surface)",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem" }}>
          <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.01em" }}>WaveX OS</span>
          <span className="text-dim" style={{ fontSize: 12 }}>· Mission Control</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
          <HealthStrip />
          <Link to="/onboarding/welcome" style={{ fontSize: 12 }}>
            {onboardingComplete ? "Re-run onboarding" : "Start onboarding"}
          </Link>
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem" }}>
        {!onboardingComplete && (
          <div className="card" style={{
            borderColor: "var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            marginBottom: "2rem",
          }}>
            <div>
              <strong>You haven't onboarded yet.</strong>{" "}
              <span className="text-dim">Complete the 11-step wizard to define KPIs and spawn your fleet.</span>
            </div>
            <Link to="/onboarding/welcome">
              <button>Start onboarding →</button>
            </Link>
          </div>
        )}

        <div style={{ marginBottom: "2.5rem" }}>
          <KpiBoard />
        </div>

        <div style={{ marginBottom: "2.5rem" }}>
          <FleetGraph />
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0, fontSize: 14, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Coming next
          </h3>
          <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "var(--text-dim)", lineHeight: 1.8, fontSize: 13 }}>
            <li>Workflows queue (issues by status, filterable) — Phase G</li>
            <li>Approvals tray (board approvals routed via Telegram + UI) — Phase G</li>
            <li>Workspace tray (ngrok status, Composio health, etc.) — Phase G</li>
            <li>Real Paperclip core in place of mock-core — Phase D</li>
            <li>System Optimizer daily injections — Phase F</li>
          </ul>
        </div>

        <p className="text-dim" style={{ fontSize: 11, marginTop: "2rem", textAlign: "center" }}>
          WaveX OS · MIT · <a href="https://github.com/aimerdoux/wavex-os" target="_blank" rel="noreferrer">github.com/aimerdoux/wavex-os</a>
        </p>
      </main>
    </div>
  );
}
