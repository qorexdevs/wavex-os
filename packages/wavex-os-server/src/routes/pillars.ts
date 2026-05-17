/** Pillar 1-5 routes. Thin Fastify handlers that:
 *  1. Validate the body via zod (matching upstream Express schemas)
 *  2. Apply auth gates via @wavex-os/auth-shim
 *  3. Delegate to the vendored plugin handler
 *  4. Persist the response via savePillarResponses + updatePillar
 *  5. Return JSON shaped to match upstream contract */

import { z } from "zod";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { spawn } from "node:child_process";
import { platform } from "node:os";
import {
  handlePillar1, handlePillar2, handlePillar3, handlePillar4, handlePillar5,
  loadPillarResponses, savePillarResponses, updatePillar,
  isOnboardingHaltError,
  emptyPillarResponses,
  isPillarResponsesComplete,
  nextIncompletePillar,
} from "@wavex-os/plugin-onboarding";
import { route as tierRoute } from "@wavex-os/plugin-tier-router";
import { assertBoard, assertCompanyAccess, AuthError } from "@wavex-os/auth-shim";
import { getInferenceMode } from "@wavex-os/inference-adapter";
import { withTokenAccounting, type PhaseKey } from "../lib/token-accounting.js";
import { BudgetExhaustedError } from "../lib/token-budget.js";

// QA P0-2: BYOC always-enrich for Pillar 1. The vendored handlePillar1
// short-circuits to regex heuristics when manual_context >= 40 chars
// (`enrichment_status: "manual_capture"`). The heuristic invents fields
// like `ideal_customer_profile: "enterprise ops teams"` which then leak
// into every downstream agent's CONTEXT.md. This helper detects the
// short-circuit and runs a follow-up BYOC claude call to refine.
const IS_WIN_P1 = platform() === "win32";
const PILLAR1_CLAUDE_TIMEOUT_MS = 25_000;

/** Spawn local claude with a bounded prompt, parse a single-line JSON
 *  envelope from stdout. Returns null on any failure (claude missing,
 *  not authed, parse fail, timeout). Caller falls back to the
 *  heuristic in that case. */
function runClaudeForPillar1Enrichment(prompt: string): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    const claudeBin = IS_WIN_P1 ? "claude.cmd" : "claude";
    const child = spawn(
      claudeBin,
      [
        "-p", prompt,
        "--output-format", "text",
        "--disallowedTools", "*",
        "--exclude-dynamic-system-prompt-sections",
      ],
      { shell: IS_WIN_P1 },
    );
    let stdout = "";
    child.stdout?.on("data", (d) => { stdout += d.toString(); });
    const timer = setTimeout(() => {
      try { child.kill("SIGTERM"); } catch { /* ignore */ }
      resolve(null);
    }, PILLAR1_CLAUDE_TIMEOUT_MS);
    child.on("error", () => { clearTimeout(timer); resolve(null); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) { resolve(null); return; }
      try {
        const cleaned = stdout.replace(/^```(?:json)?\s*|\s*```$/gm, "").trim();
        const parsed = JSON.parse(cleaned);
        if (parsed && typeof parsed === "object") {
          resolve(parsed as Record<string, unknown>);
        } else {
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    });
  });
}

/** Build the enrichment prompt. We pass the raw input + manual_context
 *  + the heuristic-derived starting point so claude can either confirm
 *  or correct the regex-output. */
