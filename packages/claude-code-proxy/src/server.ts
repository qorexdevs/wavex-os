/**
 * Fastify server exposing an Anthropic-compatible HTTP surface.
 *
 * Endpoints:
 *   POST /v1/messages   ← Claude Code calls this; we relay over Realtime
 *   GET  /v1/models     ← static list of models the Mac worker accepts
 *   GET  /health        ← proxy state for the daemon's health checks
 *
 * Auth model:
 *   Claude Code does NOT send an Anthropic API key — the customer sets
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:11434 and leaves
 *   ANTHROPIC_API_KEY unset (or sets it to a dummy). The proxy reads
 *   the device JWT from `~/.wavex-os/device-token.json` (via
 *   `@wavex-os/cloud-client/token-store`) and uses that to authenticate
 *   the Realtime call. Per-customer cost attribution happens on the Mac
 *   side via the JWT's sub claim.
 *
 * Streaming:
 *   Anthropic's API supports `stream: true` with SSE chunks. The Realtime
 *   round-trip is non-streaming. We fake SSE on top: when `stream: true`
 *   is requested, we run the non-streaming round-trip and then emit a
 *   valid SSE event sequence that mirrors what Anthropic returns for a
 *   complete message (message_start → content_block_start → … →
 *   message_stop). Claude Code consumes this happily.
 */
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { getValidAccessToken } from "@wavex-os/cloud-client/token-store";
import { loadConfig } from "@wavex-os/cloud-client/config";
import { relayAnthropicMessages, type AnthropicMessagesResponse, type BridgeResult } from "./realtime-bridge.js";

export interface ProxyOptions {
  /** Port to bind. Default 11434 (Anthropic-ish, mirrors common LLM proxy
   *  conventions). Override via WAVEX_PROXY_PORT. */
  port?: number;
  /** Host to bind. Default 127.0.0.1 — never bind public. */
  host?: string;
  /** Round-trip timeout for Realtime. Default 90s. */
  timeoutMs?: number;
}

/** Boot the Fastify server + return a handle. */
export async function startProxy(opts: ProxyOptions = {}): Promise<{
  app: FastifyInstance;
  close: () => Promise<void>;
  url: string;
}> {
  const port = opts.port ?? Number(process.env.WAVEX_PROXY_PORT ?? 11434);
  const host = opts.host ?? process.env.WAVEX_PROXY_HOST ?? "127.0.0.1";
  const timeoutMs = opts.timeoutMs ?? 90_000;

  const cfg = loadConfig();

  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      transport: process.env.WAVEX_PROXY_PRETTY === "1"
        ? { target: "pino-pretty" }
        : undefined,
    },
    bodyLimit: 4 * 1024 * 1024, // 4 MB — Anthropic supports long prompts + tool definitions
    trustProxy: false,
  });

  // ── GET /health ─────────────────────────────────────────────────
  app.get("/health", async () => {
    let userId: string | null = null;
    let hasJwt = false;
    let expiresAt: number | null = null;
    let tokenError: string | null = null;
    try {
      const jwt = await getValidAccessToken();
      hasJwt = true;
      userId = extractSubFromJwt(jwt);
      expiresAt = extractExpFromJwt(jwt);
    } catch (e) {
      tokenError = e instanceof Error ? e.message : String(e);
    }
    return {
      ok: true,
      has_device_jwt: hasJwt,
      user_id: userId,
      expires_at: expiresAt,
      token_error: tokenError,
      proxy_port: port,
    };
  });

  // ── GET /v1/models ──────────────────────────────────────────────
  // Static list. The Mac worker supports any model Anthropic accepts;
  // these are the ones we price + cap.
  app.get("/v1/models", async () => ({
    data: [
      { id: "claude-sonnet-4-6", type: "model", display_name: "Claude Sonnet 4.6", created_at: "2026-01-01T00:00:00Z" },
      { id: "claude-opus-4-7", type: "model", display_name: "Claude Opus 4.7", created_at: "2026-01-01T00:00:00Z" },
      { id: "claude-haiku-4-5", type: "model", display_name: "Claude Haiku 4.5", created_at: "2026-01-01T00:00:00Z" },
    ],
    has_more: false,
    first_id: "claude-sonnet-4-6",
    last_id: "claude-haiku-4-5",
  }));

  // ── POST /v1/messages ───────────────────────────────────────────
  app.post("/v1/messages", async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as Record<string, unknown> | undefined;

    // Shape validation — minimal, mirrors what Anthropic actually requires.
    if (!body || typeof body !== "object") {
      return reply.status(400).send(anthropicError("invalid_request_error", "request body must be a JSON object"));
    }
    if (typeof body.model !== "string") {
      return reply.status(400).send(anthropicError("invalid_request_error", "missing or invalid 'model' field"));
    }
    if (typeof body.max_tokens !== "number") {
      return reply.status(400).send(anthropicError("invalid_request_error", "missing or invalid 'max_tokens' field"));
    }
    if (!Array.isArray(body.messages)) {
      return reply.status(400).send(anthropicError("invalid_request_error", "missing or invalid 'messages' field"));
    }

    const wantStream = body.stream === true;

    // Load + auto-refresh device JWT. If unpaired → 401 in Anthropic shape.
    let deviceJwt: string;
    let userId: string;
    try {
      deviceJwt = await getValidAccessToken();
      userId = extractSubFromJwt(deviceJwt);
    } catch (e) {
      return reply
        .status(401)
        .send(
          anthropicError(
            "authentication_error",
            `device not paired or refresh failed: ${e instanceof Error ? e.message : String(e)}. Run \`wavex-os login\` to pair.`,
          ),
        );
    }

    // Strip fields we don't pass through (anthropic-beta header headers
    // aren't allowed in body, and the Mac worker always asks for
    // non-streaming responses).
    const { stream: _stream, ...anthropicRequest } = body as Record<string, unknown> & { stream?: boolean };

    const result: BridgeResult = await relayAnthropicMessages({
      supabaseUrl: cfg.supabaseUrl,
      supabaseAnonKey: cfg.supabaseAnonKey,
      userId,
      deviceJwt,
      anthropicRequest,
      timeoutMs,
    });

    if (!result.ok) {
      const statusCode = mapErrorClassToHttp(result.error_class);
      return reply.status(statusCode).send(
        anthropicError(mapErrorClassToAnthropicType(result.error_class), result.message),
      );
    }

    if (wantStream) {
      return sendFakeStream(reply, result.anthropic_response);
    }
    return reply.status(200).send(result.anthropic_response);
  });

  await app.listen({ port, host });
  const url = `http://${host}:${port}`;
  app.log.info({ url }, "wavex-os claude-code-proxy listening");

  return {
    app,
    url,
    close: async () => {
      await app.close();
    },
  };
}

