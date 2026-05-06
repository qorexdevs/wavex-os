import { useMemo } from "react";
import ReactFlow, { Background, Controls, MarkerType, Node, Edge } from "reactflow";
import "reactflow/dist/style.css";
import { NavButtons } from "../../components/NavButtons";
import { DEFAULT_ORG, TEMPLATES_BY_ID } from "../../data/templates";

// Lay out the default org as a 3-tier hierarchy:
//   tier 1: CEO + CoS (centered)
//   tier 2: CxOs (spread horizontally)
//   tier 3: operators reporting to CxOs
function buildLayout(): { nodes: Node[]; edges: Edge[] } {
  const TIER_Y: Record<number, number> = { 1: 30, 2: 180, 3: 330 };
  const NODE_W = 180;
  const GAP = 40;

  // Group org nodes by their effective tier
  const tiered: Record<number, typeof DEFAULT_ORG> = { 1: [], 2: [], 3: [] };
  for (const node of DEFAULT_ORG) {
    const tpl = TEMPLATES_BY_ID[node.templateId];
    const tier = (tpl?.tier ?? 3) as 1 | 2 | 3;
    (tiered[tier] ??= []).push(node);
  }

  const nodes: Node[] = [];
  for (const tierKey of [1, 2, 3] as const) {
    const row = tiered[tierKey] ?? [];
    const totalWidth = row.length * NODE_W + (row.length - 1) * GAP;
    const startX = -totalWidth / 2 + NODE_W / 2;
    row.forEach((n, i) => {
      const tpl = TEMPLATES_BY_ID[n.templateId];
      const isWavex = tpl?.origin === "wavex";
      nodes.push({
        id: n.slot,
        position: { x: startX + i * (NODE_W + GAP), y: TIER_Y[tierKey] },
        data: {
          label: (
            <div style={{ textAlign: "center", padding: "0.25rem", lineHeight: 1.3 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>{n.label}</div>
              <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>
                {n.templateId}
              </div>
              <div style={{ fontSize: 9, color: isWavex ? "var(--accent)" : "#86c5da", marginTop: 2 }}>
                {isWavex ? "WaveX" : "agency-agents"}
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

  const edges: Edge[] = DEFAULT_ORG
    .filter((n) => n.reportsToSlot)
    .map((n) => ({
      id: `${n.reportsToSlot}->${n.slot}`,
      source: n.reportsToSlot!,
      target: n.slot,
      style: { stroke: "var(--text-dim)", strokeWidth: 1 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "var(--text-dim)" },
    }));

  return { nodes, edges };
}

export default function OrgDesign() {
  const { nodes, edges } = useMemo(buildLayout, []);

  return (
    <>
      <h1>Default org tree</h1>
      <p className="text-dim" style={{ fontSize: 16, marginBottom: "1.5rem" }}>
        Based on your industry, here's a recommended starting org. Drag nodes to rearrange the
        view; the actual reporting relationships persist in your manifest. You can swap templates
        on the next step.
      </p>

      <div className="card" style={{ height: 480, padding: 0, overflow: "hidden", borderRadius: 8 }}>
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

      <p className="text-dim" style={{ fontSize: 13, marginTop: "1rem" }}>
        Phase D will let you add/remove agents, change reporting lines, and persist these
        edits to your manifest.
      </p>

      <NavButtons back="connectors" next="template-picker" />
    </>
  );
}
