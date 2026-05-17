/** Smoke-test completion event instrumentation (WAVAAAA-43).
 *
 *  POST /api/smoke-test/complete
 *    Records a smoke-test run (pass/fail/error) in
 *    wavex_os.product_activation_events, determines whether this is the first
 *    run for the company, and on first run:
 *      - writes activation_ts to wavex_os.users
 *      - fires a Telegram activation alert
 *    Always best-effort: Supabase/Telegram failures return { ok: true, persisted: false }.
 *
 *  GET /api/smoke-test/:companyId
 *    Returns all smoke_test_completed events for the company, ordered by
 *    occurred_at desc. */

import { z } from "zod";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { assertBoard, assertCompanyAccess, AuthError } from "@wavex-os/auth-shim";

// ─── schema ─────────────────────────────────────────────────────────────────

const completeSchema = z.object({
  company_id: z.string().min(1),
  /** Identifies the user within the company. Defaults to "system" when the
   *  call originates from a server-side process rather than an end user. */
  user_id: z.string().min(1).default("system"),
  status: z.enum(["pass", "fail", "error"]),
  context_json: z.record(z.string(), z.unknown()).optional().default({}),
});

type CompleteInput = z.infer<typeof completeSchema>;

// ─── Supabase helpers ────────────────────────────────────────────────────────

function sbHeaders(key: string, extra: Record<string, string> = {}): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "apikey": key,
    "Authorization": `Bearer ${key}`,
    ...extra,
  };
}

/** Returns the number of prior smoke_test_completed events for this company.
 *  Fails open (returns 0) on network error so a transient Supabase hiccup
 *  does not prevent the event from being recorded. */
async function countPriorRuns(url: string, key: string, company_id: string): Promise<number> {
  const qs = new URLSearchParams({
    company_id: `eq.${company_id}`,
    event_type: "eq.smoke_test_completed",
    select: "id",
  });
  const res = await fetch(
    `${url}/rest/v1/wavex_os.product_activation_events?${qs}`,
    { headers: { ...sbHeaders(key), "Prefer": "count=exact", "Range": "0-0" } },
  );
  if (!res.ok) return 0;
  // Content-Range: <first>-<last>/<total>
  const range = res.headers.get("content-range") ?? "";
  const total = parseInt(range.split("/")[1] ?? "0", 10);
  return isNaN(total) ? 0 : total;
}

async function writeActivationEvent(params: {
  url: string;
  key: string;
  company_id: string;
  user_id: string;
  status: string;
  is_first_run: boolean;
  context_json: Record<string, unknown>;
  occurred_at: string;
}): Promise<{ id: string } | null> {
  const payload = {
    company_id: params.company_id,
    user_id: params.user_id,
    event_type: "smoke_test_completed",
    occurred_at: params.occurred_at,
    payload: { ...params.context_json, status: params.status, is_first_run: params.is_first_run },
  };
  const res = await fetch(`${params.url}/rest/v1/wavex_os.product_activation_events`, {
    method: "POST",
    headers: sbHeaders(params.key, { "Prefer": "return=representation" }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[smoke-test-events] product_activation_events write failed: ${res.status} ${detail}`);
    return null;
  }
  const [record] = (await res.json().catch(() => [])) as Array<{ id: string }>;
  return record ?? null;
}

/** Upserts wavex_os.users on first smoke-test completion.
 *  Sets signup_ts = activation_ts = occurred_at.
 *  On conflict (company already exists) updates activation_ts + updated_at. */
async function writeUserActivation(
  url: string,
  key: string,
  company_id: string,
  activation_ts: string,
): Promise<void> {
  const res = await fetch(`${url}/rest/v1/wavex_os.users`, {
    method: "POST",
    headers: sbHeaders(key, { "Prefer": "return=minimal,resolution=merge-duplicates" }),
    body: JSON.stringify({
      company_id,
      signup_ts: activation_ts,
      activation_ts,
      updated_at: activation_ts,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[smoke-test-events] users activation_ts write failed: ${res.status} ${detail}`);
  }
}

// ─── Telegram alert ──────────────────────────────────────────────────────────

async function sendActivationAlert(
  company_id: string,
  status: string,
  context_json: Record<string, unknown>,
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN ?? process.env.WAVEX_OPS_TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID ?? process.env.WAVEX_OPS_TELEGRAM_CHAT_ID;
  if (!token || !chat) {
    console.warn("[smoke-test-events] Telegram credentials not set — alert skipped");
    return;
  }
  const ctx = JSON.stringify(context_json);
  const ctxSummary = ctx.length > 200 ? `${ctx.slice(0, 197)}…` : ctx;
  const text = [
    `[ACTIVATION] smoke_test_completed — first run`,
    `Company: ${company_id}`,
    `Status: ${status}`,
    `Context: ${ctxSummary}`,
  ].join("\n");
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10_000);
    const res = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chat, text }),
        signal: ctrl.signal,
      },
    );
    clearTimeout(t);
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[smoke-test-events] Telegram alert failed: ${res.status} ${detail}`);
    }
  } catch (e) {
    console.error(`[smoke-test-events] Telegram error: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ─── route ───────────────────────────────────────────────────────────────────

