/** Phase generators (Connector / Swarm / Workflow) + finalize routes. */

import { z } from "zod";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  generateConnectorManifest,
  generateSwarmManifest,
  generateWorkflowManifest,
  loadConnectorManifest, loadSwarmManifest, loadPillarResponses,
  assembleCompanyManifest,
  computeManifestHash,
  isOnboardingHaltError,
  invokeMonteCarlo,
  type WorkflowManifest,
} from "@wavex-os/plugin-onboarding";
import { listConnections } from "@wavex-os/composio-shim";
import { assertBoard, assertCompanyAccess, AuthError } from "@wavex-os/auth-shim";
import { withTokenAccounting } from "../lib/token-accounting.js";
import { BudgetExhaustedError } from "../lib/token-budget.js";
import { injectKernelSlots } from "../bridge/kernel-slots.js";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import yaml from "js-yaml";
import { getOnboardingDir } from "../state-bridge.js";

/** Re-persist the swarm manifest after mutation. The vendored generator
 *  writes the file internally; this overrides with the kernel-injected
 *  version so subsequent disk reads (loadSwarmManifest, finalize-bridge)
 *  see the canonical shape. */
async function persistSwarmManifest(companyId: string, swarm: unknown): Promise<void> {
  const dir = getOnboardingDir(companyId);
  await writeFile(join(dir, "swarm_manifest.json"), JSON.stringify(swarm, null, 2), "utf8");
  await writeFile(join(dir, "swarm_manifest.yaml"), yaml.dump(swarm), "utf8");
}

/** Sub-fleet scope record. When the operator chooses a focused team (e.g.
 *  marketing + sales only), we persist their selected departments and the
 *  swarm-manifest route parks every chief + L·IV sub-agent that lives
 *  outside that set. CEO + CoS always remain active. */
interface ScopeRecord {
  /** Canonical departments to keep active. */
  departments: string[];
  /** Free-text divisions the operator entered (used for the parked-reason
   *  message). */
  custom_labels?: string[];
  mode: "full" | "focused";
  set_at: string;
}

async function readScope(companyId: string): Promise<ScopeRecord | null> {
  const { readFile } = await import("node:fs/promises");
  const path = join(getOnboardingDir(companyId), "scope.json");
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as ScopeRecord;
  } catch {
    return null;
  }
}

async function writeScope(companyId: string, scope: ScopeRecord): Promise<void> {
  const { mkdir } = await import("node:fs/promises");
  const dir = getOnboardingDir(companyId);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "scope.json"), JSON.stringify(scope, null, 2), "utf8");
}

/** Apply scope filter to a swarm manifest in-place. Non-scoped chiefs +
 *  their reports become `parked` with an unpark_condition the operator
 *  can flip from Mission Control. CEO + chief-of-staff are sacrosanct.
 *
 *  Custom-only fallback: when scope.mode === "focused" with no canonical
 *  departments selected (operator only typed custom labels like "Legal"
 *  or "HR"), we map the request to Operations — so they get COO + ops
 *  sub-agents active rather than a hollow CEO-only fleet. The custom
 *  labels stay persisted for future template provisioning. */
function applyScopeFilter(
  swarm: { agents: Record<string, { department?: string; status?: string; unpark_condition?: string | null; reason?: string | null; reports_to?: string | null }> },
  scope: ScopeRecord,
): { parked: number; mappedCustomToOps: boolean } {
  if (scope.mode === "full") return { parked: 0, mappedCustomToOps: false };

  const customOnly = scope.departments.length === 0 && (scope.custom_labels?.length ?? 0) > 0;
  const effectiveDepartments = customOnly ? ["ops"] : scope.departments;
  const allowed = new Set([...effectiveDepartments, "ceo"]); // CEO always

  const reasonSuffix = customOnly
    ? `custom-only scope mapped to Operations (custom labels: ${scope.custom_labels?.join(", ") ?? ""})`
    : `outside requested scope (${effectiveDepartments.join(", ") || "focused team"})`;

  let parked = 0;
  for (const [slot, a] of Object.entries(swarm.agents)) {
    if (slot === "ceo.orchestrator" || slot === "ceo.chief-of-staff") continue;
    if (a.department && !allowed.has(a.department)) {
      if (a.status === "active" || a.status === "standby") {
        a.status = "parked";
        a.unpark_condition = "operator_unpark_from_mission_control";
        a.reason = reasonSuffix;
        parked += 1;
      }
    }
  }
  return { parked, mappedCustomToOps: customOnly };
}

