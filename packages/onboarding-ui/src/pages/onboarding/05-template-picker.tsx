import { NavButtons } from "../../components/NavButtons";

// Phase C: read packages/agent-templates/_registry.json at runtime via Vite raw import,
// render template tiles with role + tier + KPIs + credits, allow swap per slot.
const TEMPLATE_GROUPS = [
  {
    division: "C-suite (WaveX-authored)",
    templates: ["ceo", "chief-of-staff", "cmo", "cro", "cto", "coo", "cfo", "cdo", "cpo"],
  },
  {
    division: "Engineering (agency-agents + WaveX)",
    templates: ["backend-architect", "frontend-developer", "devops-engineer", "ai-engineer", "recovery-engineer"],
  },
  {
    division: "Marketing (agency-agents)",
    templates: ["growth-hacker", "content-creator", "seo-specialist", "ad-creative-strategist", "ppc-strategist"],
  },
  {
    division: "Sales / Product / Finance / Support / QA",
    templates: ["sales-coach", "sales-engineer", "concierge-ops", "product-manager", "ux-researcher", "trend-researcher", "financial-analyst", "bookkeeper", "support-analytics", "accessibility-auditor"],
  },
  {
    division: "Specialized",
    templates: ["composio-integration"],
  },
];

export default function TemplatePicker() {
  return (
    <>
      <h1>Pick agent templates</h1>
      <p className="text-dim" style={{ fontSize: 16, marginBottom: "2rem" }}>
        30 curated templates — 19 vendored from <a href="https://github.com/msitarzewski/agency-agents" target="_blank" rel="noreferrer">agency-agents</a> (MIT, credited per-file),
        11 WaveX-authored from production patterns. Each agent slot in your org will use one of these.
      </p>

      {TEMPLATE_GROUPS.map((group) => (
        <div key={group.division} className="card">
          <h3 style={{ marginTop: 0, fontSize: 14, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {group.division}
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.5rem" }}>
            {group.templates.map((tpl) => (
              <div key={tpl} style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "0.5rem 0.75rem",
                fontSize: 13,
              }}>
                {tpl}
              </div>
            ))}
          </div>
        </div>
      ))}

      <p className="text-dim" style={{ fontSize: 13 }}>
        <strong>Phase C:</strong> click a template to see its skill content, default KPIs, and required connectors.
      </p>

      <NavButtons back="org-design" next="kpi-ownership" />
    </>
  );
}
