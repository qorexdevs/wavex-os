import { useEffect, useState } from "react";
import { AgentTemplate, loadSkill } from "../data/templates";

export function TemplateModal({
  template,
  onClose,
}: {
  template: AgentTemplate | null;
  onClose: () => void;
}) {
  const [skill, setSkill] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!template) return;
    setSkill(null);
    setError(null);
    loadSkill(template.templateId)
      .then(setSkill)
      .catch((e) => setError(e.message));
  }, [template]);

  // ESC closes
  useEffect(() => {
    if (!template) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [template, onClose]);

  if (!template) return null;

  const credit = template.origin === "agency-agents" && template.upstream
    ? `Vendored from ${template.upstream.repo} (${template.upstream.license}) — ${template.upstream.path}`
    : "WaveX-authored from production patterns";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          width: "min(900px, 90vw)",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0 }}>{template.role}</h2>
            <div className="text-dim" style={{ fontSize: 13, marginTop: "0.25rem" }}>
              tier {template.tier} · {template.division} ·{" "}
              <span className="text-accent">{template.origin === "wavex" ? "WaveX-authored" : "agency-agents (MIT)"}</span>
            </div>
          </div>
          <button className="secondary" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid var(--border)" }}>
          <div className="text-dim" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>Default KPIs</div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {template.defaultKpis.length === 0 && <span className="text-dim" style={{ fontSize: 13 }}>(none — assigned at runtime)</span>}
            {template.defaultKpis.map((k) => (
              <span key={k} style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: "0.25rem 0.5rem",
                fontSize: 12,
                fontFamily: "monospace",
              }}>{k}</span>
            ))}
          </div>
          <div className="text-dim" style={{ fontSize: 11, marginTop: "0.75rem" }}>{credit}</div>
        </div>

        <div style={{ padding: "1.25rem 1.5rem", overflowY: "auto", flex: 1 }}>
          {error && <div style={{ color: "var(--warning)" }}>Failed to load skill: {error}</div>}
          {!skill && !error && <div className="text-dim">Loading skill content...</div>}
          {skill && (
            <pre style={{
              margin: 0,
              fontSize: 12,
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              color: "var(--text-dim)",
              lineHeight: 1.6,
            }}>{skill}</pre>
          )}
        </div>
      </div>
    </div>
  );
}
