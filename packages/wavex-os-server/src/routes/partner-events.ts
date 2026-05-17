/** Partner event emission + Telegram upsell alert.
 *
 *  POST /api/partner-signals/emit
 *    Validates the signal condition (app_count >= 2 for
 *    partner_activation_complete), writes a row to wavex_os.partner_events
 *    on Supabase, and fires a Telegram alert to the ops board channel.
 *
 *  Idempotency: callers may check whether the event already fired by
 *  querying GET /api/partner-signals/:partnerId — duplicates within the same
 *  event_type are not prevented at this layer; callers are responsible. */

import { z } from "zod";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { assertBoard, assertCompanyAccess, AuthError } from "@wavex-os/auth-shim";

// ─── schema ────────────────────────────────────────────────────────────────

const emitSchema = z.object({
  companyId: z.string().min(1),
  partner_id: z.string().min(1),
  partner_name: z.string().min(1),
  /** Number of apps the partner currently has registered. Used to gate
   *  partner_activation_complete (requires >= 2). */
  app_count: z.number().int().min(0),
  /** Arbitrary context surfaced in the Telegram alert and stored in
   *  partner_events.context_json. */
  context_json: z.record(z.string(), z.unknown()).optional().default({}),
});

type EmitInput = z.infer<typeof emitSchema>;

// ─── Supabase write ────────────────────────────────────────────────────────

interface PartnerEventRow {
  partner_id: string;
  event_type: string;
  fired_at: string;
  context_json: Record<string, unknown>;
}

async function writePartnerEvent(row: PartnerEventRow): Promise<{ id: string } | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn("[partner-events] Supabase not configured — event not persisted");
    return null;
  }
  // wavex_os schema is not exposed in PostgREST; use a public RPC wrapper instead.
  const res = await fetch(`${url}/rest/v1/rpc/wavex_os_emit_partner_event`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      p_partner_id: row.partner_id,
      p_event_type: row.event_type,
      p_fired_at: row.fired_at,
      p_context_json: row.context_json,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[partner-events] DB write failed: ${res.status} ${detail}`);
    return null;
  }
  const record = (await res.json().catch(() => null)) as { id: string } | null;
  return record ?? null;
}

// ─── Telegram alert ────────────────────────────────────────────────────────

function buildUpsellMessage(params: {
  partner_name: string;
  signal_type: string;
  partner_id: string;
  context_json: Record<string, unknown>;
}): string {
  const ctx = JSON.stringify(params.context_json);
  // Trim context to ≤ 200 chars so the alert stays readable.
  const ctxSummary = ctx.length > 200 ? `${ctx.slice(0, 197)}…` : ctx;
  return [
    `[UPSELL] ${params.partner_name} — ${params.signal_type} fired`,
    `Partner ID: ${params.partner_id}`,
    `Context: ${ctxSummary}`,
  ].join("\n");
}

async function sendUpsellAlert(params: {
  partner_name: string;
  signal_type: string;
  partner_id: string;
  context_json: Record<string, unknown>;
}): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN ?? process.env.WAVEX_OPS_TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID ?? process.env.WAVEX_OPS_TELEGRAM_CHAT_ID;
  if (!token || !chat) {
    console.warn("[partner-events] Telegram credentials not set — alert skipped");
    return;
  }
  const text = buildUpsellMessage(params);
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10_000);
    const res = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[partner-events] Telegram alert failed: ${res.status} ${detail}`);
    }
  } catch (e) {
    console.error(`[partner-events] Telegram alert error: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ─── route ─────────────────────────────────────────────────────────────────

function authReq(req: FastifyRequest) {
  return { method: req.method, headers: req.headers as Record<string, string> };
}

export function registerPartnerEventsRoutes(app: FastifyInstance): void {
  /** Emit a partner lifecycle event.
   *
   *  For event_type = partner_activation_complete the caller must supply
   *  app_count >= 2; requests below the threshold are rejected with 422.
   *
   *  Always best-effort: if Supabase or Telegram are unreachable the request
   *  still returns 200 with { ok: true, persisted: false } so the caller
   *  can log and retry independently. */
  app.post("/api/partner-signals/emit", async (req: FastifyRequest, reply: FastifyReply) => {
    const ar = authReq(req);
    try { assertBoard(ar); } catch (e) {
      if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
      throw e;
    }

    const parsed = emitSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: "validation failed", issues: parsed.error.issues });
    }
    const data = parsed.data as EmitInput;
    assertCompanyAccess(ar, data.companyId);

    const { partner_id, partner_name, app_count, context_json } = data;

    // Gate: partner_activation_complete requires app_count >= 2.
    if (app_count < 2) {
      return reply.status(422).send({
        ok: false,
        error: "partner_activation_complete requires app_count >= 2",
        app_count,
      });
    }

    const event_type = "partner_activation_complete";
    const fired_at = new Date().toISOString();
    const fullContext: Record<string, unknown> = { ...(context_json as Record<string, unknown>), app_count };

    const [record] = await Promise.all([
      writePartnerEvent({ partner_id, event_type, fired_at, context_json: fullContext }),
      sendUpsellAlert({
        partner_name,
        signal_type: event_type,
        partner_id,
        context_json: fullContext,
      }),
    ]);

    return {
      ok: true,
      event_type,
      fired_at,
      persisted: record !== null,
      event_id: record?.id ?? null,
    };
  });

  /** Read back partner events for a given partner_id (useful for dedup
   *  checks before emitting). */
  app.get("/api/partner-signals/:partnerId", async (req: FastifyRequest<{ Params: { partnerId: string } }>, reply: FastifyReply) => {
    const ar = authReq(req);
    try { assertBoard(ar); } catch (e) {
      if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
      throw e;
    }

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return reply.status(503).send({ ok: false, error: "Supabase not configured" });
    }

    const { partnerId } = req.params;
    // wavex_os schema is not exposed in PostgREST; use a public RPC wrapper.
    const res = await fetch(`${url}/rest/v1/rpc/wavex_os_get_partner_events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ p_partner_id: partnerId }),
    });
    if (!res.ok) {
      return reply.status(502).send({ ok: false, error: `Supabase ${res.status}` });
    }
    const rows = (await res.json().catch(() => [])) as unknown[];
    return { ok: true, events: rows };
  });
}
