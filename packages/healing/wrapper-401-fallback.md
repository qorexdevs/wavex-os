# Wrapper 401 Self-Heal — Layer 1 contract

Layer 1 of the self-healing architecture (see [`docs/SELF_HEALING.md`](../../docs/SELF_HEALING.md)). The per-spawn wrapper detects auth failures and calls Layer 2's `/api/maintenance/oauth/refresh` endpoint before retrying the same call.

The reference shell wrapper is at [`scripts/wrappers/claude-spawn.sh`](../../scripts/wrappers/claude-spawn.sh). This document specifies the contract any equivalent implementation must honor.

## Contract

A compliant wrapper MUST:

1. **Read the live credential** from the credential store on every spawn. Never trust a captured-at-provisioning `.env` value.
2. **Buffer the primary call's output** until exit, so the orchestrator's stream parser sees only ONE completed run on retry.
3. **Detect `USAGE_LIMIT_RE`** (rate-limit / 5h tier exhausted) → re-exec with a fallback model. Strip any existing `--model` flag and append the configured fallback.
4. **Detect `AUTH_FAIL_RE`** (401 / `authentication_failed` / `Invalid authentication credentials`) → POST to `/api/maintenance/oauth/refresh`, re-read the credential store, re-exec with the SAME model. Sonnet shares the OAuth token; never swap models on a 401.
5. **Log every fallback event** as one NDJSON line to `$WAVEX_FALLBACK_LOG_DIR/fallback.ndjson`. Required fields: `ts`, `event` (`model_fallback` | `oauth_recovery`), `primary_exit`.
6. **Strip inherited Anthropic env vars** before exec — `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`, etc. — so the wrapped CLI cannot route through a stale or unintended endpoint.

## Regex bank

```
USAGE_LIMIT_RE='"type":"rate_limit_error"|"api_error_status":429|"api_error_status":529|5-hour limit|extra usage required|usage_limit_exceeded'

AUTH_FAIL_RE='"api_error_status":401|"error":"authentication_failed"|"type":"authentication_error"|Invalid authentication credentials'
```

Both patterns are field-tested against the actual Anthropic SDK error JSON. If you observe a new failure mode that should fall through one of these paths, extend the alternation rather than adding a new path — the orchestrator parses fallback log events by the `event` field, not by which regex matched.

## Why model-swap on 401 is wrong

Sonnet, Opus, and Haiku all hit Anthropic with the same OAuth bearer token. A 401 means the token is invalid; the model never gets to enter the picture. Swapping models on a 401 produces a second 401 with the same token, doubles the spend, and delays recovery by one round-trip.

The correct chain on 401:
1. Wrapper detects 401.
2. Wrapper POSTs to `/api/maintenance/oauth/refresh`.
3. Layer 2 (oauth-refresh) coalesces concurrent callers via the in-flight Promise singleton + 30s post-success cooldown.
4. Layer 2 either returns `{ok: true}` (fresh token written to credential store) or `{ok: false, reason: refresh_rejected | network_error | keychain_write_failed}`.
5. On `ok:true`, wrapper re-reads the credential store and re-execs with SAME model.
6. On `ok:false`, wrapper emits the original 401 and exits. The maintenance UI's expired-status alert is the human-tap fallback.

## Configurable knobs (reference shell wrapper)

| Env var | Default | Purpose |
|---|---|---|
| `WAVEX_CLAUDE_BIN` | `claude` (PATH lookup) | path to the claude CLI |
| `WAVEX_KEYCHAIN_SERVICE` | `Claude Code-credentials` | keychain service name |
| `WAVEX_API_BASE` | `http://127.0.0.1:3100` | orchestrator base URL for `/oauth/refresh` |
| `WAVEX_FALLBACK_MODEL` | `claude-sonnet-4-6` | model used for usage-limit retries |
| `WAVEX_FALLBACK_LOG_DIR` | `~/.wavex-os/state/wrapper-fallback-logs` | NDJSON log target |

## Observability

The orchestrator's `services/token-budget.ts` reads `fallback.ndjson` to amplify the throttle pressure signal — high fallback rates indicate the fleet is right at the quota edge and downstream agents should be more conservative.
