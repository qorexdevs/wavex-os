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
      <div style={{ height: 380, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
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

function buildLayout(agents: AgentRecord[]): { nodes: Node[]; edges: Edge[] } {
  const TIER_Y: Record<number, number> = { 1: 30, 2: 180, 3: 330 };
  const NODE_W = 200;
  const GAP = 40;

  const tiered: Record<number, AgentRecord[]> = { 1: [], 2: [], 3: [] };
  for (const a of agents) {
    const tpl = TEMPLATES_BY_ID[a.templateId];
    const tier = (tpl?.tier ?? 3) as 1 | 2 | 3;
    (tiered[tier] ??= []).push(a);
  }

  const nodes: Node[] = [];
  for (const tierKey of [1, 2, 3] as const) {
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
      const isWavex = tpl?.origin === "wavex";

      nodes.push({
        id: a.slot,
        position: { x: startX + i * (NODE_W + GAP), y: TIER_Y[tierKey] },
        data: {
          label: (
            <div style={{ textAlign: "left", padding: "0.3rem 0.4rem", lineHeight: 1.3 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>{a.slot}</span>
                <span style={{
                  display: "inline-block",
                  width: 6, height: 6, borderRadius: "50%",
                  background: statusColor,
                }} />
              </div>
              <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>
                {a.templateId}
              </div>
              <div style={{ fontSize: 9, color: isWavex ? "var(--accent)" : "#86c5da", marginTop: 2 }}>
                {a.agentId.slice(0, 12)}…
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
