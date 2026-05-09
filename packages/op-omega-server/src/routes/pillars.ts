/** Pillar 1-5 routes. Thin Fastify handlers that:
 *  1. Validate the body via zod (matching upstream Express schemas)
 *  2. Apply auth gates via @wavex-os/auth-shim
 *  3. Delegate to the vendored plugin handler
 *  4. Persist the response via savePillarResponses + updatePillar
 *  5. Return JSON shaped to match upstream contract */

import { z } from "zod";
import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  handlePillar1, handlePillar2, handlePillar3, handlePillar4, handlePillar5,
  loadPillarResponses, savePillarResponses, updatePillar,
  isOnboardingHaltError,
  emptyPillarResponses,
  isPillarResponsesComplete,
  nextIncompletePillar,
} from "@op-omega/plugin-onboarding";
import { assertBoard, assertCompanyAccess, AuthError } from "@wavex-os/auth-shim";

const pillar1Schema = z.object({
  companyId: z.string().min(1),
  org_name: z.string().min(1).max(120),
  raw_input: z.string().min(1).max(2048),
  manual_context: z.string().min(40).max(2048).optional(),
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
  app.get("/op-omega/onboarding/status", async (req, reply) => {
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
    app.post(`/op-omega/onboarding/pillar/${pillar}`, async (req, reply) => {
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
        throw e;
      }
    });
  };

  pillarRoute(1, pillar1Schema, async (body) => {
    const result = await handlePillar1({
      org_name: body.org_name,
      raw_input: body.raw_input,
      companyId: body.companyId,
      manual_context: body.manual_context,
    });
    await updatePillar(body.companyId, "pillar_1", result);
    return { ok: true, response: result };
  });

  pillarRoute(2, pillar2Schema, async (body) => {
    const outcome = await handlePillar2({
      claude_plan: body.claude_plan,
      claude_plan_other_note: body.claude_plan_other_note,
    });
    await updatePillar(body.companyId, "pillar_2", outcome.response);
    return outcome;
  });

  pillarRoute(3, pillar3Schema, async (body) => {
    const result = await handlePillar3({
      product_state: body.product_state,
      product_state_other: body.product_state_other,
      stage: body.stage,
      stage_other: body.stage_other,
    });
    await updatePillar(body.companyId, "pillar_3", result);
    return { ok: true, response: result };
  });

  pillarRoute(4, pillar4Schema, async (body) => {
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

  pillarRoute(5, pillar5Schema, async (body) => {
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
}
