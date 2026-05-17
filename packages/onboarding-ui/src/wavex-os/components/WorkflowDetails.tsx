/** Full structured workflow detail shown behind the "Read the workflow
 *  manifest" toggle on ImprintTheater Act 3. Layout lifted from the
 *  legacy Phase 4 screen — five cards covering per-agent flows, bundle
 *  flows, scheduled routines, T2 patches (the pillar-attribution moment),
 *  and dry-run gates.
 *
 *  Read-only. No state, no buttons. */

import type { WorkflowManifest } from "@wavex-os/plugin-onboarding";
import { Card } from "./primitives";

interface Props {
  manifest: WorkflowManifest;
}

export function WorkflowDetails({ manifest }: Props) {
  const agentWorkflows = Object.entries(manifest.agent_workflows);
  const bundleWorkflows = Object.entries(manifest.bundle_workflows);
  const routines = Object.entries(manifest.scheduled_routines_enabled);
  const t2patches = manifest.t2_patches ?? [];

  return (
    <div style={{ width: "100%", marginTop: "0.6rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      <Card>
        <h3 style={sectionTitle}>
          Per-agent workflows ({agentWorkflows.length})
        </h3>
        {agentWorkflows.map(([slot, wf]) => (
          <div key={slot} style={row}>
            <div>
              <strong>{slot}</strong>{" "}
              <span className="text-dim" style={{ fontSize: 11 }}>
                · heartbeat {wf.heartbeat} · {wf.on_fire.length} tasks
              </span>
            </div>
            <div className="text-dim" style={{ fontSize: 11, marginTop: 2 }}>
              {wf.on_fire.map((t) => t.task + (t.dry_run_gate ? "🔒" : "")).join(" → ")}
            </div>
            {wf.escalation.length > 0 && (
              <div className="text-dim" style={{ fontSize: 10, marginTop: 2 }}>
                escalation: {wf.escalation.map((e) => `${e.on}→${e.to}`).join(", ")}
              </div>
            )}
          </div>
        ))}
      </Card>

      {bundleWorkflows.length > 0 && (
        <Card>
          <h3 style={sectionTitle}>
            Bundle workflows ({bundleWorkflows.length})
          </h3>
          {bundleWorkflows.map(([id, b]) => (
            <div key={id} style={row}>
              <div>
                <code>{id}</code> · {b.cycle_length} · owner <strong>{b.owner}</strong>
              </div>
              <div className="text-dim" style={{ fontSize: 11 }}>
                {b.participating_agents.length} agents · KPIs: {b.kpis_moved.join(", ")}
              </div>
            </div>
          ))}
        </Card>
      )}

      {routines.length > 0 && (
        <Card>
          <h3 style={sectionTitle}>
            Scheduled routines ({routines.length})
          </h3>
          {routines.map(([name, cron]) => (
            <div key={name} style={{ ...row, padding: "0.4rem 0", fontSize: 12 }}>
              <code>{name}</code> <span className="text-dim">· {cron}</span>
            </div>
          ))}
        </Card>
      )}

      {t2patches.length > 0 && (
        <Card>
          <h3 style={{ ...sectionTitle, color: "var(--accent)" }}>
            T2 patches ({t2patches.length})
          </h3>
          {t2patches.map((p, i) => (
            <div key={i} style={{ ...row, padding: "0.4rem 0", fontSize: 12 }}>
              <strong>{p.agent_id}</strong> · {p.changed_fields.join(", ")}
              <div className="text-dim" style={{ marginTop: 2 }}>{p.rationale}</div>
              <div style={{ fontSize: 10, marginTop: 2, color: "var(--accent)" }}>
                signal: {p.pillar_signal}
              </div>
            </div>
          ))}
        </Card>
      )}

      {manifest.dry_run_gates.length > 0 && (
        <Card>
          <h3 style={{ ...sectionTitle, color: "var(--warning)", textTransform: "none" }}>
            🔒 Dry-run gates ({manifest.dry_run_gates.length}) — 14-day write suppression
          </h3>
          {/* Wrap each gate token so they reflow on narrow containers
           *  instead of overflowing horizontally (the prior layout cut off
           *  any gate past the first ~3 on Theater Act 3 detail). */}
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.4rem 0.65rem",
            fontSize: 11,
            color: "var(--text-dim)",
            lineHeight: 1.6,
          }}>
            {manifest.dry_run_gates.map((g) => (
              <code key={g} style={{
                wordBreak: "break-all",
                background: "color-mix(in srgb, var(--warning) 6%, transparent)",
                border: "1px solid color-mix(in srgb, var(--warning) 25%, transparent)",
                borderRadius: 4,
                padding: "0.1rem 0.4rem",
              }}>{g}</code>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

const sectionTitle: React.CSSProperties = {
  marginTop: 0,
  fontSize: 13,
  color: "var(--text-dim)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const row: React.CSSProperties = {
  borderBottom: "1px solid var(--border)",
  padding: "0.5rem 0",
  fontSize: 13,
};
