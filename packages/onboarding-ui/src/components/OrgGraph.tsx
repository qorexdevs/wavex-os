/** Org chart visualization — used by both Mission Control's FleetGraph
 *  (post-Activate, sourced from DB) and Phase 3 Swarm (mid-onboarding,
 *  sourced from the in-memory manifest). Owns layout + node styling so
 *  both surfaces render identically. */

import { useMemo } from "react";
import ReactFlow, { Background, Controls, MarkerType, type Node, type Edge, type ReactFlowInstance } from "reactflow";
// Reactflow's stylesheet must be imported once for nodes/edges/handles to
// receive their `position: absolute` + transform layout. Without this, every
// node is rendered as a block element and they cascade vertically down the
// page instead of being positioned by their canvas coordinates.
import "reactflow/dist/style.css";
import { TEMPLATES_BY_ID } from "../data/templates";
import { tierForSlot } from "../data/slot-to-template";

/** Status enum union of the manifest shape (active/standby/parked/disabled)
 *  + the FleetGraph projection (pending/spawning/ready/failed). The render
 *  collapses both into a status-color dot. */
export type OrgAgentStatus =
  | "active" | "standby" | "parked" | "disabled"
  | "pending" | "spawning" | "ready" | "failed";

export interface OrgAgent {
  /** Unique id used as the reactflow node id. agentId from DB, slot from manifest. */
  id: string;
  slot: string;
  templateId: string;
  reportsToSlot?: string;
  status: OrgAgentStatus;
}

