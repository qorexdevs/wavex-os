/**
 * Pool A — onboarding T2 enrichment.
 *
 * Anonymous, rate-limited. Per V2_CAPTURE_C §4:
 *   - 20 T2 calls per install_id, lifetime (sliding 30-day window)
 *   - 5 per hour per install_id
 *   - 200 T2 calls / hour per IP /24
 *   - 3 install_ids per email per 30 days
 *   - $10/day global Pool A cap (hard kill switch)
 *   - 8K output-token cap per call
 *
 * Endpoints:
 *   POST /v1/onboarding/session
 *     body: { email, install_id? }
 *     returns: { token, install_id, expires_in }
 *
 *   POST /v1/onboarding/t2
 *     headers: Authorization: Bearer <session token>
 *     body: { prompt, max_output_tokens?, model? }
 *     returns: { content, model, usage }
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { incrementCounter, getCounter, setAdd } from "../lib/rate-limit.js";
import { issueSessionToken, verifySessionToken, randomInstallId } from "../lib/session-token.js";
import { callAnthropicOAuth, inferenceBackend } from "../lib/anthropic-oauth.js";

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const POOL_A_DAILY_CAP_CENTS = parseInt(process.env.POOL_A_DAILY_CAP_CENTS ?? "1000", 10);
const DEFAULT_MODEL = process.env.WAVEX_POOL_A_MODEL ?? "claude-sonnet-4-6";
const MAX_OUTPUT_TOKENS_HARD = 8000;

const BACKEND = inferenceBackend();
const anthropic = BACKEND === "apikey" && ANTHROPIC_KEY ? new Anthropic({ apiKey: ANTHROPIC_KEY }) : null;
const supabase = SUPABASE_URL && SUPABASE_SVC ? createClient(SUPABASE_URL, SUPABASE_SVC, { auth: { persistSession: false } }) : null;

interface SessionBody {
  email?: string;
  install_id?: string;
}

interface T2Body {
  prompt?: string;
  max_output_tokens?: number;
  model?: string;
}

function ip24(req: FastifyRequest): string {
  const ip = req.ip ?? "0.0.0.0";
  // IPv4 only — IPv6 gets the whole address as the key (good enough for V2)
  const m = ip.match(/^(\d+\.\d+\.\d+)\./);
  return m ? `${m[1]}.0/24` : ip;
}

/** Per-token cost calculation, blended. Pulled from V2_CAPTURE_C §6. */
function calcCostCents(model: string, usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number }): number {
  // Sonnet 4.6 rates: $3/M input, $15/M output, $0.30/M cache-read, $3.75/M cache-create
  if (model.includes("haiku")) {
    return Math.round(
      (usage.input_tokens * 0.001 + usage.output_tokens * 0.005) / 10
    ); // cents = $/100; very rough
  }
  // Sonnet default
  return Math.round(
    (usage.input_tokens * 0.0003 + usage.output_tokens * 0.0015 +
     (usage.cache_read_input_tokens ?? 0) * 0.00003 +
     (usage.cache_creation_input_tokens ?? 0) * 0.000375) * 100
  );
}

async function writeLedger(row: {
  pool: "A";
  install_id: string;
  email: string;
  ip_24: string;
  request_id: string | null;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  cost_cents: number;
  status: "ok" | "rate_limited" | "error" | "cap_hit";
  error_class?: string;
}): Promise<void> {
  if (!supabase) return;
  // Fire-and-forget; we don't block the response.
  void supabase
    .schema("wavex_os")
    .from("usage_ledger")
    .insert(row)
    .then((r: { error: unknown }) => {
      if (r.error) console.error("usage_ledger insert failed", r.error);
    });
}

async function poolABurnTodayCents(): Promise<number> {
  if (!supabase) return 0;
  const { data } = await supabase.rpc("wavex_os_pool_a_burn_today");
  return typeof data === "number" ? data : 0;
}