function authReq(req: FastifyRequest) {
  return { method: req.method, headers: req.headers as Record<string, string> };
}

export function registerSmokeTestEventsRoute(app: FastifyInstance): void {
  app.post("/api/smoke-test/complete", async (req: FastifyRequest, reply: FastifyReply) => {
    const ar = authReq(req);
    try { assertBoard(ar); } catch (e) {
      if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
      throw e;
    }

    const parsed = completeSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: "validation failed", issues: parsed.error.issues });
    }
    const data = parsed.data as CompleteInput;
    assertCompanyAccess(ar, data.company_id);

    const sbUrl = process.env.SUPABASE_URL;
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!sbUrl || !sbKey) {
      console.warn("[smoke-test-events] Supabase not configured — event not persisted");
      return { ok: true, is_first_run: null, activation_ts: null, persisted: false, event_id: null };
    }

    const { company_id, user_id, status, context_json } = data;
    const occurred_at = new Date().toISOString();

    const priorCount = await countPriorRuns(sbUrl, sbKey, company_id);
    const is_first_run = priorCount === 0;

    const [record] = await Promise.all([
      writeActivationEvent({ url: sbUrl, key: sbKey, company_id, user_id, status, is_first_run, context_json, occurred_at }),
      is_first_run
        ? writeUserActivation(sbUrl, sbKey, company_id, occurred_at)
        : Promise.resolve(),
      is_first_run
        ? sendActivationAlert(company_id, status, context_json)
        : Promise.resolve(),
    ]);

    return {
      ok: true,
      is_first_run,
      activation_ts: is_first_run ? occurred_at : null,
      persisted: record !== null,
      event_id: record?.id ?? null,
    };
  });

  app.get(
    "/api/smoke-test/:companyId",
    async (req: FastifyRequest<{ Params: { companyId: string } }>, reply: FastifyReply) => {
      const ar = authReq(req);
      try { assertBoard(ar); } catch (e) {
        if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
        throw e;
      }

      const sbUrl = process.env.SUPABASE_URL;
      const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!sbUrl || !sbKey) {
        return reply.status(503).send({ ok: false, error: "Supabase not configured" });
      }

      const { companyId } = req.params;
      const qs = new URLSearchParams({
        company_id: `eq.${companyId}`,
        event_type: "eq.smoke_test_completed",
        order: "occurred_at.desc",
      });
      const res = await fetch(
        `${sbUrl}/rest/v1/wavex_os.product_activation_events?${qs}`,
        { headers: sbHeaders(sbKey) },
      );
      if (!res.ok) {
        return reply.status(502).send({ ok: false, error: `Supabase ${res.status}` });
      }
      const rows = (await res.json().catch(() => [])) as unknown[];
      return { ok: true, runs: rows };
    },
  );
}