function buildPillar1EnrichmentPrompt(opts: {
  orgName: string;
  rawInput: string;
  manualContext: string | undefined;
  heuristicGuess: {
    industry_hint?: string;
    business_model_hint?: string;
    ideal_customer_profile?: string;
    competitive_position?: string;
    primary_acquisition_channel?: string;
    product_maturity_signal?: string;
    has_product?: boolean;
    differentiator_hypothesis?: string;
    primary_friction_hypothesis?: string;
  };
}): string {
  const heuristic = JSON.stringify(opts.heuristicGuess, null, 2);
  const ctx = opts.manualContext ?? "";
  return `You are refining a customer's Pillar 1 onboarding capture. We already ran a regex-based heuristic to extract structured signals from the founder's free-text. Your job is to CORRECT and TIGHTEN the heuristic output using the actual context — the heuristic often invents plausible-sounding fields (e.g. "ideal_customer_profile: enterprise ops teams") that don't match the founder's actual description.

ORG NAME: ${opts.orgName}

RAW INPUT FROM FOUNDER:
${opts.rawInput}

FOUNDER'S DETAILED CONTEXT:
${ctx}

HEURISTIC OUTPUT (refine this):
${heuristic}

Return ONLY a single-line JSON object with the following keys, each derived from the founder's ACTUAL words (not invented):
{
  "industry_hint": "<short tag, lowercase_snake_case>",
  "business_model_hint": "<short tag, lowercase_snake_case>",
  "ideal_customer_profile": "<one short phrase describing who specifically uses this>",
  "competitive_position": "<emerging | challenger | leader>",
  "primary_acquisition_channel": "<lowercase_snake_case>",
  "product_maturity_signal": "<pre_alpha | alpha | beta | ga>",
  "has_product": <boolean>,
  "differentiator_hypothesis": "<one sentence, founder-authored phrasing if possible>",
  "primary_friction_hypothesis": "<one sentence naming the most plausible go-to-market friction>"
}

Hard rules:
- If the founder's context names a specific ICP (e.g. "mobile-app teams"), use that — never substitute generic categories like "enterprise ops teams".
- If they say "pre-revenue" or "no paying customers yet", set competitive_position to "emerging".
- If they describe a working product, has_product = true.
- For differentiator_hypothesis, paraphrase the founder's own framing — don't invent benefits they didn't claim.
- Do not output prose. JSON only. No backticks.`;
}

async function maybeEnrichPillar1WithBYOC(
  body: { org_name: string; raw_input: string; manual_context?: string },
  heuristicResult: Awaited<ReturnType<typeof handlePillar1>>,
): Promise<typeof heuristicResult | null> {
  // Only fire when the vendored handler took the manual_capture path.
  const result = heuristicResult as unknown as Record<string, unknown>;
  if (result.enrichment_status !== "manual_capture") return null;
  // Need enough context to do better than regex.
  if (!body.manual_context || body.manual_context.length < 40) return null;

  const prompt = buildPillar1EnrichmentPrompt({
    orgName: body.org_name,
    rawInput: body.raw_input,
    manualContext: body.manual_context,
    heuristicGuess: {
      industry_hint: result.industry_hint as string | undefined,
      business_model_hint: result.business_model_hint as string | undefined,
      ideal_customer_profile: result.ideal_customer_profile as string | undefined,
      competitive_position: result.competitive_position as string | undefined,
      primary_acquisition_channel: result.primary_acquisition_channel as string | undefined,
      product_maturity_signal: result.product_maturity_signal as string | undefined,
      has_product: result.has_product as boolean | undefined,
      differentiator_hypothesis: result.differentiator_hypothesis as string | undefined,
      primary_friction_hypothesis: result.primary_friction_hypothesis as string | undefined,
    },
  });

  const refined = await runClaudeForPillar1Enrichment(prompt);
  if (!refined) return null;

  // Merge the refined fields over the heuristic. Only overwrite keys
  // claude provided AND that look well-formed. Stamp `enrichment_status`
  // and `enriched_via` so the audit trail shows the BYOC pass ran.
  const merged = {
    ...result,
    industry_hint: typeof refined.industry_hint === "string" ? refined.industry_hint : result.industry_hint,
    business_model_hint: typeof refined.business_model_hint === "string" ? refined.business_model_hint : result.business_model_hint,
    ideal_customer_profile: typeof refined.ideal_customer_profile === "string" ? refined.ideal_customer_profile : result.ideal_customer_profile,
    competitive_position: typeof refined.competitive_position === "string" ? refined.competitive_position : result.competitive_position,
    primary_acquisition_channel: typeof refined.primary_acquisition_channel === "string" ? refined.primary_acquisition_channel : result.primary_acquisition_channel,
    product_maturity_signal: typeof refined.product_maturity_signal === "string" ? refined.product_maturity_signal : result.product_maturity_signal,
    has_product: typeof refined.has_product === "boolean" ? refined.has_product : result.has_product,
    differentiator_hypothesis: typeof refined.differentiator_hypothesis === "string" ? refined.differentiator_hypothesis : result.differentiator_hypothesis,
    primary_friction_hypothesis: typeof refined.primary_friction_hypothesis === "string" ? refined.primary_friction_hypothesis : result.primary_friction_hypothesis,
    enrichment_status: "byoc_refined",
    enriched_via: "claude_oauth" as const,
    enriched_at: new Date().toISOString(),
  };
  return merged as unknown as typeof heuristicResult;
}

