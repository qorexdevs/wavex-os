import { displayBundle } from "../../../i18n/phase-labels";
import { Pill } from "./primitives";

export function WorkflowView({
  data,
}: {
  data: {
    agent_workflows: Record<string, { on_fire: unknown[]; heartbeat: string }>;
    dry_run_gates: string[];
    bundle_workflows: Record<string, { owner: string; cycle_length: string; kpis_moved: string[] }>;
    t2_patches?: Array<{ agent_id: string; changed_fields: string[]; rationale: string; pillar_signal: string }>;
  };
}) {
  const agentCount = Object.keys(data.agent_workflows).length;
  const patches = data.t2_patches ?? [];
  return (
    <div className="space-y-3 text-sm">
      <div className="flex gap-3 text-xs">
        <Pill color="emerald">{agentCount} capabilities configured</Pill>
        <Pill color="amber">{data.dry_run_gates.length} actions held for your review</Pill>
      </div>
      <section>
        <div className="mb-1 text-[11px] font-semibold uppercase text-muted-foreground">Your cycles</div>
        <ul className="space-y-1">
          {Object.entries(data.bundle_workflows).map(([id, b]) => (
            <li key={id} className="rounded-md border p-2 text-xs">
              <div className="font-semibold">{displayBundle(id)}</div>
              <div className="text-muted-foreground">
                Led by {b.owner} · runs every {b.cycle_length} · tracks {b.kpis_moved.join(", ")}
              </div>
            </li>
          ))}
        </ul>
      </section>
      {patches.length > 0 && (
        <details>
          <summary className="cursor-pointer text-[11px] font-semibold uppercase text-muted-foreground">
            {patches.length} capabilit{patches.length === 1 ? "y" : "ies"} customized for your situation
          </summary>
          <ul className="mt-1 space-y-1 pl-4 text-xs">
            {patches.map((p) => (
              <li key={p.agent_id} className="rounded-md border p-2">
                <div className="font-semibold">
                  <code>{p.agent_id}</code>
                </div>
                <div className="mt-0.5 text-muted-foreground">{p.rationale}</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground/70">
                  Driven by <code>{p.pillar_signal}</code> · changed {p.changed_fields.join(", ")}
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
      <details>
        <summary className="cursor-pointer text-[11px] font-semibold uppercase text-muted-foreground">
          {data.dry_run_gates.length} actions held for your review before anything runs in your tools
        </summary>
        <ul className="mt-1 space-y-0.5 pl-4 text-xs">
          {data.dry_run_gates.map((g) => (
            <li key={g}>
              <code>{g}</code>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
