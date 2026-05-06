import { NavButtons } from "../../components/NavButtons";

// Phase C: render an interactive force-directed graph (reactflow) of the suggested org tree.
// Default org for most industries: CEO + CoS + 3-5 CxOs + 2-4 operators.
const DEFAULT_ORG_PREVIEW = [
  { tier: 1, role: "ceo",            label: "CEO" },
  { tier: 1, role: "chief_of_staff", label: "Chief of Staff", reports: "ceo" },
  { tier: 2, role: "cmo",            label: "CMO",            reports: "ceo" },
  { tier: 2, role: "cro",            label: "CRO",            reports: "ceo" },
  { tier: 2, role: "cto",            label: "CTO",            reports: "ceo" },
  { tier: 2, role: "cdo",            label: "CDO",            reports: "ceo" },
  { tier: 3, role: "engineer",       label: "Full-Stack Engineer", reports: "cto" },
  { tier: 3, role: "general",        label: "Marketing Ops",       reports: "cmo" },
];

export default function OrgDesign() {
  return (
    <>
      <h1>Default org tree</h1>
      <p className="text-dim" style={{ fontSize: 16, marginBottom: "2rem" }}>
        Based on your industry, here's a recommended starting org. You can swap templates,
        add or remove agents, or change reporting lines on the next step.
      </p>

      <div className="card" style={{ display: "grid", gap: "0.5rem" }}>
        {DEFAULT_ORG_PREVIEW.map((node) => (
          <div key={node.role} style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            paddingLeft: `${(node.tier - 1) * 1.5}rem`,
            color: "var(--text)",
          }}>
            <span className="text-dim" style={{ fontSize: 12 }}>tier {node.tier}</span>
            <strong>{node.label}</strong>
            {node.reports && <span className="text-dim" style={{ fontSize: 12 }}>→ {node.reports}</span>}
          </div>
        ))}
      </div>

      <p className="text-dim" style={{ fontSize: 13, marginTop: "1rem" }}>
        <strong>Phase C will replace this with:</strong> an interactive force-directed graph
        (reactflow) where you can drag-drop agents, swap templates, and see KPI ownership inline.
      </p>

      <NavButtons back="connectors" next="template-picker" />
    </>
  );
}