const pillar1Schema = z.object({
  companyId: z.string().min(1),
  org_name: z.string().min(1).max(120),
  raw_input: z.string().min(1).max(2048),
  manual_context: z.string().min(40).max(2048).optional(),
});

/** Operator-edit overrides for pillar_1 fields after T2 enrichment.
 *  Used when the operator picks "Other — type your own" in the confirm
 *  view's industry/business_model dropdowns, or just disagrees with
 *  what T2 inferred. Patches the existing pillar_1 in place. */
const pillar1EditSchema = z.object({
  companyId: z.string().min(1),
  industry_hint: z.string().min(1).max(80).optional(),
  business_model_hint: z.string().min(1).max(80).optional(),
  has_product: z.boolean().optional(),
});

const pillar2Schema = z.object({
  companyId: z.string().min(1),
  claude_plan: z.enum(["max_20x", "max_5x", "api_only", "other"]),
  claude_plan_other_note: z.string().optional(),
});

const pillar3Schema = z.object({
  companyId: z.string().min(1),
  product_state: z.enum(["live_paying_customers", "built_not_selling", "prototype_mvp", "idea_only", "other"]),
  product_state_other: z.string().optional(),
  stage: z.string().min(1),
  stage_other: z.string().optional(),
});

const leadSourceEnum = z.enum([
  "inbound_ads_meta_google", "outbound_cold", "referral_word_of_mouth",
  "content_seo", "product_led_viral", "partnerships", "events", "none_yet", "other",
]);

const pillar4Schema = z.object({
  companyId: z.string().min(1),
  lead_sources: z.array(leadSourceEnum).min(1).max(3),
  lead_source_other: z.string().min(40).max(500).optional(),
  sales_motion: z.enum(["self_serve_plg", "assisted_demo", "high_touch_enterprise", "none_yet", "other"]),
  sales_motion_other: z.string().min(40).max(500).optional(),
  close_channel: z.enum(["mostly_phone_video", "mostly_email_text", "mixed", "other"]).optional(),
  close_channel_other: z.string().min(40).max(500).optional(),
});

const pillar5Schema = z.object({
  companyId: z.string().min(1),
  comm_channel: z.enum(["telegram", "slack", "sms", "email_only", "other"]),
  comm_channel_other: z.string().optional(),
  urgency_routing: z.enum(["all_to_one_channel", "digest_plus_urgent_phone", "other"]).optional(),
  urgency_routing_other: z.string().optional(),
  board_endpoint_config: z.record(z.string()).optional(),
});

function authReq(req: FastifyRequest) {
  return { method: req.method, headers: req.headers as Record<string, string> };
}

