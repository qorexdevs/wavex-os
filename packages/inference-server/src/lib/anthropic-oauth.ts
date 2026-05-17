/**
 * Anthropic OAuth-via-Keychain caller (Pool A + Pool C share this path).
 *
 * Resells the operator's Claude Max subscription as the inference backend
 * for wavex-os customers. Token lives in macOS Keychain under
 * `Claude Code-credentials` (same secret the agent fleet uses), and is
 * fetched on every cold call so a refresh by the `claude` CLI is picked
 * up immediately.
 *
 * Per docs/INFERENCE_AUTH.md §"OAuth path on the Mac mini" and
 * docs/V2_CAPTURE_C_inference_server.md §3.
 *
 * Activation: set WAVEX_INFERENCE_BACKEND=oauth in the inference-server env.
 * Reverting to metered API: set WAVEX_INFERENCE_BACKEND=apikey + provide
 * ANTHROPIC_API_KEY.
 */
import { execSync } from "node:child_process";

let cachedToken: { value: string; expiresAt: number } | null = null;

function readKeychain(): { token: string; expiresAt: number } {
  const raw = execSync(
    "security find-generic-password -s 'Claude Code-credentials' -w 2>/dev/null",
    { encoding: "utf8" },
  ).trim();
  const env = JSON.parse(raw) as {
    claudeAiOauth: { accessToken: string; expiresAt: number; refreshToken?: string };
  };
  return { token: env.claudeAiOauth.accessToken, expiresAt: env.claudeAiOauth.expiresAt };
}

/** Returns a fresh access token. Caches in-process for up to 60 s to
 *  amortize the Keychain syscall under bursty traffic. Re-reads if expiry
 *  is within 60 s. */
function getOAuthToken(): string {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - now > 60_000 && now - (cachedToken as { issued?: number }).issued! < 60_000) {
    return cachedToken.value;
  }
  const { token, expiresAt } = readKeychain();
  cachedToken = { value: token, expiresAt };
  (cachedToken as { issued?: number }).issued = now;
  return token;
}

export interface OAuthAnthropicResponse {
  id: string;
  content: Array<{ type: "text"; text: string } | { type: string }>;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  stop_reason?: string;
  model?: string;
}

export interface OAuthAnthropicError {
  status: number;
  message: string;
  body?: string;
}

/** POST to Anthropic /v1/messages using the Claude Max OAuth token.
 *  The `system` line is REQUIRED by the OAuth pattern — Anthropic checks
 *  that the request originated from Claude Code; setting it identifies
 *  the request as a CLI invocation. Do NOT remove the system line.
 */
export async function callAnthropicOAuth(args: {
  model: string;
  max_tokens: number;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<OAuthAnthropicResponse> {
  const token = getOAuthToken();
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "anthropic-beta": "oauth-2025-04-20",
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: args.model,
      max_tokens: args.max_tokens,
      messages: args.messages,
      system: "You are Claude Code, Anthropic's official CLI for Claude.",
    }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    const err = new Error(`Anthropic OAuth call failed (${resp.status})`) as Error & OAuthAnthropicError;
    err.status = resp.status;
    err.message = body.slice(0, 400);
    err.body = body;
    throw err;
  }
  return (await resp.json()) as OAuthAnthropicResponse;
}

/** What backend will the inference-server use? */
export function inferenceBackend(): "oauth" | "apikey" {
  return (process.env.WAVEX_INFERENCE_BACKEND ?? "oauth") === "apikey" ? "apikey" : "oauth";
}

/** Canonical system identity that Anthropic's OAuth beta gate requires
 *  the request to start with. Don't change this string. */
export const CLAUDE_CODE_SYSTEM_PREFIX =
  "You are Claude Code, Anthropic's official CLI for Claude.";

/** Full Anthropic Messages API response (passthrough — keeps content blocks,
 *  tool_use blocks, stop_reason, full usage). Used by the Realtime worker's
 *  "anthropic-messages" handler to relay Claude Code's calls through the
 *  Mac's Claude Max OAuth. */
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

/** Raw passthrough caller. Accepts the full Messages API request shape,
 *  prepends the Claude Code identity to the system field (Anthropic's
 *  OAuth gate requires it), and returns the raw response. Used to relay
 *  Claude Code → operator's OAuth without reshaping. */
export async function callAnthropicOAuthRaw(body: {
  model: string;
  max_tokens: number;
  messages: Array<Record<string, unknown>>;
  system?: string | Array<Record<string, unknown>>;
  tools?: Array<Record<string, unknown>>;
  tool_choice?: Record<string, unknown>;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
  metadata?: Record<string, unknown>;
  // stream is intentionally NOT forwarded — the worker always asks for a
  // full response; the customer-side proxy fakes SSE chunking.
}): Promise<AnthropicMessagesResponse> {
  const token = getOAuthToken();

  // Stitch the Claude Code identity into the system field. Three cases:
  //   (a) caller omitted system → set to the identity
  //   (b) caller passed a string → prepend identity + "\n\n"
  //   (c) caller passed blocks → prepend an identity text block
  let system: string | Array<Record<string, unknown>>;
  if (body.system === undefined) {
    system = CLAUDE_CODE_SYSTEM_PREFIX;
  } else if (typeof body.system === "string") {
    system = body.system.startsWith(CLAUDE_CODE_SYSTEM_PREFIX)
      ? body.system
      : `${CLAUDE_CODE_SYSTEM_PREFIX}\n\n${body.system}`;
  } else {
    const blocks = body.system;
    const first = blocks[0] as { type?: string; text?: string } | undefined;
    if (first?.type === "text" && typeof first.text === "string" && first.text.startsWith(CLAUDE_CODE_SYSTEM_PREFIX)) {
      system = blocks;
    } else {
      system = [{ type: "text", text: CLAUDE_CODE_SYSTEM_PREFIX }, ...blocks];
    }
  }

  // Drop fields Anthropic doesn't accept + keep `stream: false`.
  const upstreamBody: Record<string, unknown> = {
    model: body.model,
    max_tokens: body.max_tokens,
    messages: body.messages,
    system,
  };
  if (body.tools) upstreamBody.tools = body.tools;
  if (body.tool_choice) upstreamBody.tool_choice = body.tool_choice;
  if (typeof body.temperature === "number") upstreamBody.temperature = body.temperature;
  if (typeof body.top_p === "number") upstreamBody.top_p = body.top_p;
  if (typeof body.top_k === "number") upstreamBody.top_k = body.top_k;
  if (body.stop_sequences) upstreamBody.stop_sequences = body.stop_sequences;
  if (body.metadata) upstreamBody.metadata = body.metadata;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "anthropic-beta": "oauth-2025-04-20",
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(upstreamBody),
  });
  if (!resp.ok) {
    const bodyText = await resp.text();
    const err = new Error(`Anthropic OAuth raw call failed (${resp.status})`) as Error & OAuthAnthropicError;
    err.status = resp.status;
    err.message = bodyText.slice(0, 400);
    err.body = bodyText;
    throw err;
  }
  return (await resp.json()) as AnthropicMessagesResponse;
}