/** Load workflow_manifest.json if it exists AND was written within
 *  freshnessMs ago. Used by finalize to consume the chat-first shell's
 *  prefetched T2 workflow instead of regenerating deterministically. */
async function loadFreshWorkflowManifest(companyId: string, freshnessMs: number): Promise<WorkflowManifest | null> {
  const { readFile, stat } = await import("node:fs/promises");
  const path = join(getOnboardingDir(companyId), "workflow_manifest.json");
  try {
    const s = await stat(path);
    if (Date.now() - s.mtimeMs > freshnessMs) return null;
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as WorkflowManifest;
  } catch {
    return null;
  }
}

const generateConnectorSchema = z.object({
  companyId: z.string().min(1),
  skipInference: z.boolean().optional(),
});

const generateSwarmSchema = z.object({
  companyId: z.string().min(1),
  skipInference: z.boolean().optional(),
});

const generateWorkflowSchema = z.object({
  companyId: z.string().min(1),
  skipInference: z.boolean().optional(),
  bypassBudgetCheck: z.boolean().optional(),
});

const completeSchema = z.object({
  companyId: z.string().min(1),
  orgId: z.string().min(1).max(80).optional(),
  operatorHandle: z.string().max(120).optional(),
  skipInference: z.boolean().optional(),
  mc: z.object({
    horizon_cycles: z.number().int().positive().max(120).optional(),
    n_runs: z.number().int().positive().max(100).optional(),
    seed: z.number().int().optional(),
  }).optional(),
});

function authReq(req: FastifyRequest) {
  return { method: req.method, headers: req.headers as Record<string, string> };
}

function bodyError(reply: FastifyReply, e: unknown) {
  if (isOnboardingHaltError(e)) {
    return reply.status(409).send({ ok: false, halt: e.toJSON() });
  }
  if (e instanceof BudgetExhaustedError) {
    return reply.status(429).send({
      ok: false, error: e.message,
      budget: { used: e.used, cap: e.cap, companyId: e.companyId },
    });
  }
  // Previously re-threw unknown errors → Fastify default handler emitted a
  // generic { error: "internal" } 500 with no usable detail. Customer saw
  // "Couldn't generate ... HTTP 500" with no path forward. Now return the
  // underlying message + class so the chat can render an inference-grounded
  // recovery suggestion (e.g. "Looks like the hub timed out — retry?").
  reply.log.error({ err: e }, "phase route failed");
  const message = e instanceof Error ? e.message : String(e);
  return reply.status(500).send({
    ok: false,
    error: message,
    error_class: e instanceof Error ? e.constructor.name : "Unknown",
    retryable: /timeout|fetch|network|ECONN|503|429/i.test(message),
  });
}

function gateBoard(req: FastifyRequest, reply: FastifyReply): boolean {
  const ar = authReq(req);
  try { assertBoard(ar); return true; }
  catch (e) {
    if (e instanceof AuthError) { reply.status(e.statusCode).send({ error: e.message }); return false; }
    throw e;
  }
}

