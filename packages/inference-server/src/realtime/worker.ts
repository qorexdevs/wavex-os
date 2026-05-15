/**
 * Supabase Realtime worker — Mac rendezvous half.
 *
 * Pairs with `packages/cloud-client/`. The operator Mac connects OUTWARD to
 * Supabase Realtime (no public HTTPS endpoint required), wildcard-subscribes
 * to `wavex-inference-request:<user_id>` channels, validates the device JWT
 * inside each request, calls Anthropic via the OAuth path, then broadcasts
 * the response on `wavex-inference-response:<user_id>`. Also records each
 * call in `wavex_os.usage_ledger`.
 *
 * Why this exists alongside `routes/os-paid.ts`:
 *   Both implement the same auth + Anthropic + ledger flow. HTTP route is
 *   kept for local smoke + fallback; Realtime is the production transport
 *   that sidesteps NAT-traversal (no Cloudflare/ngrok needed pointing at
 *   the Mac).
 *
 * Channel naming (frozen contract — cloud-client subagent reads the same):
 *   wavex-inference-request:<user_id>   ← customer publishes; Mac subscribes
 *   wavex-inference-response:<user_id>  ← Mac publishes; customer subscribes
 *
 * Realtime broadcast event name: `wavex-inference`.
 *
 * Topic discovery:
 *   Supabase Realtime channels are joined by exact topic; there's no native
 *   wildcard. We resolve the set of user_ids to subscribe to by:
 *     1. WAVEX_OS_REALTIME_USER_IDS env (comma-separated, takes precedence)
 *     2. RPC `wavex_os_active_user_ids` if it exists (graceful fallback)
 *   Periodic refresh (60s) picks up newly-paired users without a restart.
 *
 * Skip env hooks (for smoke + tests):
 *   WAVEX_OS_INFERENCE_SKIP_SUB=1   bypass subscription gating
 *   WAVEX_OS_INFERENCE_MOCK=1       short-circuit Anthropic call (returns
 *                                    a canned response; ledger row still
 *                                    written but with zero cost)
 *   WAVEX_OS_REALTIME_DISABLED=1    do not start the worker at all
 */
import { createClient, type SupabaseClient, type RealtimeChannel } from "@supabase/supabase-js";
import { verifyDeviceJwt } from "@wavex-os/auth-shim";
import { callAnthropicOAuth, inferenceBackend } from "../lib/anthropic-oauth.js";

const REQUEST_TOPIC_PREFIX = "wavex-inference-request:";
const RESPONSE_TOPIC_PREFIX = "wavex-inference-response:";
const BROADCAST_EVENT = "wavex-inference";
const REFRESH_INTERVAL_MS = 60_000;
const DEFAULT_MODEL = process.env.WAVEX_OS_INFERENCE_MODEL ?? "claude-sonnet-4-6";
const MAX_OUTPUT_TOKENS_HARD = 8000;
const ACTIVE_STATUSES = new Set(["trialing", "active", "past_due"]);

type Logger = {
  info: (msg: Record<string, unknown> | string, ...args: unknown[]) => void;
  warn: (msg: Record<string, unknown> | string, ...args: unknown[]) => void;
  error: (msg: Record<string, unknown> | string, ...args: unknown[]) => void;
};

interface RequestPayload {
  request_id?: unknown;
  device_jwt?: unknown;
  prompt?: unknown;
  model?: unknown;
  max_output_tokens?: unknown;
  purpose?: unknown;
}

interface SubscriptionRow {
  id: string;
  status: string;
  tier?: string;
}

function calcCostCents(
  model: string,
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  },
): number {
  // Sonnet 4.6 blended; same numbers as routes/onboarding.ts so the ledger
  // is comparable across Pool A / HTTP / Realtime paths.
  if (model.includes("haiku")) {
    return Math.round((usage.input_tokens * 0.001 + usage.output_tokens * 0.005) / 10);
  }
  return Math.round(
    (usage.input_tokens * 0.0003 +
      usage.output_tokens * 0.0015 +
      (usage.cache_read_input_tokens ?? 0) * 0.00003 +
      (usage.cache_creation_input_tokens ?? 0) * 0.000375) *
      100,
  );
}