export function registerPillarRoutes(app: FastifyInstance): void {
  app.get("/wavex-os/onboarding/status", async (req, reply) => {
    const ar = authReq(req);
    try { assertBoard(ar); } catch (e) {
      if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
      throw e;
    }
    const { companyId } = (req.query ?? {}) as { companyId?: string };
    if (!companyId) return reply.status(400).send({ error: "companyId required" });
    assertCompanyAccess(ar, companyId);
    const responses = await loadPillarResponses(companyId).catch(() => emptyPillarResponses());
    return {
      ok: true,
      companyId,
      responses,
      complete: isPillarResponsesComplete(responses),
      next_pillar: nextIncompletePillar(responses),
    };
  });

  const pillarRoute = <S extends z.ZodTypeAny>(
    pillar: 1 | 2 | 3 | 4 | 5,
    schema: S,
    fn: (body: z.infer<S>) => Promise<unknown>,
  ) => {
    app.post(`/wavex-os/onboarding/pillar/${pillar}`, async (req, reply) => {
      const ar = authReq(req);
      try { assertBoard(ar); } catch (e) {
        if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
        throw e;
      }
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return reply.status(400).send({ error: "validation failed", issues: parsed.error.issues });
      const body = parsed.data as { companyId: string };
      assertCompanyAccess(ar, body.companyId);
      try {
        const result = await fn(parsed.data);
        return result;
      } catch (e) {
        if (isOnboardingHaltError(e)) {
          return reply.status(409).send({ ok: false, halt: e.toJSON() });
        }
        if (e instanceof BudgetExhaustedError) {
          return reply.status(429).send({
            ok: false, error: e.message,
            budget: { used: e.used, cap: e.cap, companyId: e.companyId },
          });
        }
        throw e;
      }
    });
  };

  pillarRoute(1, pillar1Schema, async (body) => {
    return withTokenAccounting(body.companyId, "pillar_1", async () => {
      const result = await handlePillar1({
        org_name: body.org_name,
        raw_input: body.raw_input,
        companyId: body.companyId,
        manual_context: body.manual_context,
      });
      // BYOC always-enrich (QA P0-2): the vendored handlePillar1 short-
      // circuits to regex heuristics when manual_context >= 40 chars
      // (`enrichment_status: "manual_capture"`). Heuristic-only outputs
      // include fabricated fields like `ideal_customer_profile:
      // "enterprise ops teams"` that leak into every downstream agent.
      // If we detect that path, fire a follow-up BYOC claude call to
      // refine the heuristic fields. Customer's claude, customer's bill.
      // Falls through silently if claude isn't available — better the
      // heuristic than no answer at all.
      const enriched = await maybeEnrichPillar1WithBYOC(body, result).catch(() => null);
      const final = enriched ?? result;
      await updatePillar(body.companyId, "pillar_1", final);
      return { ok: true, response: final };
    });
  });

  pillarRoute(2, pillar2Schema, async (body) => {
    return withTokenAccounting(body.companyId, "pillar_2", async () => {
      // Hosted mode: the customer has no local claude CLI — inference is
      // served by the operator's hub. The vendored handlePillar2 always
      // spawns the configured claudeBin (the hosted-shim) and checks its
      // exit code, which is brittle and surfaces as a "verify failed"
      // fix_hint to the user. Short-circuit here with a synthetic-pass
      // outcome so the wizard advances without a Claude-plan picker UI.
      if (getInferenceMode() === "hosted") {
        const response = {
          claude_code_verified: true,
          claude_plan: body.claude_plan,
          claude_plan_other_note: body.claude_plan_other_note,
          claude_version: "wavex-os hosted (Pool A)",
          inference_budget_profile: "conservative" as const,
          verified_at: new Date().toISOString(),
        };
        await updatePillar(body.companyId, "pillar_2", response);
        return { ok: true, response } as Awaited<ReturnType<typeof handlePillar2>>;
      }
      const outcome = await handlePillar2({
        claude_plan: body.claude_plan,
        claude_plan_other_note: body.claude_plan_other_note,
      });
      await updatePillar(body.companyId, "pillar_2", outcome.response);
      return outcome;
    });
  });

  pillarRoute(3, pillar3Schema, async (body) => {
    return withTokenAccounting(body.companyId, "pillar_3", async () => {
      const result = await handlePillar3({
        product_state: body.product_state,
        product_state_other: body.product_state_other,
        stage: body.stage,
        stage_other: body.stage_other,
      });
      await updatePillar(body.companyId, "pillar_3", result);
      return { ok: true, response: result };
    });
  });

  pillarRoute(4, pillar4Schema, async (body) => {
    return withTokenAccounting(body.companyId, "pillar_4", async () => {
      const result = await handlePillar4({
        lead_sources: body.lead_sources,
        lead_source_other: body.lead_source_other,
        sales_motion: body.sales_motion,
        sales_motion_other: body.sales_motion_other,
        close_channel: body.close_channel,
        close_channel_other: body.close_channel_other,
      });
      await updatePillar(body.companyId, "pillar_4", result);
      return { ok: true, response: result };
    });
  });

  pillarRoute(5, pillar5Schema, async (body) => {
    return withTokenAccounting(body.companyId, "pillar_5", async () => {
      const result = await handlePillar5({
        comm_channel: body.comm_channel,
        comm_channel_other: body.comm_channel_other,
        urgency_routing: body.urgency_routing,
        urgency_routing_other: body.urgency_routing_other,
        board_endpoint_config: body.board_endpoint_config,
      });
      await updatePillar(body.companyId, "pillar_5", result);
      return { ok: true, response: result };
    });
  });

  // ── Narrator endpoint ───────────────────────────────────────────────
  //
  // OnboardingShell's chat thread used to contain hardcoded transition
  // sentences ("Got it. Reading your site…", "Where are you in the product
  // journey?", "How do leads come in?"). They felt programmatic because
  // they were the same for every customer regardless of context.
  //
  // This endpoint returns ONE tailored transition sentence grounded in
  // what we already know about the customer + which phase they're
  // entering. The shell calls it at each transition and falls back to
  // the hardcoded copy if the call fails or is slow.
  //
  // Cost-bounded: ~30-60 output tokens per call. The handful of
  // transition points across a full walk add maybe 200-300 tokens total
  // — trivial relative to the wizard's other T2 spend.
  const narrateSchema = z.object({
    companyId: z.string().min(1),
    from: z.string().max(40),
    to: z.string().max(40),
  });

  app.post("/wavex-os/onboarding/narrate", async (req, reply) => {
    const ar = authReq(req);
    try { assertBoard(ar); } catch (e) {
      if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
      throw e;
    }
    const parsed = narrateSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "validation failed" });
    const { companyId, from, to } = parsed.data;
    assertCompanyAccess(ar, companyId);

    const responses = await loadPillarResponses(companyId).catch(() => null);
    const ctx: string[] = [];
    const p1 = responses?.pillar_1 as
      | { org_name?: string; industry_hint?: string; business_model_hint?: string; company_context?: string }
      | undefined;
    if (p1?.org_name) ctx.push(`Company: ${p1.org_name}`);
    if (p1?.industry_hint) ctx.push(`Industry: ${p1.industry_hint}`);
    if (p1?.business_model_hint) ctx.push(`Business model: ${p1.business_model_hint}`);
    if (p1?.company_context) ctx.push(`Context: ${p1.company_context.slice(0, 300)}`);
    const p3 = responses?.pillar_3 as { product_state?: string; stage?: string } | undefined;
    if (p3?.stage) ctx.push(`Stage: ${p3.stage}`);
    const p4 = responses?.pillar_4 as { sales_motion?: string } | undefined;
    if (p4?.sales_motion) ctx.push(`Motion: ${p4.sales_motion}`);

    const prompt = `You are the narrator of a chat-first onboarding wizard. The customer is moving from one phase to the next. Write ONE short sentence (≤140 chars) that:
- Acknowledges what just happened with a sentence-specific reference to what they told us (e.g., "Got the 40-customer $50K MRR picture") rather than generic "Got it".
- Introduces what's next without re-explaining the wizard.

CUSTOMER CONTEXT:
${ctx.join("\n") || "(very little so far — only an org name)"}

PHASE TRANSITION: ${from} → ${to}

Output ONLY the sentence — no quotes, no markdown, no preamble.`;

    try {
      const out = await withTokenAccounting(companyId, "narrator" as PhaseKey, async () => {
        const resp = await tierRoute({
          agent_id: "onboarding.narrator",
          prompt,
          task_metadata: { creativity_required: true, customer_facing: true, reasoning_depth: "shallow", priority: "batch" },
          companyId,
          outputFormat: "text",
          timeout_ms: 20_000,
        });
        return resp.output.trim();
      });
      // Strip quotes if Claude wrapped its answer.
      const sentence = out.replace(/^["'`]|["'`]$/g, "").replace(/\n.*$/s, "").slice(0, 200);
      return reply.send({ ok: true, sentence });
    } catch (e) {
      if (e instanceof BudgetExhaustedError) {
        return reply.send({ ok: false, error: e.message });
      }
      return reply.send({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  });

  // ── Pillar suggestion endpoint ──────────────────────────────────────
  //
  // Why this exists: Pillar 3/4/5 cards on main currently render hardcoded
  // chip groups with no awareness of what the customer told us in Pillar 1.
  // That makes the wizard feel like a paper form. This endpoint lets the
  // inline cards ASK the hub for inference-grounded suggestions before
  // rendering, so the chips can be pre-highlighted ("Suggested: assisted
  // demo — your inferred industry is B2B SaaS at $50K MRR").
  //
  // Generic by design: each pillar has its own field list, and the route
  // builds a tailored prompt by pulling whatever pillar responses exist
  // so far. The Claude reply is a small JSON envelope { recommended: {...
  // pillar-specific fields...}, reasoning } — the client uses that to
  // mark chips as suggested. Customer is always free to pick anything.
  //
  // This is Pool A inference. The hub's daily $/cap + per-install caps
  // bound abuse; the per-pillar suggestion is one cheap call (<200 tokens
  // out) that materially de-programmatizes the wizard.
  const suggestSchema = z.object({ companyId: z.string().min(1) });

  app.post<{ Body: { companyId: string }; Params: { n: string } }>(
    "/wavex-os/onboarding/pillar/:n/suggest",
    async (req, reply) => {
      const ar = authReq(req);
      try { assertBoard(ar); } catch (e) {
        if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
        throw e;
      }
      const parsed = suggestSchema.safeParse(req.body);
      if (!parsed.success) return reply.status(400).send({ error: "validation failed" });
      const { companyId } = parsed.data;
      assertCompanyAccess(ar, companyId);
      const n = parseInt(req.params.n, 10);
      if (![3, 4, 5].includes(n)) {
        return reply.status(400).send({ error: "suggest is only supported for pillars 3, 4, 5" });
      }

      const responses = await loadPillarResponses(companyId).catch(() => null);
      if (!responses?.pillar_1) {
        return reply.status(409).send({ ok: false, error: "no pillar_1 context yet — submit pillar/1 first" });
      }

      // Compact summary of what we know already — feeds the system prompt.
      const p1 = responses.pillar_1 as {
        org_name?: string; company_context?: string;
        industry_hint?: string; business_model_hint?: string;
        inferred_signals?: Record<string, unknown>; has_product?: boolean;
      };
      const ctx: string[] = [];
      if (p1.org_name) ctx.push(`Company: ${p1.org_name}`);
      if (p1.industry_hint) ctx.push(`Industry: ${p1.industry_hint}`);
      if (p1.business_model_hint) ctx.push(`Business model: ${p1.business_model_hint}`);
      if (p1.company_context) ctx.push(`Context: ${p1.company_context.slice(0, 400)}`);
      if (p1.inferred_signals) {
        const keys = Object.entries(p1.inferred_signals).slice(0, 6)
          .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`);
        if (keys.length) ctx.push(`Signals: ${keys.join(", ")}`);
      }
      if (responses.pillar_3) {
        const p3 = responses.pillar_3 as { product_state?: string; stage?: string };
        ctx.push(`Pillar 3 picked: product_state=${p3.product_state}, stage=${p3.stage}`);
      }
      if (responses.pillar_4) {
        const p4 = responses.pillar_4 as { lead_sources?: string[]; sales_motion?: string };
        ctx.push(`Pillar 4 picked: lead_sources=${(p4.lead_sources ?? []).join(",")}, sales_motion=${p4.sales_motion}`);
      }

      // Per-pillar field schema + valid values. Kept here so we can give
      // Claude a constrained answer space and validate the output.
      const fieldSpecs: Record<number, { fields: string; valid: Record<string, string[]> }> = {
        3: {
          fields: "product_state, stage",
          valid: {
            product_state: ["live_paying_customers", "built_not_selling", "prototype_mvp", "idea_only"],
            stage: ["0_10k_mrr", "10k_100k_mrr", "100k_1m_mrr", "1m_10m_mrr", "10m_plus_mrr",
                    "pre_revenue_validating", "pre_revenue_building", "pre_revenue_idea"],
          },
        },
        4: {
          fields: "lead_sources (array, 1-3), sales_motion",
          valid: {
            lead_sources: ["inbound_ads_meta_google", "outbound_cold", "referral_word_of_mouth",
                           "content_seo", "product_led_viral", "partnerships", "events", "none_yet"],
            sales_motion: ["plg_self_serve", "assisted_demo", "high_touch_enterprise",
                           "services_to_saas", "marketplace", "transactional", "no_motion_yet"],
          },
        },
        5: {
          fields: "comm_channel, urgency_routing (optional)",
          valid: {
            comm_channel: ["telegram", "slack", "sms", "email_only", "other"],
            urgency_routing: ["telegram_or_slack_only", "phone_or_sms_only", "email_only", "no_routing"],
          },
        },
      };

      const spec = fieldSpecs[n];
      const prompt = `You are predicting the most likely answers a customer will pick on Pillar ${n} of an onboarding wizard, based on what they've already told us.

WHAT WE KNOW ABOUT THIS CUSTOMER:
${ctx.join("\n") || "(very little — only an org_name)"}

FIELDS TO PREDICT (Pillar ${n}): ${spec.fields}

VALID VALUES PER FIELD:
${Object.entries(spec.valid).map(([k, vs]) => `  ${k}: ${vs.join(" | ")}`).join("\n")}

Output ONLY a single-line JSON object with this shape:
{"recommended":{"<field>":"<value>", ...}, "reasoning":"<one-sentence why>"}

For array fields (e.g. lead_sources), put up to 3 ranked values in an array. For optional fields, omit them when uncertain. No backticks, no prose outside the JSON. Keep the reasoning under 140 chars.`;

      try {
        const out = await withTokenAccounting(companyId, `pillar_${n}_suggest` as PhaseKey, async () => {
          const resp = await tierRoute({
            agent_id: `onboarding.pillar-${n}-suggest`,
            prompt,
            task_metadata: {
              creativity_required: false, customer_facing: false,
              reasoning_depth: "shallow", priority: "batch",
            },
            companyId,
            outputFormat: "text",
            timeout_ms: 30_000,
          });
          return resp.output.trim();
        });

        // Parse the JSON envelope. Be forgiving — strip code fences if Claude
        // returns them, fall back to a null recommended on parse failure.
        interface SuggestEnvelope { recommended: Record<string, unknown>; reasoning?: string }
        let parsedOut: SuggestEnvelope | null = null;
        try {
          const cleaned = out.replace(/^```(?:json)?\s*|\s*```$/gm, "").trim();
          parsedOut = JSON.parse(cleaned) as SuggestEnvelope;
        } catch { /* fall through with null */ }

        return reply.send({
          ok: true,
          pillar: n,
          recommended: parsedOut?.recommended ?? {},
          reasoning: parsedOut?.reasoning ?? null,
          raw: parsedOut ? undefined : out.slice(0, 400),
        });
      } catch (e) {
        if (e instanceof BudgetExhaustedError) {
          return reply.status(429).send({ ok: false, error: e.message });
        }
        return reply.send({
          ok: false,
          pillar: n,
          recommended: {},
          reasoning: null,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    },
  );

  app.post("/wavex-os/onboarding/pillar/1/edit", async (req, reply) => {
    const ar = authReq(req);
    try { assertBoard(ar); } catch (e) {
      if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
      throw e;
    }
    const parsed = pillar1EditSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "validation failed", issues: parsed.error.issues });
    const { companyId, ...overrides } = parsed.data;
    assertCompanyAccess(ar, companyId);

    const responses = await loadPillarResponses(companyId).catch(() => null);
    if (!responses?.pillar_1) {
      return reply.status(409).send({ ok: false, error: "no pillar_1 to edit — submit pillar/1 first" });
    }
    const updated = { ...responses.pillar_1, ...overrides };
    await updatePillar(companyId, "pillar_1", updated);
    return { ok: true, response: updated };
  });
}