export function registerPhaseRoutes(app: FastifyInstance): void {
  app.get("/wavex-os/onboarding/connector-recommendations", async (req, reply) => {
    if (!gateBoard(req, reply)) return;
    const { companyId } = (req.query ?? {}) as { companyId?: string };
    if (!companyId) return reply.status(400).send({ error: "companyId required" });
    assertCompanyAccess(authReq(req), companyId);
    const responses = await loadPillarResponses(companyId).catch(() => null);
    if (!responses) return reply.status(404).send({ error: "no pillar responses yet" });
    const live = await listConnections(companyId);
    try {
      const result = await generateConnectorManifest({
        companyId, responses, skipInference: true, liveConnections: live,
      });
      return { ok: true, manifest: result.manifest, source: result.source, warnings: result.warnings };
    } catch (e) {
      return bodyError(reply, e);
    }
  });

  // GET load endpoints — return the existing manifest from disk if present.
  // Lets the wizard hydrate phase pages on back-navigation without re-running
  // T2 (which costs 60-180s + tokens). UI policy: try GET first; only POST
  // (generate) if no manifest exists. Operator can force a fresh run via the
  // existing "↻ Re-refine with T2" button on each phase page.
  app.get("/wavex-os/onboarding/connector-manifest", async (req, reply) => {
    if (!gateBoard(req, reply)) return;
    const { companyId } = (req.query ?? {}) as { companyId?: string };
    if (!companyId) return reply.status(400).send({ error: "companyId required" });
    assertCompanyAccess(authReq(req), companyId);
    const manifest = await loadConnectorManifest(companyId).catch(() => null);
    if (!manifest) return { ok: true, exists: false, manifest: null };
    return { ok: true, exists: true, manifest, source: "loaded" as const };
  });

  app.get("/wavex-os/onboarding/swarm-manifest", async (req, reply) => {
    if (!gateBoard(req, reply)) return;
    const { companyId } = (req.query ?? {}) as { companyId?: string };
    if (!companyId) return reply.status(400).send({ error: "companyId required" });
    assertCompanyAccess(authReq(req), companyId);
    const manifest = await loadSwarmManifest(companyId).catch(() => null);
    if (!manifest) return { ok: true, exists: false, manifest: null };
    return { ok: true, exists: true, manifest, source: "loaded" as const };
  });

  app.get("/wavex-os/onboarding/workflow-manifest", async (req, reply) => {
    if (!gateBoard(req, reply)) return;
    const { companyId } = (req.query ?? {}) as { companyId?: string };
    if (!companyId) return reply.status(400).send({ error: "companyId required" });
    assertCompanyAccess(authReq(req), companyId);
    // wavex-os doesn't export a loadWorkflowManifest; read the file directly.
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const { getOnboardingDir } = await import("../state-bridge.js");
    try {
      const path = join(getOnboardingDir(companyId), "workflow_manifest.json");
      const raw = await readFile(path, "utf8");
      const manifest = JSON.parse(raw) as WorkflowManifest;
      return { ok: true, exists: true, manifest, source: "loaded" as const };
    } catch {
      return { ok: true, exists: false, manifest: null };
    }
  });

  app.post("/wavex-os/onboarding/connector-manifest", async (req, reply) => {
    if (!gateBoard(req, reply)) return;
    const parsed = generateConnectorSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "validation failed", issues: parsed.error.issues });
    assertCompanyAccess(authReq(req), parsed.data.companyId);
    const responses = await loadPillarResponses(parsed.data.companyId).catch(() => null);
    if (!responses) return reply.status(404).send({ error: "no pillar responses" });
    const live = await listConnections(parsed.data.companyId);
    try {
      return await withTokenAccounting(parsed.data.companyId, "connector_manifest", async () => {
        const result = await generateConnectorManifest({
          companyId: parsed.data.companyId,
          responses,
          skipInference: parsed.data.skipInference,
          liveConnections: live,
        });
        return { ok: true, manifest: result.manifest, source: result.source, warnings: result.warnings };
      });
    } catch (e) {
      return bodyError(reply, e);
    }
  });

  // Persist sub-fleet scope. Body: { companyId, mode: "full"|"focused",
  // departments: string[], custom_labels?: string[] }. Read by the swarm-
  // manifest POST handler to park non-scoped chiefs.
  const scopeSchema = z.object({
    companyId: z.string().min(1),
    mode: z.enum(["full", "focused"]),
    departments: z.array(z.string()),
    custom_labels: z.array(z.string()).optional(),
  });
  app.post("/wavex-os/onboarding/scope", async (req, reply) => {
    if (!gateBoard(req, reply)) return;
    const parsed = scopeSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "validation failed", issues: parsed.error.issues });
    assertCompanyAccess(authReq(req), parsed.data.companyId);
    const scope: ScopeRecord = {
      mode: parsed.data.mode,
      departments: parsed.data.departments,
      custom_labels: parsed.data.custom_labels,
      set_at: new Date().toISOString(),
    };
    await writeScope(parsed.data.companyId, scope);
    return { ok: true, scope };
  });
  app.get("/wavex-os/onboarding/scope", async (req, reply) => {
    if (!gateBoard(req, reply)) return;
    const { companyId } = (req.query ?? {}) as { companyId?: string };
    if (!companyId) return reply.status(400).send({ error: "companyId required" });
    assertCompanyAccess(authReq(req), companyId);
    const scope = await readScope(companyId);
    return { ok: true, scope };
  });

  app.post("/wavex-os/onboarding/swarm-manifest", async (req, reply) => {
    if (!gateBoard(req, reply)) return;
    const parsed = generateSwarmSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "validation failed", issues: parsed.error.issues });
    assertCompanyAccess(authReq(req), parsed.data.companyId);
    const connector = await loadConnectorManifest(parsed.data.companyId).catch(() => null);
    if (!connector) return reply.status(409).send({ error: "connector manifest not generated" });
    const responses = await loadPillarResponses(parsed.data.companyId);
    try {
      return await withTokenAccounting(parsed.data.companyId, "swarm_manifest", async () => {
        const result = await generateSwarmManifest({
          companyId: parsed.data.companyId,
          responses,
          connectorManifest: connector,
          skipInference: parsed.data.skipInference,
        });
        // Inject kernel slots (Chief of Staff, etc.) so they appear in the
        // Phase 3 org chart AND get bridged to DB on activate. The vendored
        // generator persists swarm_manifest.{json,yaml} internally; we
        // re-write after mutation so the on-disk file matches.
        let mutated = injectKernelSlots(result.manifest);

        // Sub-fleet scope filter — if the operator chose a focused team
        // (marketing+sales only, etc.), park non-scoped chiefs + their
        // reports. CEO + chief-of-staff stay active regardless.
        const scope = await readScope(parsed.data.companyId);
        let parked = 0;
        let mappedCustomToOps = false;
        let unparkedForFull = 0;
        if (scope && scope.mode === "focused") {
          ({ parked, mappedCustomToOps } = applyScopeFilter(
            result.manifest as unknown as Parameters<typeof applyScopeFilter>[0],
            scope,
          ));
          if (parked > 0) mutated = true;
        } else if (!scope || scope.mode === "full") {
          // Full-org intent: the matrix selector parks agents the vendor
          // judges "not relevant for your stage", but the operator's
          // explicit choice was "give me the whole org." Promote every
          // parked agent to active so the count matches the action.
          // "disabled" stays as-is — vendor flagged those as structurally
          // not relevant, which is a stronger signal than stage-fit.
          const swarmAgents = (result.manifest as unknown as {
            agents: Record<string, { status: string; reason?: string | null; unpark_condition?: string | null }>;
          }).agents;
          for (const entry of Object.values(swarmAgents)) {
            if (entry.status === "parked") {
              entry.status = "active";
              // Clear vendor-attached parking fields so the entry is a
              // clean "active" record after the override.
              if ("unpark_condition" in entry) delete entry.unpark_condition;
              unparkedForFull += 1;
            }
          }
          if (unparkedForFull > 0) mutated = true;
        }

        if (mutated) {
          await persistSwarmManifest(parsed.data.companyId, result.manifest);
        }
        const warnings = [...result.warnings];
        if (mappedCustomToOps) {
          warnings.push(`scope=focused with only custom labels [${scope?.custom_labels?.join(", ") ?? ""}] — mapped to Operations (COO + sub-agents active). ${parked} non-ops agents parked.`);
        } else if (parked > 0) {
          warnings.push(`scope=focused: parked ${parked} agents outside [${scope?.departments.join(", ")}]`);
        } else if (unparkedForFull > 0) {
          warnings.push(`scope=full: promoted ${unparkedForFull} matrix-parked agents to active to match operator's full-org choice.`);
        }
        return { ok: true, manifest: result.manifest, source: result.source, warnings };
      });
    } catch (e) {
      return bodyError(reply, e);
    }
  });

  app.post("/wavex-os/onboarding/workflow-manifest", async (req, reply) => {
    if (!gateBoard(req, reply)) return;
    const parsed = generateWorkflowSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "validation failed", issues: parsed.error.issues });
    assertCompanyAccess(authReq(req), parsed.data.companyId);
    const connector = await loadConnectorManifest(parsed.data.companyId).catch(() => null);
    if (!connector) return reply.status(409).send({ error: "connector manifest not generated" });
    const swarm = await loadSwarmManifest(parsed.data.companyId).catch(() => null);
    if (!swarm) return reply.status(409).send({ error: "swarm manifest not generated" });
    const responses = await loadPillarResponses(parsed.data.companyId);
    try {
      return await withTokenAccounting(parsed.data.companyId, "workflow_manifest", async () => {
        const result = await generateWorkflowManifest({
          companyId: parsed.data.companyId,
          responses,
          connectorManifest: connector,
          swarmManifest: swarm,
          skipInference: parsed.data.skipInference,
          bypassBudgetCheck: parsed.data.bypassBudgetCheck,
        });
        return { ok: true, manifest: result.manifest, source: result.source, warnings: result.warnings };
      });
    } catch (e) {
      return bodyError(reply, e);
    }
  });

  // GET monte_carlo_report.json — used by the chat-first ImprintTheater
  // to drive the 5-strategy race animation. The report is written to disk
  // by finalize (see vendor/wavex-os/.../finalize/assemble.ts) so this is
  // a cheap file read, no T2 cost.
  app.get("/wavex-os/onboarding/mc-report", async (req, reply) => {
    if (!gateBoard(req, reply)) return;
    const { companyId } = (req.query ?? {}) as { companyId?: string };
    if (!companyId) return reply.status(400).send({ error: "companyId required" });
    assertCompanyAccess(authReq(req), companyId);
    const { readFile } = await import("node:fs/promises");
    try {
      const path = join(getOnboardingDir(companyId), "monte_carlo_report.json");
      const raw = await readFile(path, "utf8");
      return { ok: true, report: JSON.parse(raw) };
    } catch {
      return { ok: false, error: "monte_carlo_report.json not found — run finalize first" };
    }
  });

  app.post("/wavex-os/onboarding/finalize", async (req, reply) => {
    if (!gateBoard(req, reply)) return;
    const parsed = completeSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "validation failed", issues: parsed.error.issues });
    assertCompanyAccess(authReq(req), parsed.data.companyId);

    const responses = await loadPillarResponses(parsed.data.companyId);
    const connector = await loadConnectorManifest(parsed.data.companyId).catch(() => null);
    const swarm = await loadSwarmManifest(parsed.data.companyId).catch(() => null);
    if (!connector || !swarm) {
      return reply.status(409).send({ error: "connector and swarm manifests required before finalize" });
    }

    // Workflow manifest is required by assembleCompanyManifest. If the chat-
    // first shell prefetched a T2-enriched workflow during the Swarm Studio
    // interaction window, reuse it instead of running the deterministic
    // regen — saves the operator 1-3 min of waiting during the Imprint
    // Theater. Freshness window: 10 minutes. Stale or missing → fall through
    // to the existing deterministic regeneration path.
    let workflow: WorkflowManifest;
    try {
      const fresh = await loadFreshWorkflowManifest(parsed.data.companyId, 10 * 60 * 1000);
      if (fresh) {
        workflow = fresh;
      } else {
        const wf = await generateWorkflowManifest({
          companyId: parsed.data.companyId,
          responses, connectorManifest: connector, swarmManifest: swarm,
          skipInference: true, bypassBudgetCheck: true,
        });
        workflow = wf.manifest;
      }
    } catch (e) {
      return bodyError(reply, e);
    }

    try {
      return await withTokenAccounting(parsed.data.companyId, "finalize", async () => {
      const result = await assembleCompanyManifest({
        companyId: parsed.data.companyId,
        orgId: parsed.data.orgId ?? parsed.data.companyId,
        responses,
        connectorManifest: connector,
        swarmManifest: swarm,
        workflowManifest: workflow,
        skipInference: parsed.data.skipInference,
        mc: parsed.data.mc,
      });

      // Merge pre-finalize add-agent sidecar additions into the manifest
      // and re-persist. add-agent.ts wrote these to template_additions.json
      // because company.manifest.json didn't exist yet during Swarm Studio.
      // Without this merge they'd be lost when finalize runs.
      let manifestMutated = false;
      try {
        const { readFile: rf } = await import("node:fs/promises");
        const sidecarPath = join(getOnboardingDir(parsed.data.companyId), "template_additions.json");
        const sidecarRaw = await rf(sidecarPath, "utf8").catch(() => null);
        if (sidecarRaw) {
          const sidecar = JSON.parse(sidecarRaw) as { template_additions?: Array<unknown> };
          if (Array.isArray(sidecar.template_additions) && sidecar.template_additions.length > 0) {
            (result.manifest as { template_additions?: Array<unknown> }).template_additions =
              sidecar.template_additions;
            manifestMutated = true;
          }
        }
      } catch { /* sidecar merge is best-effort; finalize must not fail because of it */ }

      // Populate goal + signed_at so Mission Control's KPI scoreboard stops
      // saying "No baseline captured yet". The vendored assemble does not
      // set these because the upstream contract doesn't include a goal
      // shape — wavex-os layers them on top via stage-based baselines.
      try {
        const m = result.manifest as {
          finalized_at?: string;
          signed_at?: string;
          goal?: { kpiId: string; current: number; target: number; days: number };
          pillar_responses?: {
            pillar_1?: { has_product?: boolean };
            pillar_3?: { product_state?: string; stage?: string };
          };
        };
        // Mirror finalized_at as signed_at — same moment in v1. Full Ed25519
        // signing is T2.2 in PHASE_H_PLAN.md.
        if (!m.signed_at && m.finalized_at) {
          m.signed_at = m.finalized_at;
          manifestMutated = true;
        }
        // Compute a sensible goal from Pillar 3's stage. MRR is the
        // default kpiId — it's the first row in every kpi_registry today
        // and matches what KpiBoard renders as the headline. Numbers come
        // from STAGE_BASELINES in stage-baselines.ts (kept in sync here
        // because vendor/wavex-os/ is frozen and can't import from the UI).
        if (!m.goal) {
          const stage = m.pillar_responses?.pillar_3?.stage ?? "unknown";
          const productState = m.pillar_responses?.pillar_3?.product_state ?? "unknown";
          const isPreProduct = productState === "idea_only" || productState === "prototype_mvp";
          // [current, target] pairs in dollars; both halve-then-triple the
          // typical stage band so the "30% growth over 90d" framing reads
          // as ambitious-but-real to a customer at the median of their band.
          const goalsByStage: Record<string, { current: number; target: number }> = {
            less_than_10k_mrr:   { current: 5_000,     target: 15_000 },
            "0_10k_mrr":         { current: 5_000,     target: 15_000 },
            "10k_100k_mrr":      { current: 45_000,    target: 100_000 },
            "100k_1m_mrr":       { current: 400_000,   target: 1_000_000 },
            "1m_10m_mrr":        { current: 2_500_000, target: 5_000_000 },
            more_than_1m_mrr:    { current: 2_500_000, target: 5_000_000 },
            "10m_plus_mrr":      { current: 12_000_000, target: 24_000_000 },
          };
          const band = isPreProduct
            ? { current: 0, target: 5_000 }
            : goalsByStage[stage] ?? { current: 5_000, target: 15_000 };
          m.goal = {
            kpiId: "monthly_recurring_revenue",
            current: band.current,
            target: band.target,
            days: 90,
          };
          manifestMutated = true;
        }
      } catch { /* goal/signed_at injection is best-effort */ }

      // Persist mutations (sidecar additions OR goal/signed_at).
      if (manifestMutated) {
        try {
          const { writeFile: wf } = await import("node:fs/promises");
          const manifestPath = join(getOnboardingDir(parsed.data.companyId), "company.manifest.json");
          await wf(manifestPath, JSON.stringify(result.manifest, null, 2), "utf8");
        } catch { /* persistence is best-effort; response still carries the augmented manifest */ }
      }

      return {
        ok: true,
        manifest: result.manifest,
        sha256: computeManifestHash(result.manifest),
        source: result.source,
        warnings: result.warnings,
      };
      });
    } catch (e) {
      return bodyError(reply, e);
    }
  });
}
