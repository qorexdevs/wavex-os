/** Org chart visualization — used by both Mission Control's FleetGraph
 *  (post-Activate, sourced from DB) and Phase 3 Swarm (mid-onboarding,
 *  sourced from the in-memory manifest). Owns layout + node styling so
 *  both surfaces render identically. */

import { useMemo } from "react";
import ReactFlow, { Background, Controls, MarkerType, type Node, type Edge } from "reactflow";
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
  /** Container height in px. Defaults to 560. */
  height?: number;
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

function buildLayout(agents: OrgAgent[]): { nodes: Node[]; edges: Edge[] } {
  const TIER_Y: Record<number, number> = { 1: 30, 2: 180, 3: 330, 4: 480 };
  const NODE_W = 200;
  const GAP = 40;

  const tiered: Record<number, OrgAgent[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const a of agents) {
    const tpl = TEMPLATES_BY_ID[a.templateId];
    const tier = (tpl?.tier ?? tierForSlot(a.slot)) as 1 | 2 | 3 | 4;
    (tiered[tier] ??= []).push(a);
  }

  const nodes: Node[] = [];
  for (const tierKey of [1, 2, 3, 4] as const) {
    const row = tiered[tierKey] ?? [];
    const totalWidth = row.length * NODE_W + Math.max(0, row.length - 1) * GAP;
    const startX = -totalWidth / 2 + NODE_W / 2;
    row.forEach((a, i) => {
      const tpl = TEMPLATES_BY_ID[a.templateId];
      const dotColor = statusColor(a.status);
      const origin = originLabel(tpl?.origin);
      const displayName = templateIdToDisplayName(a.templateId);

      nodes.push({
        id: a.id,
        position: { x: startX + i * (NODE_W + GAP), y: TIER_Y[tierKey] },
        data: {
          label: (
            <div style={{ textAlign: "center", padding: "0.5rem 0.4rem", lineHeight: 1.4 }}>
              <div style={{
                position: "absolute", top: 6, right: 6,
                width: 6, height: 6, borderRadius: "50%",
                background: dotColor,
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

  // Edges use slot pairs since reportsToSlot is a slot-name reference. Map
  // each slot to its node id (for DB-sourced data, slot ≠ id).
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

export function OrgGraph({ agents, height = 560 }: OrgGraphProps) {
  const { nodes, edges } = useMemo(() => buildLayout(agents), [agents]);

  return (
    <div style={{ height, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
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
  );
}