// ── Helpers ────────────────────────────────────────────────────────

function anthropicError(type: string, message: string): { type: "error"; error: { type: string; message: string } } {
  return { type: "error", error: { type, message } };
}

function mapErrorClassToHttp(c: "rate_limit" | "auth" | "upstream" | "timeout" | "other"): number {
  switch (c) {
    case "rate_limit": return 429;
    case "auth": return 401;
    case "upstream": return 502;
    case "timeout": return 504;
    default: return 500;
  }
}

function mapErrorClassToAnthropicType(c: "rate_limit" | "auth" | "upstream" | "timeout" | "other"): string {
  switch (c) {
    case "rate_limit": return "rate_limit_error";
    case "auth": return "authentication_error";
    case "upstream": return "api_error";
    case "timeout": return "api_error";
    default: return "api_error";
  }
}

function extractSubFromJwt(jwt: string): string {
  const parts = jwt.split(".");
  if (parts.length !== 3) throw new Error("malformed JWT");
  const payloadB64 = parts[1]!;
  const normalized = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 ? 4 - (normalized.length % 4) : 0;
  const payload = JSON.parse(Buffer.from(normalized + "=".repeat(pad), "base64").toString("utf8"));
  if (typeof payload.sub !== "string" || !payload.sub) throw new Error("JWT missing sub claim");
  return payload.sub;
}

function extractExpFromJwt(jwt: string): number | null {
  try {
    const parts = jwt.split(".");
    const normalized = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const pad = normalized.length % 4 ? 4 - (normalized.length % 4) : 0;
    const payload = JSON.parse(Buffer.from(normalized + "=".repeat(pad), "base64").toString("utf8"));
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

/** Send a synthetic SSE stream that mirrors what Anthropic emits for a
 *  complete (non-tool-use) text message. Claude Code consumes this and
 *  treats it as if the Anthropic API streamed in real time. */
function sendFakeStream(reply: FastifyReply, msg: AnthropicMessagesResponse): FastifyReply {
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const write = (event: string, data: unknown): void => {
    reply.raw.write(`event: ${event}\n`);
    reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // message_start — full top-level fields, EMPTY content array.
  write("message_start", {
    type: "message_start",
    message: {
      id: msg.id,
      type: msg.type,
      role: msg.role,
      content: [],
      model: msg.model,
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: msg.usage.input_tokens, output_tokens: 0 },
    },
  });

  // For each content block in the final message, emit start → delta(s) → stop.
  // Tool-use blocks get their own delta shape — Claude Code expects
  // input_json_delta events for those.
  for (let i = 0; i < msg.content.length; i++) {
    const block = msg.content[i] as Record<string, unknown>;
    const type = typeof block.type === "string" ? block.type : "text";

    if (type === "text") {
      write("content_block_start", {
        type: "content_block_start",
        index: i,
        content_block: { type: "text", text: "" },
      });
      const text = typeof block.text === "string" ? block.text : "";
      write("content_block_delta", {
        type: "content_block_delta",
        index: i,
        delta: { type: "text_delta", text },
      });
      write("content_block_stop", { type: "content_block_stop", index: i });
    } else if (type === "tool_use") {
      write("content_block_start", {
        type: "content_block_start",
        index: i,
        content_block: {
          type: "tool_use",
          id: block.id,
          name: block.name,
          input: {},
        },
      });
      write("content_block_delta", {
        type: "content_block_delta",
        index: i,
        delta: {
          type: "input_json_delta",
          partial_json: JSON.stringify(block.input ?? {}),
        },
      });
      write("content_block_stop", { type: "content_block_stop", index: i });
    } else {
      // Unknown block type — pass through as opaque.
      write("content_block_start", {
        type: "content_block_start",
        index: i,
        content_block: block,
      });
      write("content_block_stop", { type: "content_block_stop", index: i });
    }
  }

  // message_delta — final stop_reason + output usage.
  write("message_delta", {
    type: "message_delta",
    delta: { stop_reason: msg.stop_reason, stop_sequence: msg.stop_sequence },
    usage: { output_tokens: msg.usage.output_tokens },
  });

  write("message_stop", { type: "message_stop" });

  reply.raw.end();
  return reply;
}