export async function registerOnboarding(app: FastifyInstance): Promise<void> {
  // ── POST /v1/onboarding/session ──────────────────────────────────────
  app.post<{ Body: SessionBody }>(
    "/v1/onboarding/session",
    async (req, reply: FastifyReply) => {
      const { email, install_id } = req.body ?? {};
      if (!email) return reply.code(400).send({ error: "missing_fields", required: ["email"] });
      // Basic email shape check
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return reply.code(400).send({ error: "invalid_email" });
      }

      const finalInstallId = install_id ?? randomInstallId();

      // Per-email throttle: cap DISTINCT install_ids per email per 30 days.
      // Onboarding inference is a customer-acquisition cost — we WANT customers
      // to try the wizard, get stuck, reset, retry. Counting every session-mint
      // (as the old incrementCounter did) penalized legitimate retries with the
      // same install_id. We now track distinct install_ids in a set, and the
      // ceiling is intentionally generous — 25 is well above any real customer
      // pattern (one Mac mini + a few VMs + multiple resets) and abuse vectors
      // are caught by the $/day global cap and per-install lifetime limit.
      const EMAIL_INSTALL_CEILING = 25;
      const emailKey = `pool-a:email-installs:${email.toLowerCase()}`;
      const { size: emailDistinctCount } = await setAdd(emailKey, finalInstallId, 30 * 24 * 3600);
      if (emailDistinctCount > EMAIL_INSTALL_CEILING) {
        return reply.code(429).send({
          error: "email_rate_limit",
          message: `More than ${EMAIL_INSTALL_CEILING} distinct install_ids per email per 30 days. If this is a mistake, email support.`,
        });
      }

      try {
        const token = issueSessionToken(finalInstallId, email);
        return reply.send({ token, install_id: finalInstallId, expires_in: 30 * 60 });
      } catch (e) {
        return reply.code(503).send({ error: "session_signing_unavailable", message: (e as Error).message });
      }
    },
  );

  // ── POST /v1/onboarding/t2 ───────────────────────────────────────────
  app.post<{ Body: T2Body }>(
    "/v1/onboarding/t2",
    async (req, reply) => {
      const auth = req.headers.authorization;
      if (!auth || !auth.startsWith("Bearer ")) {
        return reply.code(401).send({ error: "missing_bearer" });
      }
      const token = auth.slice(7);
      const session = verifySessionToken(token);
      if (!session) {
        return reply.code(401).send({ error: "invalid_or_expired_token" });
      }

      const { prompt, max_output_tokens, model } = req.body ?? {};
      if (!prompt || typeof prompt !== "string") {
        return reply.code(400).send({ error: "missing_prompt" });
      }
      if (prompt.length > 30000) {
        return reply.code(413).send({ error: "prompt_too_long", limit: 30000 });
      }

      // Rate limits
      const installLifetimeKey = `pool-a:install-lifetime:${session.install_id}`;
      const installHourKey = `pool-a:install-hour:${session.install_id}:${Math.floor(Date.now() / 3600000)}`;
      const ipKey = `pool-a:ip-hour:${ip24(req)}:${Math.floor(Date.now() / 3600000)}`;

      const lifetimeCount = await getCounter(installLifetimeKey);
      if (lifetimeCount >= 20) {
        await writeLedger({
          pool: "A", install_id: session.install_id, email: session.email, ip_24: ip24(req),
          request_id: null, model: model ?? DEFAULT_MODEL,
          prompt_tokens: 0, completion_tokens: 0, cache_read_tokens: 0, cache_creation_tokens: 0,
          cost_cents: 0, status: "rate_limited", error_class: "install_lifetime",
        });
        return reply.code(429).send({ error: "install_lifetime_cap", limit: 20 });
      }
      const hourCount = await getCounter(installHourKey);
      if (hourCount >= 5) {
        return reply.code(429).send({ error: "install_hour_cap", limit: 5, retry_after_sec: 3600 });
      }
      const ipCount = await getCounter(ipKey);
      if (ipCount >= 200) {
        return reply.code(429).send({ error: "ip_hour_cap", limit: 200 });
      }

      // Daily $10 cap
      const burn = await poolABurnTodayCents();
      if (burn >= POOL_A_DAILY_CAP_CENTS) {
        await writeLedger({
          pool: "A", install_id: session.install_id, email: session.email, ip_24: ip24(req),
          request_id: null, model: model ?? DEFAULT_MODEL,
          prompt_tokens: 0, completion_tokens: 0, cache_read_tokens: 0, cache_creation_tokens: 0,
          cost_cents: 0, status: "cap_hit", error_class: "daily_cap",
        });
        return reply.code(503).send({
          error: "pool_a_daily_cap_hit",
          message: "Pool A has reached its daily cap. Wizard should fall back to T1 deterministic mode.",
          retry_after_sec: 3600,
        });
      }

      // Anthropic call — backend chosen at module load via WAVEX_INFERENCE_BACKEND
      if (BACKEND === "apikey" && !anthropic) {
        return reply.code(503).send({
          error: "anthropic_not_configured",
          message: "WAVEX_INFERENCE_BACKEND=apikey but ANTHROPIC_API_KEY not set.",
        });
      }

      // Counter increments BEFORE the call (so a stuck call still counts)
      await incrementCounter(installLifetimeKey, 30 * 24 * 3600);
      await incrementCounter(installHourKey, 3600);
      await incrementCounter(ipKey, 3600);

      const chosenModel = model ?? DEFAULT_MODEL;
      const maxOut = Math.min(max_output_tokens ?? 4000, MAX_OUTPUT_TOKENS_HARD);

      try {
        let respId: string;
        let content: string;
        let usage: {
          input_tokens: number;
          output_tokens: number;
          cache_read_input_tokens?: number;
          cache_creation_input_tokens?: number;
        };

        if (BACKEND === "oauth") {
          const r = await callAnthropicOAuth({
            model: chosenModel,
            max_tokens: maxOut,
            messages: [{ role: "user", content: prompt }],
          });
          respId = r.id;
          content = r.content.map((c) => (c.type === "text" ? (c as { text: string }).text : "")).join("");
          usage = r.usage;
        } else {
          // apikey path
          const r = await anthropic!.messages.create({
            model: chosenModel,
            max_tokens: maxOut,
            messages: [{ role: "user", content: prompt }],
          });
          respId = r.id;
          content = r.content.map((c) => (c.type === "text" ? c.text : "")).join("");
          usage = r.usage as typeof usage;
        }

        const cost = calcCostCents(chosenModel, {
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
          cache_read_input_tokens: usage.cache_read_input_tokens,
          cache_creation_input_tokens: usage.cache_creation_input_tokens,
        });

        await writeLedger({
          pool: "A", install_id: session.install_id, email: session.email, ip_24: ip24(req),
          request_id: respId, model: chosenModel,
          prompt_tokens: usage.input_tokens,
          completion_tokens: usage.output_tokens,
          cache_read_tokens: usage.cache_read_input_tokens ?? 0,
          cache_creation_tokens: usage.cache_creation_input_tokens ?? 0,
          cost_cents: BACKEND === "oauth" ? 0 : cost, // OAuth-Max is flat-rate, attribution-only
          status: "ok",
        });

        return reply.send({
          content,
          model: chosenModel,
          usage,
          request_id: respId,
          backend: BACKEND,
        });
      } catch (e) {
        const err = e as { status?: number; message?: string };
        await writeLedger({
          pool: "A", install_id: session.install_id, email: session.email, ip_24: ip24(req),
          request_id: null, model: chosenModel,
          prompt_tokens: 0, completion_tokens: 0, cache_read_tokens: 0, cache_creation_tokens: 0,
          cost_cents: 0, status: "error", error_class: err.status ? `http_${err.status}` : "unknown",
        });
        return reply.code(err.status ?? 502).send({
          error: "anthropic_call_failed",
          message: err.message ?? "unknown",
          status: err.status,
          backend: BACKEND,
        });
      }
    },
  );
}
