/**
 * Device-JWT-gated paid endpoints.
 *
 * Replaces the never-deployed `os-inference` / `os-spend-intent` Supabase
 * Edge Functions. The operator's cloud-client (running on the customer's
 * Mac) holds a device JWT minted by the wavexcard.com console and signed
 * with WAVEX_DEVICE_JWT_SECRET. We verify that signature here, then
 * check the subscription is ACTIVE via the same Supabase RPC the Pool C
 * optimizer route uses, then forward to Anthropic.
 *
 * Endpoints:
 *   POST /v1/os/inference
 *     headers: Authorization: Bearer <device JWT>
 *     body:    { prompt, model?, max_output_tokens?, purpose? }
 *     returns: { ok: true, content, model, request_id, usage }
 *              | { ok: false, error, message }
 *
 *   POST /v1/os/spend-intent
 *     headers: Authorization: Bearer <device JWT>
 *              Idempotency-Key: <uuid>
 *     body:    { kind, amount_cents, recipient, reason, idempotency_key, ... }
 *     returns: { ok: false, error: "internal", message: "not yet wired" }
 *              Stub until the bridge/Stripe execution path lands; matches
 *              the cloud-client's discriminated-union contract so the
 *              caller-side error handling already in place still works.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { verifyDeviceJwt } from "@wavex-os/auth-shim";
import { callAnthropicOAuth, inferenceBackend } from "../lib/anthropic-oauth.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ACTIVE_STATUSES = new Set(["trialing", "active", "past_due"]);
const DEFAULT_MODEL = process.env.WAVEX_OS_INFERENCE_MODEL ?? "claude-sonnet-4-6";
const MAX_OUTPUT_TOKENS_HARD = 8000;

interface InferenceBody {
  prompt?: string;
  model?: string;
  max_output_tokens?: number;
  purpose?: string;
}

interface SpendIntentBody {
  kind?: string;
  amount_cents?: number;
  recipient?: string;
  reason?: string;
  source_issue_id?: string;
  idempotency_key?: string;
}

interface SubscriptionRow {
  id: string;
  status: string;
  tier: string;
}

/** Subscription lookup by device.user_id — the JWT carries `sub` (user_id),
 *  so we resolve via the wavex_os_subscription_lookup_by_user RPC which
 *  returns the most recent active/trialing/past_due row for that user_id. */
async function lookupActiveSubscription(
  subjectId: string,
): Promise<{ ok: true; row: SubscriptionRow } | { ok: false; status: number; error: string }> {
  if (!SUPABASE_URL || !SUPABASE_SVC) {
    return { ok: false, status: 503, error: "supabase_not_configured" };
  }
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/wavex_os_subscription_lookup_by_user`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SVC,
      Authorization: `Bearer ${SUPABASE_SVC}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_user_id: subjectId }),
  });
  if (!resp.ok) return { ok: false, status: resp.status, error: "subscription_lookup_failed" };
  const rows = (await resp.json()) as SubscriptionRow[];
  const row = rows[0];
  if (!row) return { ok: false, status: 404, error: "subscription_not_found" };
  if (!ACTIVE_STATUSES.has(row.status)) {
    return { ok: false, status: 402, error: "subscription_expired" };
  }
  return { ok: true, row };
}

function verifyBearer(
  req: FastifyRequest,
  reply: FastifyReply,
): { sub: string; device_id: string } | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    reply.code(401).send({ ok: false, error: "no_paired_device", message: "missing bearer" });
    return null;
  }
  const v = verifyDeviceJwt(auth.slice(7));
  if (!v.ok || !v.payload) {
    reply
      .code(401)
      .send({ ok: false, error: "no_paired_device", message: `device JWT invalid: ${v.reason ?? "unknown"}` });
    return null;
  }
  return { sub: v.payload.sub, device_id: v.payload.device_id };
}

export async function registerOsPaid(app: FastifyInstance): Promise<void> {
  // ── POST /v1/os/inference ────────────────────────────────────────────
  app.post<{ Body: InferenceBody }>(
    "/v1/os/inference",
    async (req, reply) => {
      const claims = verifyBearer(req, reply);
      if (!claims) return;

      const { prompt, model, max_output_tokens } = req.body ?? {};
      if (!prompt || typeof prompt !== "string") {
        return reply.code(400).send({ ok: false, error: "internal", message: "missing_prompt" });
      }

      // Subscription gating — skipped when WAVEX_OS_INFERENCE_SKIP_SUB=1
      // (local-loopback / smoke). In production this is the real gate.
      if (process.env.WAVEX_OS_INFERENCE_SKIP_SUB !== "1") {
        const sub = await lookupActiveSubscription(claims.sub);
        if (!sub.ok) {
          const code =
            sub.error === "subscription_expired" ? 402 :
            sub.error === "subscription_not_found" ? 404 : 503;
          return reply.code(code).send({
            ok: false,
            error: sub.error === "subscription_expired" ? "subscription_expired" : "internal",
            message: sub.error,
          });
        }
      }

      const chosenModel = model ?? DEFAULT_MODEL;
      const maxOut = Math.min(max_output_tokens ?? 4000, MAX_OUTPUT_TOKENS_HARD);

      try {
        // For now only the oauth backend is wired here — apikey path can
        // be added later if the operator ever wants to bill cloud-client
        // traffic through metered keys instead of Claude Max.
        if (inferenceBackend() !== "oauth") {
          return reply.code(503).send({
            ok: false,
            error: "internal",
            message: "WAVEX_INFERENCE_BACKEND must be oauth for /v1/os/inference (apikey path not wired)",
          });
        }
        const r = await callAnthropicOAuth({
          model: chosenModel,
          max_tokens: maxOut,
          messages: [{ role: "user", content: prompt }],
        });
        const content = r.content
          .map((c) => (c.type === "text" ? (c as { text: string }).text : ""))
          .join("");
        return reply.send({
          ok: true,
          content,
          model: chosenModel,
          request_id: r.id,
          usage: r.usage,
        });
      } catch (e) {
        const err = e as { status?: number; message?: string };
        return reply.code(err.status ?? 502).send({
          ok: false,
          error: "upstream_error",
          message: err.message ?? "anthropic_call_failed",
        });
      }
    },
  );

  // ── POST /v1/os/spend-intent ─────────────────────────────────────────
  // Stub. The cloud-client expects the discriminated-union contract; we
  // honor it with a clean error so callers don't need to special-case
  // "endpoint missing" vs "endpoint says no". Real bridge/Stripe execution
  // path lands in a later phase.
  app.post<{ Body: SpendIntentBody }>(
    "/v1/os/spend-intent",
    async (req, reply) => {
      const claims = verifyBearer(req, reply);
      if (!claims) return;
      const idempotencyKey = req.headers["idempotency-key"] ?? req.body?.idempotency_key;
      if (!idempotencyKey) {
        return reply.code(400).send({ ok: false, error: "internal", message: "missing_idempotency_key" });
      }
      return reply.code(503).send({
        ok: false,
        error: "internal",
        message: "spend-intent execution path not yet wired on hub",
      });
    },
  );
}