async function lookupActiveSubscription(
  supabase: SupabaseClient,
  subjectId: string,
): Promise<{ ok: true; row: SubscriptionRow } | { ok: false; error: string }> {
  // Mirrors the pattern in routes/os-paid.ts — the JWT's sub-claim is
  // treated as the subscription_id, matching what the cloud minter does.
  const { data, error } = await supabase.rpc("wavex_os_subscription_lookup", {
    p_subscription_id: subjectId,
  });
  if (error) return { ok: false, error: "subscription_lookup_failed" };
  const rows = data as SubscriptionRow[] | null;
  const row = rows?.[0];
  if (!row) return { ok: false, error: "subscription_not_found" };
  if (!ACTIVE_STATUSES.has(row.status)) return { ok: false, error: "subscription_expired" };
  return { ok: true, row };
}

async function writeLedger(
  supabase: SupabaseClient,
  row: {
    pool: "C";
    subscription_id: string;
    user_id: string;
    request_id: string;
    model: string;
    prompt_tokens: number;
    completion_tokens: number;
    cache_read_tokens: number;
    cache_creation_tokens: number;
    cost_cents: number;
    status: "ok" | "error" | "rate_limited" | "cap_hit";
    error_class?: string;
  },
  log: Logger,
): Promise<void> {
  // Fire-and-forget — don't block the response on ledger latency.
  // Same schema/from() pattern as routes/onboarding.ts:writeLedger.
  void supabase
    .schema("wavex_os")
    .from("usage_ledger")
    .insert(row)
    .then((r: { error: unknown }) => {
      if (r.error) log.warn({ err: r.error, request_id: row.request_id }, "usage_ledger insert failed");
    });
}

