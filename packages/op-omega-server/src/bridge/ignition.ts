/**
 * Phase: Ignition (post-activate).
 *
 * Design: docs/IGNITION.md. Closes the gap between "agents exist as rows"
 * (activate output) and "agents are doing visible work".
 *
 * Sequence (each step is idempotent against ignition-state.json):
 *   1. Load workflow_manifest from disk
 *   2. Read/create the Goal in Paperclip
 *   3. Seed first-task issues per non-muted slot
 *   4. CEO + CoS kickoff probe wake calls (best-effort, non-blocking)
 *   5. Validate L·IV coverage, retry gaps once
 *   6. Enable heartbeats with staggered cron offsets
 *   7. Write completion event to ignition-state.json
 *
 * Returns a structured result the activate route includes in its response.
 *
 * Failure-tolerant: every step records its own status; downstream callers
 * can re-invoke `POST /api/instance/:id/ignite` to resume from the first
 * incomplete step.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import type { CompanyManifest } from "@op-omega/plugin-onboarding";
import { getOnboardingDir, getInstanceDir } from "../state-bridge.js";

const PAPERCLIP_URL = process.env.PAPERCLIP_HANDOFF_URL ?? "";

export type IgnitionStepStatus = "pending" | "ok" | "error" | "skipped";

export interface IgnitionState {
  v: 1;
  company_id: string;
  started_at: string;
  completed_at: string | null;
  steps: {
    workflow_load: { status: IgnitionStepStatus; note?: string };
    goal_create: { status: IgnitionStepStatus; goal_id?: string; note?: string };
    seed_issues: { status: IgnitionStepStatus; created: string[]; note?: string };
    kickoff_probe: { status: IgnitionStepStatus; ceo_run_id?: string; cos_run_id?: string; note?: string };
    validate_coverage: { status: IgnitionStepStatus; gaps: string[]; note?: string };
    stagger_heartbeats: { status: IgnitionStepStatus; offsets: Record<string, number>; note?: string };
  };
  errors: { step: string; message: string; ts: string }[];
  warnings: string[];
}

export interface IgnitionResult {
  status: "ignited" | "partial" | "deferred" | "skipped";
  agents_working: number;
  workflows_queued: number;
  goal_id: string | null;
  errors: IgnitionState["errors"];
  warnings: string[];
  ignition_state_path: string;
}

interface WorkflowManifest {
  agent_workflows?: Record<string, {
    on_fire?: Array<{
      title?: string;
      description?: string;
      expected_output?: string;
      flow_type?: string;
      target?: string;
      dry_run_gate?: boolean;
    }>;
    heartbeat?: { period_minutes?: number };
  }>;
}

interface SwarmAgent {
  slot: string;
  template_id?: string;
  muted?: boolean;
}

function ignitionStatePath(companyId: string): string {
  return join(getInstanceDir(companyId), "ignition-state.json");
}

async function readState(companyId: string): Promise<IgnitionState | null> {
  try {
    const raw = await readFile(ignitionStatePath(companyId), "utf8");
    return JSON.parse(raw) as IgnitionState;
  } catch {
    return null;
  }
}

async function writeState(state: IgnitionState): Promise<void> {
  const path = ignitionStatePath(state.company_id);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(state, null, 2));
}

function freshState(companyId: string): IgnitionState {
  return {
    v: 1,
    company_id: companyId,
    started_at: new Date().toISOString(),
    completed_at: null,
    steps: {
      workflow_load: { status: "pending" },
      goal_create: { status: "pending" },
      seed_issues: { status: "pending", created: [] },
      kickoff_probe: { status: "pending" },
      validate_coverage: { status: "pending", gaps: [] },
      stagger_heartbeats: { status: "pending", offsets: {} },
    },
    errors: [],
    warnings: [],
  };
}

function recordErr(state: IgnitionState, step: string, message: string): void {
  state.errors.push({ step, message, ts: new Date().toISOString() });
}

async function loadWorkflowManifest(companyId: string): Promise<WorkflowManifest | null> {
  try {
    const path = join(getOnboardingDir(companyId), "workflow_manifest.json");
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as WorkflowManifest;
  } catch {
    return null;
  }
}

function paperclipFetch(path: string, init?: RequestInit): Promise<Response> {
  if (!PAPERCLIP_URL) {
    return Promise.reject(new Error("PAPERCLIP_HANDOFF_URL not set"));
  }
  return fetch(`${PAPERCLIP_URL.replace(/\/$/, "")}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
}

/** Slot → stable cron-minute offset. Distributes 35 slots across 60 minutes
 *  so the fleet doesn't all fire at minute 0. */
