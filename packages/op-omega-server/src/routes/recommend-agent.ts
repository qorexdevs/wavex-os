/** POST /op-omega/onboarding/recommend-agent
 *
 *  Natural-language template recommendation. Operator types something like
 *  "we need someone to manage our paid social campaigns" — T2 reads the
 *  165-template registry plus the company's pillar context plus the parent
 *  slot context, returns top 3-5 ranked templates with rationale.
 *
 *  Body: { companyId, parent_slot, prompt }
 *  Returns: { ok, recommendations: [{ templateId, rationale, score }] }
 *
 *  Designed for non-technical operators who don't want to scroll 165 names.
 *  The recommendations preselect a candidate; operator still clicks Add. */

import { z } from "zod";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { route as tierRoute } from "@op-omega/plugin-tier-router";
import { withTokenAccounting } from "../lib/token-accounting.js";
import { loadPillarResponses } from "@op-omega/plugin-onboarding";
import { assertBoard, assertCompanyAccess, AuthError } from "@wavex-os/auth-shim";

const bodySchema = z.object({
  companyId: z.string().min(1),
  /** Operator's currently-selected parent — used as a fallback if T2 doesn't
   *  pick one, AND included in the prompt so T2 knows what's already chosen. */
  parent_slot: z.string().min(1),
  /** Optional list of all available parent slots so T2 can pick the right
   *  reporting line. Defaults to just the operator-selected parent_slot if
   *  not provided (back-compat — older clients still get back the same shape). */
  available_parents: z.array(z.object({
    slot: z.string(),
    role_hint: z.string().optional(),  // e.g. "marketing", "engineering"
  })).optional(),
  prompt: z.string().min(3).max(800),
});

interface RegistryTemplate {
  templateId: string;
  role: string;
  tier: number;
  division: string;
  defaultKpis?: string[];
  origin?: string;
}

function authReq(req: FastifyRequest) {
  return { method: req.method, headers: req.headers as Record<string, string> };
}

function gateBoard(req: FastifyRequest, reply: FastifyReply): boolean {
  const ar = authReq(req);
  try { assertBoard(ar); return true; }
  catch (e) {
    if (e instanceof AuthError) { reply.status(e.statusCode).send({ error: e.message }); return false; }
    throw e;
  }
}

