/**
 * Realtime round-trip helper — speaks the anthropic-messages channel
 * variant of the wavex-os Realtime protocol.
 *
 * Mirrors `packages/cloud-client/src/inference.ts` in structure
 * (subscribe-before-publish, single-flight resolve, 60s timeout, channel
 * cleanup), but the wire payload is the full Anthropic Messages API
 * request body (passes straight through to the Mac worker, which calls
 * Anthropic via Claude Max OAuth).
 *
 * Channels (frozen contract — matches
 * `packages/inference-server/src/realtime/worker.ts`):
 *   wavex-anthropic-messages-request:<user_id>    proxy publishes
 *   wavex-anthropic-messages-response:<user_id>   proxy subscribes
 *   Broadcast event:  "anthropic-messages"
 */
import { randomUUID } from "node:crypto";
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";

const REQUEST_TOPIC_PREFIX = "wavex-anthropic-messages-request:";
const RESPONSE_TOPIC_PREFIX = "wavex-anthropic-messages-response:";
const EVENT_NAME = "anthropic-messages";

export interface AnthropicMessagesResponse {
  id: string;
  type: "message";
  role: "assistant";
  content: Array<Record<string, unknown>>;
  model: string;
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
}

export type BridgeResult =
  | { ok: true; anthropic_response: AnthropicMessagesResponse }
  | {
      ok: false;
      error: string;
      error_class: "rate_limit" | "auth" | "upstream" | "timeout" | "other";
      message: string;
    };

export interface BridgeOptions {
  supabaseUrl: string;
  supabaseAnonKey: string;
  userId: string;
  deviceJwt: string;
  /** Full Anthropic Messages API request body (forwarded verbatim). */
  anthropicRequest: Record<string, unknown>;
  /** Round-trip timeout in ms. Default 90s. */
  timeoutMs?: number;
}

/** Send an Anthropic Messages API request over Realtime and await the
 *  matching response. Never throws on cloud-side business errors —
 *  those come back as `{ ok: false, ... }`. Throws only on transport
 *  failure or a malformed user_id / JWT (caller's responsibility). */
export async function relayAnthropicMessages(opts: BridgeOptions): Promise<BridgeResult> {
  const timeoutMs = opts.timeoutMs ?? 90_000;
  const requestId = randomUUID();
  const requestTopic = `${REQUEST_TOPIC_PREFIX}${opts.userId}`;
  const responseTopic = `${RESPONSE_TOPIC_PREFIX}${opts.userId}`;

  const supabase = createClient(opts.supabaseUrl, opts.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 10 } },
  });

  let responseChannel: RealtimeChannel | null = null;
  let requestChannel: RealtimeChannel | null = null;
  let resolved = false;

  try {
    responseChannel = supabase.channel(responseTopic, {
      config: { broadcast: { ack: false, self: false } },
    });

    let subscribedResolve!: () => void;
    let subscribedReject!: (err: Error) => void;
    const responseSubscribed = new Promise<void>((res, rej) => {
      subscribedResolve = res;
      subscribedReject = rej;
    });

    const responsePromise = new Promise<BridgeResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (resolved) return;
        resolved = true;
        resolve({
          ok: false,
          error: "timeout",
          error_class: "timeout",
          message: `no response from operator Mac within ${timeoutMs}ms`,
        });
      }, timeoutMs);

      responseChannel!.on("broadcast", { event: EVENT_NAME }, ({ payload }) => {
        if (!payload || typeof payload !== "object") return;
        const p = payload as { request_id?: unknown };
        if (p.request_id !== requestId) return;
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);

        const r = payload as {
          ok?: boolean;
          anthropic_response?: AnthropicMessagesResponse;
          error?: string;
          error_class?: string;
          message?: string;
        };
        if (r.ok && r.anthropic_response) {
          resolve({ ok: true, anthropic_response: r.anthropic_response });
        } else {
          resolve({
            ok: false,
            error: r.error ?? "unknown",
            error_class: (r.error_class as BridgeResult extends { ok: false } ? BridgeResult["error_class"] : never) ?? "other",
            message: r.message ?? "Mac returned an unknown error",
          });
        }
      });

      responseChannel!.subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          subscribedResolve();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          const e = new Error(`realtime response channel ${status}: ${err?.message ?? "unknown"}`);
          subscribedReject(e);
          if (resolved) return;
          resolved = true;
          clearTimeout(timer);
          reject(e);
        }
      });
    });

    await responseSubscribed;

    requestChannel = supabase.channel(requestTopic, {
      config: { broadcast: { ack: false, self: false } },
    });
    await waitForSubscribed(requestChannel, timeoutMs);

    const sendResult = await requestChannel.send({
      type: "broadcast",
      event: EVENT_NAME,
      payload: {
        request_id: requestId,
        device_jwt: opts.deviceJwt,
        anthropic_request: opts.anthropicRequest,
      },
    });
    if (sendResult !== "ok") {
      return {
        ok: false,
        error: "publish_failed",
        error_class: "other",
        message: `realtime publish returned status=${sendResult}`,
      };
    }

    return await responsePromise;
  } finally {
    if (responseChannel) {
      try { await responseChannel.unsubscribe(); } catch { /* best-effort */ }
    }
    if (requestChannel) {
      try { await requestChannel.unsubscribe(); } catch { /* best-effort */ }
    }
    try { await supabase.removeAllChannels(); } catch { /* best-effort */ }
  }
}

function waitForSubscribed(channel: RealtimeChannel, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`realtime channel did not reach SUBSCRIBED within ${timeoutMs}ms`));
    }, timeoutMs);
    channel.subscribe((status, err) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(timer);
        resolve();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        clearTimeout(timer);
        reject(new Error(`realtime channel entered ${status}: ${err?.message ?? "unknown"}`));
      }
    });
  });
}
