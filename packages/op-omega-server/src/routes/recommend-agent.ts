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
import { loadPillarResponses } from "@op-omega/plugin-onboarding";
import { assertBoard, assertCompanyAccess, AuthError } from "@wavex-os/auth-shim";

const bodySchema = z.object({
  companyId: z.string().min(1),
  parent_slot: z.string().min(1),
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
  operatorPrompt: string;
}): string {
  const { registry, pillar1Brief, industryHint, stage, salesMotion, parentSlot, operatorPrompt } = args;

  // Compact catalog: one row per template, just enough for T2 to discriminate.
  const catalogLines = registry.map((t) =>
    `${t.templateId} (${t.division} · tier ${t.tier} · ${t.role})`
  ).join("\n");

  return `You are recommending an AI agent template for an operator's swarm. The operator has described what role they need; pick the best 3-5 candidates from a registry of 165 templates.

COMPANY CONTEXT
Industry: ${industryHint || "(not yet enriched)"}
Stage: ${stage || "(unknown)"}
Sales motion: ${salesMotion || "(unknown)"}
Brief: ${pillar1Brief.slice(0, 400)}

PARENT SLOT
The new agent will report to: ${parentSlot}

OPERATOR REQUEST
"${operatorPrompt}"

CATALOG (one per line, format: templateId (division · tier · role))
${catalogLines}

TASK
Return JSON ONLY in this exact shape:
{
  "recommendations": [
    { "templateId": "<id from catalog>", "rationale": "<one short sentence why this fits the operator's request + the company context>", "score": 0.0-1.0 }
  ]
}

Rules:
- 3 to 5 recommendations, ordered best fit first
- ALL templateIds MUST exist in the catalog above
- Rationale: 1 short sentence, concrete, mentions both the request AND the company context
- Score: 1.0 = perfect match, 0.7+ = strong fit, 0.5-0.7 = plausible fit
- Do NOT invent templateIds. Do NOT explain outside the JSON.

Output ONLY the JSON object, no markdown, no commentary.`;
}

interface T2Recommendation {
  templateId: string;
  rationale: string;
  score: number;
}

function parseRecommendations(raw: string, validIds: Set<string>): T2Recommendation[] {
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
    out.push({ templateId: r.templateId, rationale: r.rationale.slice(0, 400), score: Math.round(score * 100) / 100 });
  }
  return out.slice(0, 5);
}

export function registerRecommendAgentRoute(app: FastifyInstance): void {
  app.post("/op-omega/onboarding/recommend-agent", async (req, reply) => {
    if (!gateBoard(req, reply)) return;
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ ok: false, error: "validation failed", issues: parsed.error.issues });
    assertCompanyAccess(authReq(req), parsed.data.companyId);

    const { companyId, parent_slot, prompt } = parsed.data;

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

    const fullPrompt = buildPrompt({
      registry,
      pillar1Brief: p1?.company_context ?? p1?.manual_context ?? "",
      industryHint: p1?.industry_hint ?? "",
      stage: p3?.stage ?? "",
      salesMotion: p4?.sales_motion ?? "",
      parentSlot: parent_slot,
      operatorPrompt: prompt,
    });

    let raw: string;
    try {
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
      raw = resp.output;
    } catch (e) {
      return reply.status(503).send({
        ok: false,
        error: `T2 recommend failed: ${e instanceof Error ? e.message : String(e)}`,
      });
    }

    const recommendations = parseRecommendations(raw, validIds);
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