export interface OrgGraphProps {
  agents: OrgAgent[];
  /** Container height in px. Defaults to 540. */
  height?: number;
  /** Click handler fired when an agent node is clicked. Used by Phase 3 to open
   *  the swap panel. Mission Control's FleetGraph leaves it undefined. */
  onAgentClick?: (agent: OrgAgent) => void;
  /** When provided, agents whose `id` (slot) is NOT in this set render at
   *  reduced opacity. Used by Swarm Studio's search + filter chips to
   *  visually focus the chart without removing context. */
  highlightSlots?: Set<string>;
  /** Optional per-agent hover hint — returned string is set as the node's
   *  `title` attribute, surfacing a native browser tooltip. */
  hoverDetail?: (agent: OrgAgent) => string;
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

function originLabel(origin: string | undefined): { label: string; color: string } {
  if (origin === "wavex") return { label: "WaveX", color: "var(--accent)" };
  if (origin === "agency-agents") return { label: "agency-agents", color: "#86c5da" };
  return { label: origin ?? "unknown", color: "var(--text-dim)" };
}

function statusColor(status: OrgAgentStatus): string {
  // active+ready = green; standby/parked/pending = warning; disabled/failed = danger
  if (status === "active" || status === "ready") return "var(--accent)";
  if (status === "spawning") return "var(--warning)";
  if (status === "standby" || status === "parked" || status === "pending") return "var(--warning)";
  if (status === "disabled" || status === "failed") return "var(--danger)";
  return "var(--text-dim)";
}

const NODE_W = 180;
const NODE_H = 64;

function makeNode(
  a: OrgAgent,
  x: number,
  y: number,
  tier: number,
  opts: { dimmedByFilter?: boolean; hoverTitle?: string } = {},
): Node {
  const tpl = TEMPLATES_BY_ID[a.templateId];
  const dotColor = statusColor(a.status);
  const origin = originLabel(tpl?.origin);
  const displayName = templateIdToDisplayName(a.templateId);
  // Inactive agents (parked/disabled/failed) render dimmer so the scope
  // filter is visible at a glance. Active/standby keep full opacity.
  // Search/filter dimming layers on top with a stronger fade so operators
  // can spot a match across the chart at a glance.
  const dimByStatus = a.status === "parked" || a.status === "disabled" || a.status === "failed";
  const dimByFilter = opts.dimmedByFilter === true;
  const finalOpacity = dimByFilter ? 0.15 : dimByStatus ? 0.4 : 1;
  return {
    id: a.id,
    position: { x, y },
    data: {
      label: (
        <div
          style={{ textAlign: "center", padding: "0.45rem 0.4rem", lineHeight: 1.35, opacity: finalOpacity, transition: "opacity 0.18s ease-out" }}
          title={opts.hoverTitle}
        >
          <div style={{
            position: "absolute", top: 6, right: 6,
            width: 6, height: 6, borderRadius: "50%",
            background: dotColor,
          }} />
          <div style={{ fontWeight: 700, fontSize: 12, color: "var(--text)" }}>
            {displayName}
          </div>
          <div style={{ fontSize: 9, color: "var(--text-dim)", marginTop: 2 }}>
            {a.templateId}
          </div>
          <div style={{ fontSize: 9, color: origin.color, marginTop: 2, fontWeight: 600 }}>
            {origin.label}
          </div>
        </div>
      ),
    },
    style: {
      background: dimByStatus || dimByFilter ? "color-mix(in srgb, var(--surface) 60%, transparent)" : "var(--surface)",
      border: `1px solid ${dimByStatus || dimByFilter ? "var(--border)" : tier === 1 ? "var(--accent)" : "var(--border)"}`,
      borderRadius: 6,
      width: NODE_W,
      padding: 0,
      // NB: do NOT set `position: relative` here — it overrides reactflow's
      // `position: absolute` rule and breaks node layout (every node ends up
      // stacking vertically in normal flow instead of being positioned by
      // its `transform: translate(x, y)`).
    },
  };
}

/** Tree-by-chief layout: tier 1 (CEO) centered at top, tier 2 chiefs in a
 *  horizontal row below, then each chief's tier-3 sub-agents stacked
 *  vertically directly under them. Beats the old "all-of-tier-3-in-one-row"
 *  approach which produced a 6000px-wide graph with 26 sub-agents. */
function buildLayout(
  agents: OrgAgent[],
  opts: { highlightSlots?: Set<string>; hoverDetail?: (a: OrgAgent) => string } = {},
): { nodes: Node[]; edges: Edge[] } {
  const hasHighlight = opts.highlightSlots !== undefined;
  const nodeOpts = (a: OrgAgent) => ({
    dimmedByFilter: hasHighlight ? !opts.highlightSlots!.has(a.id) : false,
    hoverTitle: opts.hoverDetail?.(a),
  });
  const COL_GAP = 28;
  const T1_T2_GAP = 90;
  const T2_T3_GAP = 60;
  const T3_T3_GAP = 12;

  const byTier = (t: number) => agents.filter((a) => {
    const tpl = TEMPLATES_BY_ID[a.templateId];
    return (tpl?.tier ?? tierForSlot(a.slot)) === t;
  });

  const tier1 = byTier(1);
  const tier2 = byTier(2);
  // Anything not at tier 1 or 2 is treated as a leaf hanging under its parent.
  const leafChildrenBySlot = new Map<string, OrgAgent[]>();
  for (const chief of tier2) leafChildrenBySlot.set(chief.slot, []);
  const orphans: OrgAgent[] = [];
  for (const a of agents) {
    const tpl = TEMPLATES_BY_ID[a.templateId];
    const tier = (tpl?.tier ?? tierForSlot(a.slot));
    if (tier === 1 || tier === 2) continue;
    if (a.reportsToSlot && leafChildrenBySlot.has(a.reportsToSlot)) {
      leafChildrenBySlot.get(a.reportsToSlot)!.push(a);
    } else {
      orphans.push(a);
    }
  }

  const nodes: Node[] = [];

  // Tier 2 columns: each chief is one column, x-positioned across the canvas.
  const numCols = Math.max(1, tier2.length);
  const totalWidth = numCols * NODE_W + (numCols - 1) * COL_GAP;
  const startX = -totalWidth / 2 + NODE_W / 2;
  const Y_T1 = 0;
  const Y_T2 = NODE_H + T1_T2_GAP;
  const Y_T3 = Y_T2 + NODE_H + T2_T3_GAP;

  // Tier 1 (CEO + any kernel agents like Chief of Staff) — lay out in a
  // row at the top, centered. With one tier-1 agent the row sits at x=0;
  // with two it spreads them ±NODE_W so they're visible side-by-side.
  const t1Width = tier1.length * NODE_W + Math.max(0, tier1.length - 1) * COL_GAP;
  const t1StartX = -t1Width / 2 + NODE_W / 2;
  tier1.forEach((agent, i) => {
    const x = t1StartX + i * (NODE_W + COL_GAP);
    nodes.push(makeNode(agent, x, Y_T1, 1, nodeOpts(agent)));
  });

  // Tier 2 chiefs + their tier-3 children stacked below.
  tier2.forEach((chief, i) => {
    const x = startX + i * (NODE_W + COL_GAP);
    nodes.push(makeNode(chief, x, Y_T2, 2, nodeOpts(chief)));
    const children = leafChildrenBySlot.get(chief.slot) ?? [];
    children.forEach((child, j) => {
      const y = Y_T3 + j * (NODE_H + T3_T3_GAP);
      nodes.push(makeNode(child, x, y, 3, nodeOpts(child)));
    });
  });

  // Orphans (agents that don't report to any tier-2 chief — rare): drop them
  // in a column off to the right so they're still visible.
  if (orphans.length > 0) {
    const orphanX = startX + numCols * (NODE_W + COL_GAP);
    orphans.forEach((o, j) => {
      nodes.push(makeNode(o, orphanX, Y_T3 + j * (NODE_H + T3_T3_GAP), 3, nodeOpts(o)));
    });
  }

  // Edges follow reports_to chains via slot → id lookup.
  const idBySlot = new Map(agents.map((a) => [a.slot, a.id]));
  const edges: Edge[] = agents
    .filter((a) => a.reportsToSlot && idBySlot.has(a.reportsToSlot))
    .map((a) => ({
      id: `${a.reportsToSlot}->${a.slot}`,
      source: idBySlot.get(a.reportsToSlot!)!,
      target: a.id,
      style: { stroke: "var(--text-dim)", strokeWidth: 1 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "var(--text-dim)" },
    }));

  return { nodes, edges };
}

export function OrgGraph({ agents, height = 540, onAgentClick, highlightSlots, hoverDetail }: OrgGraphProps) {
  const { nodes, edges } = useMemo(
    () => buildLayout(agents, { highlightSlots, hoverDetail }),
    [agents, highlightSlots, hoverDetail],
  );
  const agentsById = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);

  return (
    <div style={{ height, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.05 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.2}
        maxZoom={1.5}
        panOnScroll
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        defaultViewport={{ x: 0, y: 0, zoom: 0.5 }}
        onNodeClick={onAgentClick ? (_e, node) => {
          const a = agentsById.get(node.id);
          if (a) onAgentClick(a);
        } : undefined}
        onInit={(rf: ReactFlowInstance) => {
          rf.fitView({ padding: 0.05, duration: 0 });
          setTimeout(() => rf.fitView({ padding: 0.05, duration: 0 }), 80);
        }}
        // Re-key on agents.length so onInit re-fires when the topology changes
        key={agents.length}
      >
        <Background color="var(--border)" gap={16} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