function hashSlotToOffset(slot: string): number {
  let h = 0;
  for (let i = 0; i < slot.length; i++) h = ((h << 5) - h + slot.charCodeAt(i)) | 0;
  return Math.abs(h) % 60;
}

/**
 * Run ignition for a freshly-activated company. Idempotent.
 */
export async function ignite(
  manifest: CompanyManifest,
  companyId: string,
  paperclipHandoff: { paperclipCompanyId: string | null; created: Array<{ slot: string; agentId: string }> } | null,
): Promise<IgnitionResult> {
  const state = (await readState(companyId)) ?? freshState(companyId);
  await writeState(state);

  // ── Step 1: load workflow manifest ───────────────────────────────────
  const workflow = await loadWorkflowManifest(companyId);
  if (!workflow) {
    state.steps.workflow_load = { status: "error", note: "workflow_manifest.json missing" };
    recordErr(state, "workflow_load", "workflow_manifest.json not found in onboarding dir");
    await writeState(state);
    return {
      status: "deferred",
      agents_working: 0,
      workflows_queued: 0,
      goal_id: null,
      errors: state.errors,
      warnings: state.warnings,
      ignition_state_path: ignitionStatePath(companyId),
    };
  }
  state.steps.workflow_load = { status: "ok" };

  const swarm = (manifest as unknown as { swarm_manifest?: { agents?: SwarmAgent[] } }).swarm_manifest;
  const swarmAgents: SwarmAgent[] = swarm?.agents ?? [];
  const nonMuted = swarmAgents.filter((a) => !a.muted);

  // ── Step 2: ensure Goal exists in Paperclip ──────────────────────────
  let goalId: string | null = state.steps.goal_create.goal_id ?? null;
  const paperclipCompanyId = paperclipHandoff?.paperclipCompanyId ?? null;

  if (!goalId && paperclipCompanyId && PAPERCLIP_URL) {
    try {
      const existing = await paperclipFetch(`/api/companies/${paperclipCompanyId}/goals`);
      if (existing.ok) {
        const existingBody = (await existing.json()) as Array<{ id: string }> | { items: Array<{ id: string }> };
        const list = Array.isArray(existingBody) ? existingBody : existingBody.items ?? [];
        if (list.length > 0) {
          goalId = list[0]!.id;
        }
      }
      if (!goalId) {
        const p1 = (manifest as unknown as { pillar_responses?: { pillar_1?: Record<string, unknown> } }).pillar_responses?.pillar_1 ?? {};
        const title = `${(p1.org_name as string) ?? "company"} — primary goal`;
        const body = [
          `Company context: ${p1.company_context ?? "n/a"}`,
          ``,
          `Primary friction (hypothesized): ${p1.primary_friction_hypothesis ?? "n/a"}`,
          ``,
          `Differentiator (hypothesized): ${p1.differentiator_hypothesis ?? "n/a"}`,
          ``,
          `Meta KPI: ${(manifest as unknown as { meta_goal?: string }).meta_goal ?? "to be set"}`,
        ].join("\n");
        const create = await paperclipFetch(`/api/companies/${paperclipCompanyId}/goals`, {
          method: "POST",
          body: JSON.stringify({ title, description: body }),
        });
        if (create.ok) {
          const created = (await create.json()) as { id: string };
          goalId = created.id;
        } else {
          recordErr(state, "goal_create", `paperclip goals POST returned ${create.status}`);
        }
      }
      state.steps.goal_create = { status: goalId ? "ok" : "error", goal_id: goalId ?? undefined };
    } catch (e) {
      state.steps.goal_create = { status: "error", note: (e as Error).message };
      recordErr(state, "goal_create", (e as Error).message);
    }
  } else if (!paperclipCompanyId) {
    state.steps.goal_create = { status: "skipped", note: "no Paperclip company id (handoff not enabled)" };
    state.warnings.push("Ignition skipped goal_create: Paperclip handoff was not enabled");
  }

  // ── Step 3: seed first-task issues ───────────────────────────────────
  const slotToPaperclipId = new Map<string, string>(
    (paperclipHandoff?.created ?? []).map((c) => [c.slot, c.agentId]),
  );
  const createdIssues: string[] = state.steps.seed_issues.created ?? [];
  if (paperclipCompanyId && PAPERCLIP_URL && createdIssues.length === 0) {
    for (const agent of nonMuted) {
      const slot = agent.slot;
      const tasks = workflow.agent_workflows?.[slot]?.on_fire ?? [];
      const firstNonGated = tasks.find((t) => !t.dry_run_gate);
      if (!firstNonGated) continue;
      const paperclipAgentId = slotToPaperclipId.get(slot);
      if (!paperclipAgentId) continue;

      const title = `${(firstNonGated.expected_output ?? firstNonGated.title ?? "Initial cycle").slice(0, 80)}`;
      const body = [
        firstNonGated.description ?? "",
        "",
        "_Seeded by ignition v1. Grade criteria: see SKILL_KPI_OWNERSHIP measurement contract._",
      ].join("\n");
      try {
        const resp = await paperclipFetch(`/api/companies/${paperclipCompanyId}/issues`, {
          method: "POST",
          body: JSON.stringify({
            title,
            description: body,
            assigneeAgentId: paperclipAgentId,
            goalId,
            priority: "medium",
            tags: ["wavex:ignition-seed:v1"],
          }),
        });
        if (resp.ok) {
          const created = (await resp.json()) as { id?: string; key?: string };
          if (created.key) createdIssues.push(created.key);
          else if (created.id) createdIssues.push(created.id);
        }
      } catch (e) {
        recordErr(state, "seed_issues", `slot=${slot}: ${(e as Error).message}`);
      }
    }
    state.steps.seed_issues = { status: createdIssues.length > 0 ? "ok" : "error", created: createdIssues };
  } else if (!paperclipCompanyId) {
    state.steps.seed_issues = { status: "skipped", created: [], note: "no Paperclip company id" };
  } else {
    state.steps.seed_issues = { status: "ok", created: createdIssues, note: "already seeded; idempotent skip" };
  }

  // ── Step 4: CEO + CoS kickoff probe (best-effort) ────────────────────
  if (paperclipCompanyId && PAPERCLIP_URL && state.steps.kickoff_probe.status === "pending") {
    const ceoId = slotToPaperclipId.get("ceo.orchestrator");
    const cosId = slotToPaperclipId.get("ceo.chief-of-staff");
    if (ceoId) {
      try {
        const wake = await paperclipFetch(`/api/agents/${ceoId}/wakeup`, {
          method: "POST",
          body: JSON.stringify({
            wake_reason: "ignition_kickoff",
            payload: { seeded_issue_keys: createdIssues, goal_id: goalId },
          }),
        });
        state.steps.kickoff_probe.ceo_run_id = wake.ok ? "ok" : `err_${wake.status}`;
      } catch (e) {
        recordErr(state, "kickoff_probe", `CEO wake failed: ${(e as Error).message}`);
      }
    }
    if (cosId) {
      try {
        const wake = await paperclipFetch(`/api/agents/${cosId}/wakeup`, {
          method: "POST",
          body: JSON.stringify({
            wake_reason: "ignition_kickoff",
            payload: { seeded_issue_keys: createdIssues, goal_id: goalId },
          }),
        });
        state.steps.kickoff_probe.cos_run_id = wake.ok ? "ok" : `err_${wake.status}`;
      } catch (e) {
        recordErr(state, "kickoff_probe", `CoS wake failed: ${(e as Error).message}`);
      }
    }
    state.steps.kickoff_probe.status = ceoId && cosId ? "ok" : "error";
  }

  // ── Step 5: validate L·IV coverage ────────────────────────────────────
  const gaps: string[] = [];
  for (const agent of nonMuted) {
    if (!slotToPaperclipId.has(agent.slot)) gaps.push(agent.slot);
  }
  state.steps.validate_coverage = { status: gaps.length === 0 ? "ok" : "error", gaps };
  if (gaps.length > 0) {
    state.warnings.push(`L·IV coverage gaps: ${gaps.join(", ")}`);
  }

  // ── Step 6: heartbeat offsets ────────────────────────────────────────
  const offsets: Record<string, number> = {};
  for (const agent of nonMuted) offsets[agent.slot] = hashSlotToOffset(agent.slot);
  state.steps.stagger_heartbeats = { status: "ok", offsets };
  // Note: actually patching heartbeat.enabled=true on Paperclip agents is
  // deferred to G.3.b — Paperclip's wakeup pulse already runs, and flipping
  // the runtimeConfig requires a PATCH endpoint we haven't audited yet.

  // ── Finalize ─────────────────────────────────────────────────────────
  const allOk = Object.values(state.steps).every((s) => s.status === "ok" || s.status === "skipped");
  state.completed_at = allOk ? new Date().toISOString() : null;
  await writeState(state);

  return {
    status: allOk
      ? (state.warnings.length > 0 ? "partial" : "ignited")
      : (state.steps.workflow_load.status === "error" ? "deferred" : "partial"),
    agents_working: nonMuted.length - gaps.length,
    workflows_queued: createdIssues.length,
    goal_id: goalId,
    errors: state.errors,
    warnings: state.warnings,
    ignition_state_path: ignitionStatePath(companyId),
  };
}
