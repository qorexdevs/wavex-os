/**
 * @wavex-os/claude-code-proxy
 *
 * Local Anthropic-compatible HTTP server that translates `/v1/messages`
 * calls into Supabase Realtime broadcasts on
 *   wavex-anthropic-messages-request:<user_id>
 * and awaits the matching response on
 *   wavex-anthropic-messages-response:<user_id>
 *
 * The operator's Mac runs the worker half (see
 * `packages/inference-server/src/realtime/worker.ts`) — it holds the
 * Claude Max OAuth token and translates the request to a real Anthropic
 * call. The customer's machine never needs an API key.
 *
 * Customer-side wiring:
 *   1. Pair the device once: `wavex-os login`
 *   2. Start the proxy: `node packages/claude-code-proxy/bin/wavex-os-proxy.mjs`
 *      (or via launchd / Scheduled Task — templates ship with this package)
 *   3. Tell Claude Code to use it:
 *        ANTHROPIC_BASE_URL=http://127.0.0.1:11434 claude
 *   4. Claude Code runs normally; every LLM call rides the Realtime
 *      channel to the operator's Mac.
 *
 * Streaming: the proxy fakes SSE chunking on top of the non-streaming
 * Realtime round-trip — Claude Code sees a valid SSE stream of
 * message_start → content_block_start → content_block_delta →
 * content_block_stop → message_delta → message_stop events, but the
 * Realtime hop is a single request/response pair. Real per-token
 * streaming is a v2.
 */
export { startProxy } from "./server.js";
export type { ProxyOptions } from "./server.js";
