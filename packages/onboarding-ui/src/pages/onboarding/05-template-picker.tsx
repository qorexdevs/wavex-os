import { useState } from "react";
import { NavButtons } from "../../components/NavButtons";
import { TemplateModal } from "../../components/TemplateModal";
import { AgentTemplate, templatesByDivision } from "../../data/templates";

export default function TemplatePicker() {
  const [active, setActive] = useState<AgentTemplate | null>(null);
  const groups = templatesByDivision();

  return (
    <>
      <h1>Pick agent templates</h1>
      <p className="text-dim" style={{ fontSize: 16, marginBottom: "2rem" }}>
        30 curated templates — vendored from{" "}
        <a href="https://github.com/msitarzewski/agency-agents" target="_blank" rel="noreferrer">agency-agents</a> (MIT, credited per-file)
        and WaveX-authored from production patterns. Click any tile to view its skill content,
        default KPIs, and origin.
      </p>

      {groups.map((group) => (
        <div key={group.division} className="card">
          <h3 style={{ marginTop: 0, fontSize: 13, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {group.label} <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>· {group.templates.length}</span>
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.5rem" }}>
            {group.templates.map((tpl) => {
              const isWavex = tpl.origin === "wavex";
              return (
                <button
                  key={tpl.templateId}
                  onClick={() => setActive(tpl)}
                  className="secondary"
                  style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    padding: "0.6rem 0.75rem",
                    fontSize: 13,
                    textAlign: "left",
                    color: "var(--text)",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.25rem",
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{tpl.role}</span>
                  <span className="text-dim" style={{ fontSize: 11 }}>
                    tier {tpl.tier} · {isWavex ? "WaveX" : "agency-agents"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <p className="text-dim" style={{ fontSize: 13, marginTop: "1rem" }}>
        Phase D will let you swap a template for any role in your org and persist the change.
      </p>

      <NavButtons back="org-design" next="kpi-ownership" />

      <TemplateModal template={active} onClose={() => setActive(null)} />
    </>
  );
}
