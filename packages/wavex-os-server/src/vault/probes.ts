/** Per-connector test probes. Given the keys vaulted for a connector, hit
 *  the connector's API to verify the credentials actually work.
 *
 *  Each probe returns { ok: boolean, detail: string }. Probes have a 10s
 *  timeout and are intentionally minimal — read-only / cheap calls. */

import { readCredential } from "./service.js";

export interface ProbeResult { ok: boolean; detail: string; }

export type ProbeFn = (companyId: string) => Promise<ProbeResult>;

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<T>((_resolve, reject) => {
        t = setTimeout(() => reject(new Error(`${label} timed out (${ms}ms)`)), ms);
      }),
    ]);
  } finally {
    if (t) clearTimeout(t);
  }
}

const PROBE_TIMEOUT_MS = 10_000;

/** Supabase: GET <url>/rest/v1/?apikey=<key> — returns 200 + JSON if creds valid. */
async function probeSupabase(companyId: string): Promise<ProbeResult> {
  const url = await readCredential({ companyId, connectorId: "supabase", key: "url" });
  const anon = await readCredential({ companyId, connectorId: "supabase", key: "anon_key" });
  if (!url || !anon) return { ok: false, detail: "missing url or anon_key" };
  try {
    const r = await withTimeout(
      fetch(`${url.replace(/\/$/, "")}/rest/v1/`, {
        headers: { apikey: anon, Authorization: `Bearer ${anon}` },
      }),
      PROBE_TIMEOUT_MS, "supabase",
    );
    if (r.ok) return { ok: true, detail: `Supabase reachable (HTTP ${r.status})` };
    return { ok: false, detail: `Supabase returned HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

/** GitHub: GET https://api.github.com/user (PAT in Authorization header). */
async function probeGithub(companyId: string): Promise<ProbeResult> {
  const pat = await readCredential({ companyId, connectorId: "github", key: "pat" });
  if (!pat) return { ok: false, detail: "missing pat" };
  try {
    const r = await withTimeout(
      fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${pat}`, Accept: "application/vnd.github+json" },
      }),
      PROBE_TIMEOUT_MS, "github",
    );
    if (r.ok) {
      const u = await r.json() as { login?: string };
      return { ok: true, detail: `Authenticated as ${u.login ?? "?"}` };
    }
    return { ok: false, detail: `GitHub returned HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

/** Telegram: getMe via the bot token. */
async function probeTelegram(companyId: string): Promise<ProbeResult> {
  const token = await readCredential({ companyId, connectorId: "telegram", key: "telegram_bot_token" });
  if (!token) return { ok: false, detail: "missing telegram_bot_token" };
  try {
    const r = await withTimeout(
      fetch(`https://api.telegram.org/bot${token}/getMe`),
      PROBE_TIMEOUT_MS, "telegram",
    );
    const body = await r.json() as { ok?: boolean; result?: { username?: string }; description?: string };
    if (body.ok) return { ok: true, detail: `Bot @${body.result?.username ?? "?"} reachable` };
    return { ok: false, detail: body.description ?? `HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

/** Stripe: GET https://api.stripe.com/v1/account using restricted/secret key. */
async function probeStripe(companyId: string): Promise<ProbeResult> {
  const key = await readCredential({ companyId, connectorId: "stripe", key: "secret_key" });
  if (!key) return { ok: false, detail: "missing secret_key" };
  try {
    const r = await withTimeout(
      fetch("https://api.stripe.com/v1/account", { headers: { Authorization: `Bearer ${key}` } }),
      PROBE_TIMEOUT_MS, "stripe",
    );
    if (r.ok) {
      const a = await r.json() as { id?: string; country?: string };
      return { ok: true, detail: `Stripe account ${a.id ?? "?"} (${a.country ?? "?"})` };
    }
    const body = await r.text();
    return { ok: false, detail: `HTTP ${r.status} · ${body.slice(0, 120)}` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

/** Anthropic: GET https://api.anthropic.com/v1/messages with a tiny ping. */
async function probeAnthropic(companyId: string): Promise<ProbeResult> {
  const key = await readCredential({ companyId, connectorId: "anthropic", key: "api_key" });
  if (!key) return { ok: false, detail: "missing api_key" };
  try {
    const r = await withTimeout(
      fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5",
          max_tokens: 1,
          messages: [{ role: "user", content: "ping" }],
        }),
      }),
      PROBE_TIMEOUT_MS, "anthropic",
    );
    if (r.ok) return { ok: true, detail: "Anthropic API key valid" };
    const body = await r.text();
    return { ok: false, detail: `HTTP ${r.status} · ${body.slice(0, 120)}` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

/** OpenAI: GET https://api.openai.com/v1/models. */
async function probeOpenAi(companyId: string): Promise<ProbeResult> {
  const key = await readCredential({ companyId, connectorId: "openai", key: "api_key" });
  if (!key) return { ok: false, detail: "missing api_key" };
  try {
    const r = await withTimeout(
      fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${key}` } }),
      PROBE_TIMEOUT_MS, "openai",
    );
    if (r.ok) return { ok: true, detail: "OpenAI API key valid" };
    return { ok: false, detail: `HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

/** claude-code is verified during Pillar 2 (the CLI probe); test always ok. */
async function probeClaudeCode(): Promise<ProbeResult> {
  return { ok: true, detail: "Verified during Pillar 2 (claude CLI probe)" };
}

const PROBES: Record<string, ProbeFn> = {
  supabase: probeSupabase,
  github: probeGithub,
  telegram: probeTelegram,
  stripe: probeStripe,
  anthropic: probeAnthropic,
  openai: probeOpenAi,
  "claude-code": probeClaudeCode,
};

export async function runProbe(connectorId: string, companyId: string): Promise<ProbeResult> {
  const fn = PROBES[connectorId];
  if (!fn) {
    return {
      ok: false,
      detail: `No test probe registered for "${connectorId}". Credentials are vaulted but unverified.`,
    };
  }
  return fn(companyId);
}

export function hasProbe(connectorId: string): boolean {
  return connectorId in PROBES;
}
