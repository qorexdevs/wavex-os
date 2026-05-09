/**
 * Operator Ω · Swarm org-chart visualization for the onboarding preview.
 *
 * Renders the 33-agent topology as a 6-column grid (one column per
 * department), with the CEO at the top and a faint connector line down to
 * each chief. Status is color-coded: active = solid dept-color accent,
 * standby = dashed sky outline, parked = dashed amber outline, disabled =
 * grayed + struck through. Spawn-eligible agents get an S+ pill.
 *
 * Click an agent to open a side panel with full details (heartbeat, budget,
 * skill overlay, unpark condition / reason / connector dependency). Status
 * filter chips above the chart dim agents that don't match the active filter.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { BUNDLE_NAMES } from "../../../i18n/phase-labels";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../../ui/sheet";

export type AgentStatus = "active" | "standby" | "parked" | "disabled";
export type Department = "ceo" | "product" | "marketing" | "revenue" | "finance" | "data" | "ops";

export interface SwarmAgentEntry {
  status: AgentStatus;
  department: string; // runtime type, but narrowed to Department for display
  level: string;
  reports_to: string | null;
  heartbeat: string;
  budget_monthly_usd: number;
  skill_overlay: string | null;
  unpark_condition?: string;
  waiting_on_connector?: string;
  reason?: string;
  spawnable: boolean;
}

export interface SwarmOrgChartProps {
  agents: Record<string, SwarmAgentEntry>;
  /** Optional: highlights a single agent (e.g., on hover from parent). */
  highlightId?: string;
  bundleAllocation?: Record<string, number>;
  topology?: { active_count: number; standby_count?: number; parked_count: number; disabled_count: number; total_base_roster: number };
}

const DEPT_COLOR: Record<Department, string> = {
  ceo: "#c11b2a",
  product: "#4a9eff",
  marketing: "#ff6b7a",
  revenue: "#f0b954",
  finance: "#52c896",
  data: "#b67fff",
  ops: "#7a8899",
};

const DEPT_LABEL: Record<Department, string> = {
  ceo: "CEO",
  product: "Product",
  marketing: "Marketing",
  revenue: "Revenue",
  finance: "Finance",
  data: "Data",
  ops: "Ops",
};

const DEPT_ORDER: Department[] = ["product", "marketing", "revenue", "finance", "data", "ops"];

const STATUS_LABEL: Record<AgentStatus, string> = {
  active: "Active",
  standby: "Standby",
  parked: "Parked",
  disabled: "Disabled",
};

const STATUS_DESCRIPTION: Record<AgentStatus, string> = {
  active: "Online and ready. Will fire at its declared heartbeat interval.",
  standby: "Waiting on a connector to be plugged. Will activate automatically once the connector is configured.",
  parked: "Not active for your current stage. Will activate when its unpark condition is met.",
  disabled: "Not relevant to your situation. Disabled by activation rules; not counted against your budget.",
};

function isDepartment(d: string): d is Department {
  return d === "ceo" || d === "product" || d === "marketing" || d === "revenue" || d === "finance" || d === "data" || d === "ops";
}

