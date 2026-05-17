/** POST /op-omega/onboarding/pillar/:n/suggest-pool-b
 *
 *  Pool B variant of pillar-suggest. Instead of going through tier-router
 *  (which calls the operator's local OAuth via the Pool A hub), this route
 *  routes through @wavex-os/cloud-client.cloudInference() — the Supabase
 *  Realtime path that bills against the operator's Claude Max under the
 *  CUSTOMER's subscription.
 *
 *  This is the first real-consumer wiring of the Pool B path. The browser
 *  picks this endpoint when device-token.json is present + unexpired
 *  (validated by GET /api/inference-status). Otherwise it stays on the
 *  existing Pool A endpoint.
 *
 *  IMPORTANT: This builds the SAME context-aware prompt as the Pool A
 *  route in pillars.ts. If you change the Pool A prompt/field-spec, mirror
 *  the change here — they share semantics but ship through different
 *  inference paths (local tier-router vs Supabase Realtime). */

import { z } from "zod";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { cloudInference } from "@wavex-os/cloud-client";
import { loadPillarResponses } from "@op-omega/plugin-onboarding";
import { assertBoard, assertCompanyAccess, AuthError } from "@wavex-os/auth-shim";

const bodySchema = z.object({ companyId: z.string().min(1) });

function authReq(req: FastifyRequest) {
  return { method: req.method, headers: req.headers as Record<string, string> };
}

/** Mirrors fieldSpecs in pillars.ts. Keep in sync if either changes. */
const FIELD_SPECS: Record<number, { fields: string; valid: Record<string, string[]> }> = {
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

function buildPrompt(
  n: number,
  responses: Awaited<ReturnType<typeof loadPillarResponses>>,
): string {
  const p1 = (responses.pillar_1 ?? {}) as {
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
  const spec = FIELD_SPECS[n];
  return `You are predicting the most likely answers a customer will pick on Pillar ${n} of an onboarding wizard, based on what they've already told us.

WHAT WE KNOW ABOUT THIS CUSTOMER:
${ctx.join("\n") || "(very little — only an org_name)"}

FIELDS TO PREDICT (Pillar ${n}): ${spec.fields}

VALID VALUES PER FIELD:
${Object.entries(spec.valid).map(([k, vs]) => `  ${k}: ${vs.join(" | ")}`).join("\n")}

Output ONLY a single-line JSON object with this shape:
{"recommended":{"<field>":"<value>", ...}, "reasoning":"<one-sentence why>"}

For array fields (e.g. lead_sources), put up to 3 ranked values in an array. For optional fields, omit them when uncertain. No backticks, no prose outside the JSON. Keep the reasoning under 140 chars.`;
}

export function registerPillarSuggestPoolBRoute(app: FastifyInstance): void {
  app.post<{ Body: { companyId: string }; Params: { n: string } }>(
    "/op-omega/onboarding/pillar/:n/suggest-pool-b",
    async (req, reply) => {
      const ar = authReq(req);
      try { assertBoard(ar); } catch (e) {
        if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
        throw e;
      }
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) return reply.status(400).send({ error: "validation failed" });
      const { companyId } = parsed.data;
      assertCompanyAccess(ar, companyId);
      const n = parseInt(req.params.n, 10);
      if (![3, 4, 5].includes(n)) {
        return reply.status(400).send({ error: "suggest-pool-b only supports pillars 3, 4, 5" });
      }

      const responses = await loadPillarResponses(companyId).catch(() => null);
      if (!responses?.pillar_1) {
        return reply.status(409).send({ ok: false, error: "no pillar_1 context yet — submit pillar/1 first" });
      }

      const prompt = buildPrompt(n, responses);

      try {
        const r = await cloudInference({
          prompt,
          max_output_tokens: 220,
          purpose: `onboarding.pillar-${n}-suggest`,
        });
        if (!r.ok) {
          return reply.status(502).send({
            ok: false,
            error: r.error,
            message: r.message,
            mode: "pool_b" as const,
          });
        }
        interface SuggestEnvelope { recommended: Record<string, unknown>; reasoning?: string }
        let parsedOut: SuggestEnvelope | null = null;
        try {
          const cleaned = r.content.replace(/^```(?:json)?\s*|\s*```$/gm, "").trim();
          parsedOut = JSON.parse(cleaned) as SuggestEnvelope;
        } catch { /* fall through */ }
        return {
          ok: true,
          pillar: n,
          recommended: parsedOut?.recommended ?? {},
          reasoning: parsedOut?.reasoning ?? null,
          raw: parsedOut ? undefined : r.content.slice(0, 400),
          mode: "pool_b" as const,
        };
      } catch (e) {
        return reply.status(502).send({
          ok: false,
          error: e instanceof Error ? e.message : String(e),
          mode: "pool_b" as const,
        });
      }
    },
  );
}
