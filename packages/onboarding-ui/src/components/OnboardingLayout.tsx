import { Outlet, useLocation, Link } from "react-router-dom";

const STEPS = [
  { path: "welcome",          label: "1. Welcome" },
  { path: "goal",             label: "2. Goal" },
  { path: "connectors",       label: "3. Connectors" },
  { path: "org-design",       label: "4. Org design" },
  { path: "template-picker",  label: "5. Templates" },
  { path: "kpi-ownership",    label: "6. KPI ownership" },
  { path: "customize-chat",   label: "7. Customize" },
  { path: "manifest-review",  label: "8. Review" },
  { path: "spawn",            label: "9. Spawn" },
  { path: "handoff",          label: "10. Handoff" },
  { path: "subscription",     label: "11. Subscription" },
];

export function OnboardingLayout() {
  const loc = useLocation();
  const currentPath = loc.pathname.split("/").pop() ?? "welcome";
  const currentIdx = STEPS.findIndex((s) => s.path === currentPath);

  return (
    <div className="layout">
      <aside className="sidebar">
        <h2>WaveX OS</h2>
        <p className="text-dim" style={{ fontSize: 13, marginBottom: "1.5rem" }}>
          Configure your AI agent company in 11 steps.
        </p>
        <ol>
          {STEPS.map((step, idx) => {
            const cls = idx === currentIdx ? "active" : idx < currentIdx ? "done" : "";
            return (
              <li key={step.path} className={cls}>
                <span className="step-num">{idx < currentIdx ? "✓" : idx + 1}</span>
                <Link to={`/onboarding/${step.path}`} style={{ color: "inherit", textDecoration: "none" }}>
                  {step.label.replace(/^\d+\.\s*/, "")}
                </Link>
              </li>
            );
          })}
        </ol>
        <div style={{ position: "sticky", bottom: 0, paddingTop: "1rem" }}>
          <p className="text-dim" style={{ fontSize: 12 }}>
            Need help?{" "}
            <a href="https://github.com/aimerdoux/wavex-os/issues" target="_blank" rel="noreferrer">
              File an issue
            </a>
          </p>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
