# @wavex-os/claude-code-proxy

Local Anthropic-compatible HTTP proxy. Point Claude Code at it and every `/v1/messages` call rides Supabase Realtime to the operator's Mac, which holds the Claude Max OAuth token. The customer's machine pays $0 in Anthropic API fees and never needs its own API key.

## Architecture

```
Claude Code on customer machine
        │  (HTTPS to ANTHROPIC_BASE_URL)
        ▼
http://127.0.0.1:11434  ← this proxy
        │
        │  publish to Supabase Realtime channel
        │     wavex-anthropic-messages-request:<user_id>
        ▼
   Supabase Realtime ──────────────────────────────┐
                                                   │
                                                   ▼
                              Operator's Mac Mini
                              (inference-server worker, subscribes to
                               wavex-anthropic-messages-request:*)
                                                   │
                                                   │  call Anthropic
                                                   │  via Claude Max OAuth
                                                   ▼
                                           api.anthropic.com
                                                   │
                              ┌────────────────────┘
                              ▼
   Supabase Realtime publishes on
   wavex-anthropic-messages-response:<user_id>
        │
        ▼
   proxy resolves the round-trip, returns Anthropic-format
   response to Claude Code
```

## Quick start

```bash
# 1. Pair the machine (once).
pnpm exec wavex-os login

# 2. Start the proxy.
node packages/claude-code-proxy/bin/wavex-os-proxy.mjs
# → [wavex-os-proxy] listening on http://127.0.0.1:11434

# 3. Run Claude Code against the proxy.
ANTHROPIC_BASE_URL=http://127.0.0.1:11434 claude
```

## Streaming

The Realtime round-trip is non-streaming, but Claude Code expects SSE. The proxy fakes SSE on top of the non-streaming response — Claude Code sees a valid `message_start → content_block_start → content_block_delta → content_block_stop → message_delta → message_stop` event sequence. Real per-token streaming is a v2.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/v1/messages` | Anthropic Messages API — relay over Realtime |
| GET | `/v1/models` | Static list of supported models |
| GET | `/health` | Proxy state for daemon health checks |

## Environment

| Var | Default | Purpose |
|---|---|---|
| `WAVEX_PROXY_PORT` | `11434` | Port to bind |
| `WAVEX_PROXY_HOST` | `127.0.0.1` | Host to bind (never bind public) |
| `WAVEX_DEVICE_TOKEN_PATH` | `~/.wavex-os/device-token.json` | Where to read the device JWT |

## Wiring as a system service

- **macOS:** `templates/launchd/com.wavex-os.claude-code-proxy.plist.tmpl`
- **Windows:** `templates/scheduled-task/wavex-os-claude-code-proxy.xml.tmpl`
- **Linux:** systemd-user unit (TODO)

Templates ship with the package — run `pnpm wavex:os install-services` to register them.