async function loadRegistry(): Promise<RegistryTemplate[]> {
  // Resolve to repo root via state-bridge import to avoid cwd assumptions.
  const { fileURLToPath } = await import("node:url");
  const { dirname, resolve } = await import("node:path");
  const here = dirname(fileURLToPath(import.meta.url));
  // packages/op-omega-server/src/routes → walk up to repo root
  let dir = here;
  for (let i = 0; i < 10; i++) {
    const p = resolve(dir, "packages", "agent-templates", "_registry.json");
    try {
      const raw = await readFile(p, "utf8");
      const parsed = JSON.parse(raw) as { templates: RegistryTemplate[] };
      return parsed.templates;
    } catch { /* keep walking */ }
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return [];
}

function buildPrompt(args: {
  registry: RegistryTemplate[];
  pillar1Brief: string;
  industryHint: string;
  stage: string;
  salesMotion: string;
  parentSlot: string;
  availableParents: Array<{ slot: string; role_hint?: string }>;
  operatorPrompt: string;
}): string {
  const { registry, pillar1Brief, industryHint, stage, salesMotion, parentSlot, availableParents, operatorPrompt } = args;

  // Compact catalog: one row per template, just enough for T2 to discriminate.
  const catalogLines = registry.map((t) =>
    `${t.templateId} (${t.division} · tier ${t.tier} · ${t.role})`
  ).join("\n");

  // Available parents block — T2 picks reporting line per recommendation.
  const parentsBlock = availableParents.length > 0
    ? availableParents.map((p) => `${p.slot}${p.role_hint ? ` (${p.role_hint})` : ""}`).join("\n")
    : `${parentSlot} (only available parent)`;

  return `You are recommending an AI agent template for an operator's swarm. The operator has described what role they need; pick the best 3-5 candidates from a registry of 165 templates AND for each one, pick the most appropriate parent slot from the available reporting lines.

COMPANY CONTEXT
Industry: ${industryHint || "(not yet enriched)"}
Stage: ${stage || "(unknown)"}
Sales motion: ${salesMotion || "(unknown)"}
Brief: ${pillar1Brief.slice(0, 400)}

OPERATOR'S CURRENTLY-SELECTED PARENT
${parentSlot} (you can override this when a different parent fits the role better — e.g. a TikTok ad strategist should report to the CMO, not the CEO directly)

AVAILABLE PARENT SLOTS (one per line)
${parentsBlock}

OPERATOR REQUEST
"${operatorPrompt}"

CATALOG (one per line, format: templateId (division · tier · role))
${catalogLines}

TASK
Return JSON ONLY in this exact shape:
{
  "recommendations": [
    {
      "templateId": "<id from catalog>",
      "parent_slot": "<slot from AVAILABLE PARENT SLOTS>",
      "rationale": "<one short sentence covering: why this template fits the request, why this parent is the right reporting line, and why both fit the company context>",
      "score": 0.0-1.0
    }
  ]
}

Rules:
- 3 to 5 recommendations, ordered best fit first
- ALL templateIds MUST exist in the CATALOG above
- ALL parent_slot values MUST exist in AVAILABLE PARENT SLOTS above
- Map by domain: marketing roles report to CMO; engineering/build roles to CPO/CTO; sales to CRO; finance to CFO; data/analytics to CDO; ops/recovery/observability to COO; cross-functional or executive to CEO
- Score: 1.0 = perfect match, 0.7+ = strong fit, 0.5-0.7 = plausible fit
- Do NOT invent templateIds or parent slots. Do NOT explain outside the JSON.

Output ONLY the JSON object, no markdown, no commentary.`;
}

interface T2Recommendation {
  templateId: string;
  parent_slot: string;
  rationale: string;
  score: number;
}

function parseRecommendations(
  raw: string, validIds: Set<string>, validParents: Set<string>, fallbackParent: string,
): T2Recommendation[] {
  // Strip code-fence wrappers if present
  let trimmed = raw.trim();
  if (trimmed.startsWith("```")) {
    trimmed = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  }
  let parsed: unknown;
  try { parsed = JSON.parse(trimmed); } catch { return []; }
  if (!parsed || typeof parsed !== "object") return [];
  const arr = (parsed as { recommendations?: unknown }).recommendations;
  if (!Array.isArray(arr)) return [];
  const out: T2Recommendation[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const r = item as Partial<T2Recommendation>;
    if (typeof r.templateId !== "string" || !validIds.has(r.templateId)) continue;
    if (typeof r.rationale !== "string") continue;
    const score = typeof r.score === "number" ? Math.max(0, Math.min(1, r.score)) : 0.5;
    // Validate parent_slot. If T2 hallucinated, fall back to the operator-
    // selected parent so the recommendation is still usable.
    const parent_slot = (typeof r.parent_slot === "string" && validParents.has(r.parent_slot))
      ? r.parent_slot : fallbackParent;
    out.push({
      templateId: r.templateId,
      parent_slot,
      rationale: r.rationale.slice(0, 400),
      score: Math.round(score * 100) / 100,
    });
  }
  return out.slice(0, 5);
}

export function registerRecommendAgentRoute(app: FastifyInstance): void {
  app.post("/op-omega/onboarding/recommend-agent", async (req, reply) => {
    if (!gateBoard(req, reply)) return;
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ ok: false, error: "validation failed", issues: parsed.error.issues });
    assertCompanyAccess(authReq(req), parsed.data.companyId);

    const { companyId, parent_slot, prompt, available_parents } = parsed.data;

    // Load company context from pillar responses
    const responses = await loadPillarResponses(companyId).catch(() => null);
    const p1 = responses?.pillar_1 as { company_context?: string; manual_context?: string; industry_hint?: string } | undefined;
    const p3 = responses?.pillar_3 as { stage?: string } | undefined;
    const p4 = responses?.pillar_4 as { sales_motion?: string } | undefined;

    // Load registry
    const registry = await loadRegistry();
    if (registry.length === 0) {
      return reply.status(500).send({ ok: false, error: "agent template registry not found" });
    }
    const validIds = new Set(registry.map((t) => t.templateId));

    // Validate parent slots (the UI passes the canonical list; if absent,
    // synthesize a single-entry list from the operator-selected parent).
    const availableParents = available_parents && available_parents.length > 0
      ? available_parents
      : [{ slot: parent_slot }];
    const validParents = new Set(availableParents.map((p) => p.slot));

    const fullPrompt = buildPrompt({
      registry,
      pillar1Brief: p1?.company_context ?? p1?.manual_context ?? "",
      industryHint: p1?.industry_hint ?? "",
      stage: p3?.stage ?? "",
      salesMotion: p4?.sales_motion ?? "",
      parentSlot: parent_slot,
      availableParents,
      operatorPrompt: prompt,
    });

    let raw: string;
    try {
      raw = await withTokenAccounting(companyId, "recommend_agent", async () => {
        const resp = await tierRoute({
          agent_id: "onboarding.add-agent.recommend",
          prompt: fullPrompt,
          task_metadata: {
            creativity_required: false, customer_facing: false,
            reasoning_depth: "shallow", priority: "high",
          },
          companyId,
          outputFormat: "json",
          timeout_ms: 60_000,
        });
        return resp.output;
      });
    } catch (e) {
      return reply.status(503).send({
        ok: false,
        error: `T2 recommend failed: ${e instanceof Error ? e.message : String(e)}`,
      });
    }

    const recommendations = parseRecommendations(raw, validIds, validParents, parent_slot);
    if (recommendations.length === 0) {
      return reply.status(502).send({
        ok: false,
        error: "T2 returned no valid recommendations from the catalog. Try a more specific prompt.",
        raw_excerpt: raw.slice(0, 200),
      });
    }

    return { ok: true, recommendations };
  });
}

// Reuse the tempPathHelper avoid lint warnings for unused import
void join;
