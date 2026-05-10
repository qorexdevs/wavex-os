/** Pillar 5 test-send route: hits the Telegram bot API to verify the
 *  operator's bot_token + chat_id work BEFORE saving them to the vault.
 *
 *  Match upstream behavior: POST /op-omega/onboarding/pillar/5/test-send
 *  Body: { companyId, channel: "telegram"|..., config: { telegram_bot_token, telegram_chat_id } }
 *  Returns: { ok: boolean, detail: string } */

import { z } from "zod";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { assertBoard, assertCompanyAccess, AuthError } from "@wavex-os/auth-shim";

const testSendSchema = z.object({
  companyId: z.string().min(1),
  channel: z.enum(["telegram", "slack", "sms", "email_only"]),
  config: z.record(z.string()),
});

function authReq(req: FastifyRequest) {
  return { method: req.method, headers: req.headers as Record<string, string> };
}

async function sendTelegramTest(token: string, chatId: string): Promise<{ ok: boolean; detail: string }> {
  const url = `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`;
  const body = {
    chat_id: chatId,
    text: "✓ wavex-os test message — your Telegram board endpoint is live.\n\nIf you see this, the credentials are valid and your CEO agent will route urgent signals here.",
    disable_notification: true,
  };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10_000);
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const data = await r.json().catch(() => ({})) as { ok?: boolean; description?: string };
    if (!r.ok || data.ok === false) {
      return { ok: false, detail: data.description ?? `Telegram API ${r.status}` };
    }
    return { ok: true, detail: "Message delivered to Telegram." };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return { ok: false, detail: "Timed out reaching Telegram (10s)." };
    }
    return { ok: false, detail: e instanceof Error ? e.message : "Send failed." };
  }
}

export function registerPillar5TestSendRoute(app: FastifyInstance): void {
  app.post("/op-omega/onboarding/pillar/5/test-send", async (req: FastifyRequest, reply: FastifyReply) => {
    const ar = authReq(req);
    try { assertBoard(ar); } catch (e) {
      if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
      throw e;
    }
    const parsed = testSendSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ ok: false, detail: "validation failed", issues: parsed.error.issues });
    assertCompanyAccess(ar, parsed.data.companyId);

    if (parsed.data.channel === "telegram") {
      const token = parsed.data.config.telegram_bot_token;
      const chatId = parsed.data.config.telegram_chat_id;
      if (!token || !chatId) {
        return { ok: false, detail: "Need both telegram_bot_token and telegram_chat_id." };
      }
      return sendTelegramTest(token, chatId);
    }

    return { ok: false, detail: `Test send not implemented yet for channel "${parsed.data.channel}".` };
  });
}