export function SwarmOrgChart({ agents, highlightId, bundleAllocation, topology }: SwarmOrgChartProps) {
  const [statusFilter, setStatusFilter] = useState<Set<AgentStatus>>(
    new Set(["active", "standby", "parked", "disabled"]),
  );
  const [openAgent, setOpenAgent] = useState<{ id: string; entry: SwarmAgentEntry } | null>(null);

  const toggleStatus = (s: AgentStatus) => {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) {
        // Don't allow zero filters — fall back to "all on"
        if (next.size === 1) return new Set(["active", "standby", "parked", "disabled"]);
        next.delete(s);
      } else {
        next.add(s);
      }
      return next;
    });
  };

  // Partition agents by role + department.
  const ceo = Object.entries(agents).find(([id]) => id === "ceo.orchestrator");
  const chiefs: Record<Department, [string, SwarmAgentEntry] | undefined> = {
    ceo: undefined,
    product: undefined,
    marketing: undefined,
    revenue: undefined,
    finance: undefined,
    data: undefined,
    ops: undefined,
  };
  const subs: Record<Department, Array<[string, SwarmAgentEntry]>> = {
    ceo: [],
    product: [],
    marketing: [],
    revenue: [],
    finance: [],
    data: [],
    ops: [],
  };

  for (const [id, entry] of Object.entries(agents)) {
    if (id === "ceo.orchestrator") continue;
    if (!isDepartment(entry.department)) continue;
    if (entry.level === "L·III") {
      chiefs[entry.department] = [id, entry];
    } else if (entry.level === "L·IV") {
      subs[entry.department].push([id, entry]);
    }
  }

  // Sort sub-agents alphabetically within each department for stable layout.
  for (const dept of DEPT_ORDER) {
    subs[dept].sort((a, b) => a[0].localeCompare(b[0]));
  }

  const matchesFilter = (entry: SwarmAgentEntry) => statusFilter.has(entry.status);

  return (
    <div className="space-y-3">
      {topology && <TopologyBadges topology={topology} statusFilter={statusFilter} onToggle={toggleStatus} />}

      <div className="text-[10px] text-muted-foreground">
        Click an agent for details. Use the status pills above to dim non-matching agents.
      </div>

      {/* Board + CEO row */}
      <div className="flex justify-center">
        <div className="flex flex-col items-center gap-1">
          <div className="rounded border border-dashed border-muted-foreground/40 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Board (you)
          </div>
          <Connector />
          {ceo ? (
            <AgentCard
              id={ceo[0]}
              entry={ceo[1]}
              isChief
              isCeo
              highlighted={highlightId === ceo[0]}
              dimmed={!matchesFilter(ceo[1])}
              onClick={() => setOpenAgent({ id: ceo[0], entry: ceo[1] })}
            />
          ) : null}
        </div>
      </div>

      <HorizontalConnector />

      {/* 6 department columns */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {DEPT_ORDER.map((dept) => {
          const chief = chiefs[dept];
          const subAgents = subs[dept];
          return (
            <div key={dept} className="flex flex-col items-stretch gap-1.5">
              <div
                className="mb-0.5 text-center text-[9px] font-semibold uppercase tracking-wider"
                style={{ color: DEPT_COLOR[dept] }}
              >
                {DEPT_LABEL[dept]}
              </div>
              {chief ? (
                <AgentCard
                  id={chief[0]}
                  entry={chief[1]}
                  isChief
                  highlighted={highlightId === chief[0]}
                  dimmed={!matchesFilter(chief[1])}
                  onClick={() => setOpenAgent({ id: chief[0], entry: chief[1] })}
                />
              ) : (
                <div className="rounded border border-dashed border-muted-foreground/30 p-2 text-center text-[10px] text-muted-foreground">
                  no chief
                </div>
              )}
              {subAgents.length > 0 && <Connector />}
              <div className="flex flex-col gap-1">
                {subAgents.map(([id, e]) => (
                  <AgentCard
                    key={id}
                    id={id}
                    entry={e}
                    highlighted={highlightId === id}
                    dimmed={!matchesFilter(e)}
                    onClick={() => setOpenAgent({ id, entry: e })}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {bundleAllocation && (
        <section className="pt-2">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Where your team will focus first
          </div>
          <div className="space-y-0.5">
            {Object.entries(bundleAllocation).map(([bundle, w]) => (
              <div key={bundle} className="flex items-center gap-2 text-[10px]">
                <span className="w-52">{BUNDLE_NAMES[bundle] ?? bundle}</span>
                <div className="h-1 flex-1 overflow-hidden rounded bg-muted">
                  <div className="h-full bg-emerald-500" style={{ width: `${w * 100}%` }} />
                </div>
                <span className="w-8 text-right font-mono tabular-nums">{(w * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <Sheet open={!!openAgent} onOpenChange={(open: boolean) => !open && setOpenAgent(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          {openAgent && <AgentDetailContent id={openAgent.id} entry={openAgent.entry} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function TopologyBadges({
  topology,
  statusFilter,
  onToggle,
}: {
  topology: NonNullable<SwarmOrgChartProps["topology"]>;
  statusFilter: Set<AgentStatus>;
  onToggle: (s: AgentStatus) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 text-[11px]">
      <FilterBadge
        tone="emerald"
        active={statusFilter.has("active")}
        onClick={() => onToggle("active")}
      >
        {topology.active_count} active
      </FilterBadge>
      {(topology.standby_count ?? 0) > 0 && (
        <FilterBadge
          tone="sky"
          active={statusFilter.has("standby")}
          onClick={() => onToggle("standby")}
        >
          {topology.standby_count} waiting on connector
        </FilterBadge>
      )}
      {topology.parked_count > 0 && (
        <FilterBadge
          tone="amber"
          active={statusFilter.has("parked")}
          onClick={() => onToggle("parked")}
        >
          {topology.parked_count} parked
        </FilterBadge>
      )}
      {topology.disabled_count > 0 && (
        <FilterBadge
          tone="rose"
          active={statusFilter.has("disabled")}
          onClick={() => onToggle("disabled")}
        >
          {topology.disabled_count} disabled
        </FilterBadge>
      )}
    </div>
  );
}

function FilterBadge({
  tone,
  active,
  onClick,
  children,
}: {
  tone: "emerald" | "amber" | "rose" | "sky";
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const styles = {
    emerald: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-emerald-500/40",
    sky: "bg-sky-500/15 text-sky-700 dark:text-sky-400 ring-sky-500/40",
    amber: "bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-amber-500/40",
    rose: "bg-rose-500/15 text-rose-700 dark:text-rose-400 ring-rose-500/40",
  } as const;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded px-2 py-0.5 text-[10px] font-medium transition",
        styles[tone],
        active ? "ring-1" : "opacity-50 hover:opacity-100",
      )}
    >
      {children}
    </button>
  );
}

function AgentCard({
  id,
  entry,
  isChief = false,
  isCeo = false,
  highlighted = false,
  dimmed = false,
  onClick,
}: {
  id: string;
  entry: SwarmAgentEntry;
  isChief?: boolean;
  isCeo?: boolean;
  highlighted?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
}) {
  const dept = isDepartment(entry.department) ? entry.department : "ops";
  const color = DEPT_COLOR[dept];

  const statusStyles: Record<AgentStatus, string> = {
    active: "bg-card",
    standby: "bg-sky-500/5 border-sky-500/40 border-dashed",
    parked: "bg-amber-500/5 border-amber-500/40 border-dashed",
    disabled: "bg-muted/30 line-through decoration-1",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      title={tooltipFor(id, entry)}
      className={cn(
        "group relative w-full rounded border px-1.5 py-1 text-left text-[10px] transition",
        statusStyles[entry.status],
        isCeo && "border-2",
        isChief && "font-semibold",
        highlighted && "ring-2 ring-emerald-400",
        dimmed ? "opacity-30 hover:opacity-60" : "hover:bg-accent/40 hover:shadow-sm",
        "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
      )}
      style={{
        borderLeftColor: color,
        borderLeftWidth: entry.status === "active" ? (isChief ? 4 : 2) : undefined,
      }}
    >
      <div className="flex items-center justify-between gap-1">
        <code className="truncate">{id}</code>
        {entry.spawnable && entry.status === "active" && (
          <span className="shrink-0 rounded bg-purple-500/20 px-1 text-[9px] font-bold text-purple-700 dark:text-purple-300">
            S+
          </span>
        )}
      </div>
      {entry.status === "active" && entry.skill_overlay && (
        <div className="mt-0.5 line-clamp-3 text-[9px] leading-tight text-muted-foreground" title={entry.skill_overlay}>
          {entry.skill_overlay}
        </div>
      )}
      {entry.status === "standby" && entry.waiting_on_connector && (
        <div
          className="mt-0.5 truncate text-[9px] text-sky-700 dark:text-sky-400"
          title={`Activates when you connect ${entry.waiting_on_connector}`}
        >
          needs: {entry.waiting_on_connector}
        </div>
      )}
      {entry.status === "parked" && entry.unpark_condition && (
        <div
          className="mt-0.5 line-clamp-2 text-[9px] leading-tight text-amber-700 dark:text-amber-400"
          title={entry.unpark_condition}
        >
          park: {entry.unpark_condition}
        </div>
      )}
      {entry.status === "disabled" && entry.reason && (
        <div
          className="mt-0.5 line-clamp-2 text-[9px] leading-tight text-rose-700 dark:text-rose-400"
          title={entry.reason}
        >
          {entry.reason}
        </div>
      )}
    </button>
  );
}

function AgentDetailContent({ id, entry }: { id: string; entry: SwarmAgentEntry }) {
  const dept = isDepartment(entry.department) ? entry.department : "ops";
  const color = DEPT_COLOR[dept];
  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2 font-mono text-base">
          <span className="size-2 rounded-full" style={{ background: color }} />
          {id}
        </SheetTitle>
        <SheetDescription>
          {DEPT_LABEL[dept]} · {entry.level} · reports to{" "}
          <code>{entry.reports_to ?? "Board"}</code>
        </SheetDescription>
      </SheetHeader>
      <div className="space-y-3 px-4 py-2 text-sm">
        <section>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</div>
          <div className="mt-1 font-medium">{STATUS_LABEL[entry.status]}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{STATUS_DESCRIPTION[entry.status]}</div>
        </section>
        {entry.status === "standby" && entry.waiting_on_connector && (
          <section className="rounded-md border border-sky-500/30 bg-sky-500/5 p-2 text-xs">
            <div className="font-semibold text-sky-700 dark:text-sky-400">Waiting on connector</div>
            <div className="mt-0.5 text-foreground">
              Plug <code>{entry.waiting_on_connector}</code> from your dashboard. This agent will activate
              automatically once configuration completes.
            </div>
          </section>
        )}
        {entry.status === "parked" && entry.unpark_condition && (
          <section className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs">
            <div className="font-semibold text-amber-700 dark:text-amber-400">Unpark condition</div>
            <div className="mt-0.5 text-foreground">{entry.unpark_condition}</div>
          </section>
        )}
        {entry.status === "disabled" && entry.reason && (
          <section className="rounded-md border border-rose-500/30 bg-rose-500/5 p-2 text-xs">
            <div className="font-semibold text-rose-700 dark:text-rose-400">Why disabled</div>
            <div className="mt-0.5 text-foreground">{entry.reason}</div>
          </section>
        )}
        {entry.skill_overlay && (
          <section>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Skill overlay
            </div>
            <div className="mt-1 text-xs">{entry.skill_overlay}</div>
          </section>
        )}
        <section className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Heartbeat
            </div>
            <div className="mt-0.5 font-mono">{entry.heartbeat}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Budget
            </div>
            <div className="mt-0.5 font-mono">${entry.budget_monthly_usd}/mo</div>
          </div>
        </section>
        {entry.spawnable && (
          <section className="rounded-md border border-purple-500/30 bg-purple-500/5 p-2 text-xs text-purple-900 dark:text-purple-100">
            <div className="font-semibold">Spawn-eligible (S+)</div>
            <div className="mt-0.5 text-purple-800/80 dark:text-purple-200/80">
              This agent can spawn specialist sub-agents under load. Operator approval required for each spawn.
            </div>
          </section>
        )}
      </div>
    </>
  );
}

function tooltipFor(id: string, entry: SwarmAgentEntry): string {
  const parts = [`${id} · ${entry.department} · ${entry.level}`, `heartbeat: ${entry.heartbeat}`, `budget: $${entry.budget_monthly_usd}/mo`];
  if (entry.status === "parked" && entry.unpark_condition) parts.push(`parked — unpark when: ${entry.unpark_condition}`);
  if (entry.status === "disabled" && entry.reason) parts.push(`disabled — ${entry.reason}`);
  if (entry.skill_overlay) parts.push(`overlay: ${entry.skill_overlay}`);
  if (entry.spawnable) parts.push("S+ spawn-eligible");
  parts.push("Click for full details");
  return parts.join("\n");
}

function Connector() {
  return <div className="mx-auto h-3 w-px bg-muted-foreground/30" aria-hidden />;
}

function HorizontalConnector() {
  return <div className="mx-auto h-px w-full max-w-[90%] bg-muted-foreground/20" aria-hidden />;
}