/** Discover user_ids whose channels we should subscribe to. */
async function discoverUserIds(supabase: SupabaseClient, log: Logger): Promise<string[]> {
  const envIds = (process.env.WAVEX_OS_REALTIME_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (envIds.length > 0) return envIds;

  // Optional RPC — graceful fallback if it doesn't exist on the cloud side.
  try {
    const { data, error } = await supabase.rpc("wavex_os_active_user_ids");
    if (!error && Array.isArray(data)) {
      const ids = (data as Array<string | { user_id?: string }>)
        .map((r) => (typeof r === "string" ? r : r?.user_id ?? ""))
        .filter(Boolean);
      if (ids.length > 0) return ids;
    }
  } catch (e) {
    log.warn({ err: (e as Error).message }, "active_user_ids RPC unavailable; relying on env");
  }
  return [];
}

async function handleRequest(args: {
  supabase: SupabaseClient;
  topicUserId: string;
  payload: RequestPayload;
  log: Logger;
}): Promise<void> {
  const { supabase, topicUserId, payload, log } = args;
  const started = Date.now();

  // Parse + shape-validate. Anything malformed gets a warn + ignore so a
  // garbage publish can't crash the worker.
  const request_id = typeof payload.request_id === "string" ? payload.request_id : null;
  const device_jwt = typeof payload.device_jwt === "string" ? payload.device_jwt : null;
  const prompt = typeof payload.prompt === "string" ? payload.prompt : null;
  const model = typeof payload.model === "string" ? payload.model : DEFAULT_MODEL;
  const maxOut = Math.min(
    typeof payload.max_output_tokens === "number" && payload.max_output_tokens > 0
      ? payload.max_output_tokens
      : 1024,
    MAX_OUTPUT_TOKENS_HARD,
  );

  if (!request_id || !device_jwt || !prompt) {
    log.warn({ topicUserId, hasReqId: !!request_id }, "ignoring malformed realtime request");
    return;
  }

  // Default response topic is the topic the request arrived on. If the JWT
  // verifies and carries a different sub, prefer that — keeps the response
  // routed to the actual user even if a wrong-channel publish happens.
  let responseUserId = topicUserId;
  const respond = async (body: Record<string, unknown>): Promise<void> => {
    try {
      const ch = supabase.channel(`${RESPONSE_TOPIC_PREFIX}${responseUserId}`);
      await new Promise<void>((resolve) => {
        ch.subscribe((status) => {
          if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") resolve();
        });
        // Belt-and-suspenders: don't hang forever on broken realtime
        setTimeout(resolve, 5_000);
      });
      await ch.send({ type: "broadcast", event: BROADCAST_EVENT, payload: body });
      await supabase.removeChannel(ch);
    } catch (e) {
      log.error({ err: (e as Error).message, request_id }, "response broadcast failed");
    }
  };

  // JWT verify
  const v = verifyDeviceJwt(device_jwt);
  if (!v.ok || !v.payload) {
    log.warn({ topicUserId, request_id, reason: v.reason }, "device JWT verify failed");
    await respond({
      request_id,
      ok: false,
      error: "no_paired_device",
      message: `device JWT invalid: ${v.reason ?? "unknown"}`,
    });
    return;
  }
  responseUserId = v.payload.sub;

  // Subscription gating
  if (process.env.WAVEX_OS_INFERENCE_SKIP_SUB !== "1") {
    const sub = await lookupActiveSubscription(supabase, v.payload.sub);
    if (!sub.ok) {
      const errorCode =
        sub.error === "subscription_expired"
          ? "no_active_subscription"
          : sub.error === "subscription_not_found"
            ? "no_active_subscription"
            : "internal";
      await respond({
        request_id,
        ok: false,
        error: errorCode,
        message: sub.error,
      });
      log.info(
        { request_id, user_id: v.payload.sub, outcome: errorCode, duration_ms: Date.now() - started },
        "realtime request rejected",
      );
      return;
    }
  }

  // Anthropic call (or mock for tests)
  try {
    let content = "";
    let usageInput = 0;
    let usageOutput = 0;
    let usageCacheRead = 0;
    let usageCacheCreate = 0;

    if (process.env.WAVEX_OS_INFERENCE_MOCK === "1") {
      content = "[MOCK] ok";
      usageInput = Math.max(1, Math.ceil(prompt.length / 4));
      usageOutput = 2;
    } else {
      if (inferenceBackend() !== "oauth") {
        await respond({
          request_id,
          ok: false,
          error: "internal",
          message: "WAVEX_INFERENCE_BACKEND must be oauth for realtime path",
        });
        return;
      }
      const r = await callAnthropicOAuth({
        model,
        max_tokens: maxOut,
        messages: [{ role: "user", content: prompt }],
      });
      content = r.content
        .map((c) => (c.type === "text" ? (c as { text: string }).text : ""))
        .join("");
      usageInput = r.usage.input_tokens;
      usageOutput = r.usage.output_tokens;
      usageCacheRead = r.usage.cache_read_input_tokens ?? 0;
      usageCacheCreate = r.usage.cache_creation_input_tokens ?? 0;
    }

    const durationMs = Date.now() - started;
    const costCents = calcCostCents(model, {
      input_tokens: usageInput,
      output_tokens: usageOutput,
      cache_read_input_tokens: usageCacheRead,
      cache_creation_input_tokens: usageCacheCreate,
    });

    await respond({
      request_id,
      ok: true,
      content,
      model,
      usage: {
        input_tokens: usageInput,
        output_tokens: usageOutput,
        cached_input_tokens: usageCacheRead,
        cost_usd: costCents / 100,
        duration_ms: durationMs,
      },
    });

    void writeLedger(
      supabase,
      {
        pool: "C",
        subscription_id: v.payload.sub,
        user_id: v.payload.sub,
        request_id,
        model,
        prompt_tokens: usageInput,
        completion_tokens: usageOutput,
        cache_read_tokens: usageCacheRead,
        cache_creation_tokens: usageCacheCreate,
        cost_cents: costCents,
        status: "ok",
      },
      log,
    );

    log.info(
      { request_id, user_id: v.payload.sub, outcome: "ok", duration_ms: durationMs, cost_cents: costCents },
      "realtime request served",
    );
  } catch (e) {
    const err = e as { status?: number; message?: string };
    const isUpstream = typeof err.status === "number" && err.status >= 400 && err.status < 600;
    await respond({
      request_id,
      ok: false,
      error: isUpstream ? "upstream_error" : "internal",
      message: err.message ?? "anthropic_call_failed",
    });
    log.error(
      { err: err.message, request_id, user_id: v.payload.sub, duration_ms: Date.now() - started },
      "realtime request failed",
    );
  }
}

export interface RealtimeWorkerDeps {
  log: Logger;
  supabaseUrl?: string;
  supabaseServiceKey?: string;
}

export interface RealtimeWorkerHandle {
  stop: () => Promise<void>;
  subscribedTopics: () => string[];
}

/** Start the Realtime worker. Returns a handle for graceful shutdown.
 *  If required env is missing, logs a warning and returns a no-op handle —
 *  it MUST NOT throw, because the HTTP server should still come up. */
export async function startRealtimeWorker(deps: RealtimeWorkerDeps): Promise<RealtimeWorkerHandle> {
  const { log } = deps;
  if (process.env.WAVEX_OS_REALTIME_DISABLED === "1") {
    log.info("realtime worker disabled via WAVEX_OS_REALTIME_DISABLED=1");
    return { stop: async () => {}, subscribedTopics: () => [] };
  }
  const url = deps.supabaseUrl ?? process.env.SUPABASE_URL;
  const key = deps.supabaseServiceKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    log.warn("realtime worker: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing; skipping");
    return { stop: async () => {}, subscribedTopics: () => [] };
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const channelsByUserId = new Map<string, RealtimeChannel>();

  const subscribeUser = async (userId: string): Promise<void> => {
    if (channelsByUserId.has(userId)) return;
    const topic = `${REQUEST_TOPIC_PREFIX}${userId}`;
    const ch = supabase
      .channel(topic)
      .on("broadcast", { event: BROADCAST_EVENT }, (msg: { payload?: RequestPayload }) => {
        void handleRequest({
          supabase,
          topicUserId: userId,
          payload: msg.payload ?? {},
          log,
        });
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          log.info({ topic, user_id: userId }, "realtime worker subscribed");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          log.warn({ topic, status }, "realtime channel status");
        }
      });
    channelsByUserId.set(userId, ch);
  };

  const refresh = async (): Promise<void> => {
    try {
      const ids = await discoverUserIds(supabase, log);
      // Subscribe to any newly-discovered user_ids. We intentionally do NOT
      // unsubscribe disappeared user_ids — a customer mid-flight shouldn't
      // be dropped because of a transient discovery glitch.
      for (const id of ids) {
        await subscribeUser(id);
      }
      if (ids.length === 0 && channelsByUserId.size === 0) {
        log.info("realtime worker: no user_ids to subscribe to yet (set WAVEX_OS_REALTIME_USER_IDS to bind explicitly)");
      }
    } catch (e) {
      log.error({ err: (e as Error).message }, "realtime worker refresh failed");
    }
  };

  await refresh();
  const refreshTimer = setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
  refreshTimer.unref?.();

  log.info({ subscribed_count: channelsByUserId.size }, "realtime worker connected");

  return {
    stop: async () => {
      clearInterval(refreshTimer);
      for (const ch of channelsByUserId.values()) {
        try {
          await supabase.removeChannel(ch);
        } catch {
          /* ignore */
        }
      }
      channelsByUserId.clear();
    },
    subscribedTopics: () => Array.from(channelsByUserId.keys()).map((u) => `${REQUEST_TOPIC_PREFIX}${u}`),
  };
}
