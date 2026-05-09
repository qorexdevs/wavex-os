import { useEffect, useMemo, useState } from "react";
import ReactFlow, { Background, Controls, MarkerType, Node, Edge } from "reactflow";
import { useCompany } from "../../op-omega/lib/CompanyContext";
import { TEMPLATES_BY_ID } from "../../data/templates";

interface AgentRecord {
  agentId: string;
  slot: string;
  templateId: string;
  reportsToSlot?: string;
  ownedKpiIds?: string[];
  status: "pending" | "spawning" | "ready" | "failed";
  spawnedAt?: string;
}

export function FleetGraph() {
  const { companyId } = useCompany();
  const [agents, setAgents] = useState<AgentRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setAgents(null);
      return;
    }
    let alive = true;
    async function load() {
      try {
        const url = `/api/agents?companyId=${encodeURIComponent(companyId!)}`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`agents fetch ${resp.status}`);
        const json = await resp.json();
        if (alive) setAgents(json.agents ?? []);
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    }
    load();
    const id = setInterval(load, 8_000);
    return () => { alive = false; clearInterval(id); };
  }, [companyId]);

  const { nodes, edges } = useMemo(() => buildLayout(agents ?? []), [agents]);

  if (error) {
    return (
      <div className="card" style={{ borderColor: "var(--warning)", color: "var(--warning)" }}>
        Failed to load fleet: {error}. Is mock-core running?
      </div>
    );
  }

  if (agents === null) {
    return <div className="card text-dim">Loading fleet…</div>;
  }

  if (agents.length === 0) {
    return (
      <div className="card">
        <h3 style={{ marginTop: 0 }}>No agents yet</h3>
        <p className="text-dim" style={{ margin: 0 }}>
          Run onboarding to spawn your fleet, or POST <code>/api/paperclip/spawn</code> directly.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <h2 style={{ margin: 0, fontSize: 16, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Fleet · {agents.length} agents
        </h2>
        <span className="text-dim" style={{ fontSize: 11 }}>
          {agents.filter((a) => a.status === "ready").length} ready ·{" "}
          {agents.filter((a) => a.status === "spawning").length} spawning ·{" "}
          {agents.filter((a) => a.status === "failed").length} failed
        </span>
      </div>
      <div style={{ height: 560, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          proOptions={{ hideAttribution: true }}
          minZoom={0.4}
          maxZoom={1.5}
          panOnScroll
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
        >
          <Background color="var(--border)" gap={16} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}

/** Convert "backend-architect" → "Backend Architect", "ceo" → "CEO",
 *  "chief-of-staff" → "Chief of Staff", "ai-engineer" → "AI Engineer". */
const ABBREVIATIONS = new Set([
  "ceo", "cmo", "cpo", "cdo", "cro", "cto", "cfo", "coo",
  "ai", "ml", "ux", "ui", "qa", "ppc", "seo", "kpi", "api", "sdk",
]);
const SMALL_WORDS = new Set(["of", "and", "the", "for", "to", "in", "on", "by"]);

function templateIdToDisplayName(templateId: string): string {
  return templateId.split("-").map((word, i) => {
    if (ABBREVIATIONS.has(word)) return word.toUpperCase();
    if (i > 0 && SMALL_WORDS.has(word)) return word;
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(" ");
}

/** Display label for the origin badge (registry's `origin` is "wavex" or
 *  "agency-agents"; "wavex" prefers brand casing "WaveX"). */
function originLabel(origin: string | undefined): { label: string; color: string } {
  if (origin === "wavex") return { label: "WaveX", color: "var(--accent)" };
  if (origin === "agency-agents") return { label: "agency-agents", color: "#86c5da" };
  return { label: origin ?? "unknown", color: "var(--text-dim)" };
}

function buildLayout(agents: AgentRecord[]): { nodes: Node[]; edges: Edge[] } {
  const TIER_Y: Record<number, number> = { 1: 30, 2: 180, 3: 330, 4: 480 };
  const NODE_W = 200;
  const GAP = 40;

  const tiered: Record<number, AgentRecord[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const a of agents) {
    const tpl = TEMPLATES_BY_ID[a.templateId];
    const tier = (tpl?.tier ?? 3) as 1 | 2 | 3 | 4;
    (tiered[tier] ??= []).push(a);
  }

  const nodes: Node[] = [];
  for (const tierKey of [1, 2, 3, 4] as const) {
    const row = tiered[tierKey] ?? [];
    const totalWidth = row.length * NODE_W + Math.max(0, row.length - 1) * GAP;
    const startX = -totalWidth / 2 + NODE_W / 2;
    row.forEach((a, i) => {
      const tpl = TEMPLATES_BY_ID[a.templateId];
      const statusColor =
        a.status === "ready" ? "var(--accent)" :
        a.status === "spawning" ? "var(--warning)" :
        a.status === "failed" ? "var(--danger)" :
        "var(--text-dim)";
      const origin = originLabel(tpl?.origin);
      const displayName = templateIdToDisplayName(a.templateId);

      nodes.push({
        id: a.slot,
        position: { x: startX + i * (NODE_W + GAP), y: TIER_Y[tierKey] },
        data: {
          label: (
            <div style={{ textAlign: "center", padding: "0.5rem 0.4rem", lineHeight: 1.4 }}>
              <div style={{
                position: "absolute", top: 6, right: 6,
                width: 6, height: 6, borderRadius: "50%",
                background: statusColor,
              }} />
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>
                {displayName}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 3 }}>
                {a.templateId}
              </div>
              <div style={{ fontSize: 10, color: origin.color, marginTop: 3, fontWeight: 600 }}>
                {origin.label}
              </div>
            </div>
          ),
        },
        style: {
          background: "var(--surface)",
          border: `1px solid ${tierKey === 1 ? "var(--accent)" : "var(--border)"}`,
          borderRadius: 6,
          width: NODE_W,
          padding: 0,
          position: "relative",
        },
      });
    });
  }

  const edges: Edge[] = agents
    .filter((a) => a.reportsToSlot)
    .map((a) => ({
      id: `${a.reportsToSlot}->${a.slot}`,
      source: a.reportsToSlot!,
      target: a.slot,
      style: { stroke: "var(--text-dim)", strokeWidth: 1 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "var(--text-dim)" },
    }));

  return { nodes, edges };
}
