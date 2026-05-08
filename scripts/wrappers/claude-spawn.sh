#!/bin/zsh
# WaveX OS — per-spawn execution wrapper for `claude --print` workers.
#
# This is the wrapper the orchestrator uses to start each agent run. It
# implements Layer 1 of the self-healing architecture (see
# docs/SELF_HEALING.md):
#   1. Reads the LIVE OAuth token from the credential store on every spawn.
#   2. Detects rate-limit / usage-limit responses → re-execs with a cheaper
#      Sonnet model (Sonnet 4.6 hits a separate quota tier from Opus 4.7).
#   3. Detects 401 / authentication_failed responses → calls the
#      orchestrator's /api/maintenance/oauth/refresh endpoint (Layer 2,
#      concurrency-locked), re-reads the credential store, and re-execs
#      with the SAME model. Sonnet shares the OAuth token; falling back
#      to Sonnet on a 401 just produces another 401.
#
# This is distinct from `claude-anthropic-direct.sh` (Phase E, the keychain
# probe wrapper used by the onboarding wizard's handoff step). That one
# answers "do credentials exist?". This one answers "run a worker now and
# auto-heal common failures".
#
# Configurable via env:
#   WAVEX_CLAUDE_BIN          path to the claude CLI (default: claude on PATH)
#   WAVEX_KEYCHAIN_SERVICE    keychain service name (default: Claude Code-credentials)
#   WAVEX_API_BASE            orchestrator base URL (default: http://127.0.0.1:3100)
#   WAVEX_FALLBACK_MODEL      model for usage-limit retries (default: claude-sonnet-4-6)
#   WAVEX_FALLBACK_LOG_DIR    where to log fallback events (default: ~/.wavex-os/state/wrapper-fallback-logs)

CLAUDE_BIN="${WAVEX_CLAUDE_BIN:-claude}"
KEYCHAIN_SERVICE="${WAVEX_KEYCHAIN_SERVICE:-Claude Code-credentials}"
API_BASE="${WAVEX_API_BASE:-http://127.0.0.1:3100}"
FALLBACK_MODEL="${WAVEX_FALLBACK_MODEL:-claude-sonnet-4-6}"
LOG_DIR="${WAVEX_FALLBACK_LOG_DIR:-$HOME/.wavex-os/state/wrapper-fallback-logs}"
mkdir -p "$LOG_DIR" 2>/dev/null

# Strip any inherited Anthropic-routing env vars so the CLI uses our token.
unset ANTHROPIC_BASE_URL
unset ANTHROPIC_AUTH_TOKEN
unset ANTHROPIC_API_KEY
unset OPENROUTER_API_KEY
unset ANTHROPIC_DEFAULT_OPUS_MODEL
unset ANTHROPIC_DEFAULT_SONNET_MODEL
unset ANTHROPIC_DEFAULT_HAIKU_MODEL
unset CLAUDE_CODE_SUBAGENT_MODEL

read_keychain_token() {
  if command -v security >/dev/null 2>&1; then
    KC_BLOB=$(security find-generic-password -w -s "$KEYCHAIN_SERVICE" 2>/dev/null)
    if [[ -n "$KC_BLOB" ]]; then
      printf '%s' "$KC_BLOB" | python3 -c 'import json,sys;print(json.load(sys.stdin)["claudeAiOauth"]["accessToken"])' 2>/dev/null
    fi
  fi
}

# Always pull the LIVE token; never trust a captured-at-provisioning .env.
unset CLAUDE_CODE_OAUTH_TOKEN
TOK=$(read_keychain_token)
[[ -n "$TOK" ]] && export CLAUDE_CODE_OAUTH_TOKEN="$TOK"

# Buffer output so the orchestrator's stream-json parser sees only ONE
# completed run (success or terminal failure), not the failed primary +
# the retry. The price is no progressive streaming on the primary.
RUN_OUT=$(mktemp -t wavex-spawn-out.XXXXXX)
RUN_ERR=$(mktemp -t wavex-spawn-err.XXXXXX)
trap 'rm -f "$RUN_OUT" "$RUN_ERR"' EXIT

"$CLAUDE_BIN" "$@" > "$RUN_OUT" 2> "$RUN_ERR"
PRIMARY_EXIT=$?

# Patterns that indicate a usage-limit or rate-limit failure.
USAGE_LIMIT_RE='"type":"rate_limit_error"|"api_error_status":429|"api_error_status":529|5-hour limit|extra usage required|usage_limit_exceeded'

# Patterns that indicate auth-token failure. NOTE: distinct from
# rate-limit. Sonnet shares the same OAuth token, so falling back to
# Sonnet on a 401 fixes nothing. Trigger refresh, then retry SAME model.
AUTH_FAIL_RE='"api_error_status":401|"error":"authentication_failed"|"type":"authentication_error"|Invalid authentication credentials'

# --- Usage-limit fallback: swap to Sonnet ---------------------------------
if grep -qE "$USAGE_LIMIT_RE" "$RUN_OUT" "$RUN_ERR" 2>/dev/null; then
  RETRY_ARGS=()
  SKIP_NEXT=0
  ORIG_MODEL=""
  for ARG in "$@"; do
    if [ $SKIP_NEXT -eq 1 ]; then ORIG_MODEL="$ARG"; SKIP_NEXT=0; continue; fi
    if [ "$ARG" = "--model" ]; then SKIP_NEXT=1; continue; fi
    RETRY_ARGS+=("$ARG")
  done
  RETRY_ARGS+=("--model" "$FALLBACK_MODEL")

  TS=$(date +%s)
  echo "{\"ts\":$TS,\"event\":\"model_fallback\",\"original_model\":\"${ORIG_MODEL:-default}\",\"new_model\":\"$FALLBACK_MODEL\",\"reason\":\"usage_limit_or_rate_limit\",\"primary_exit\":$PRIMARY_EXIT}" >> "$LOG_DIR/fallback.ndjson"

  echo "{\"type\":\"system\",\"subtype\":\"model_fallback\",\"reason\":\"usage_limit_hit\",\"original_model\":\"${ORIG_MODEL:-default}\",\"retrying_with\":\"$FALLBACK_MODEL\"}"
  exec "$CLAUDE_BIN" "${RETRY_ARGS[@]}"
fi

# --- Auth-failure recovery: refresh, then retry SAME model ----------------
if grep -qE "$AUTH_FAIL_RE" "$RUN_OUT" "$RUN_ERR" 2>/dev/null; then
  TS=$(date +%s)
  REFRESH_RESP=$(curl -sS -m 20 -X POST -H "Content-Type: application/json" -d '{}' \
    "$API_BASE/api/maintenance/oauth/refresh" 2>/dev/null)
  REFRESH_OK=$(printf '%s' "$REFRESH_RESP" | python3 -c 'import json,sys
try: d=json.load(sys.stdin); print("yes" if d.get("ok") else "no")
except: print("no")' 2>/dev/null)

  echo "{\"ts\":$TS,\"event\":\"oauth_recovery\",\"refresh_ok\":\"${REFRESH_OK}\",\"primary_exit\":$PRIMARY_EXIT}" >> "$LOG_DIR/fallback.ndjson"

  if [ "$REFRESH_OK" = "yes" ]; then
    unset CLAUDE_CODE_OAUTH_TOKEN
    TOK=$(read_keychain_token)
    [[ -n "$TOK" ]] && export CLAUDE_CODE_OAUTH_TOKEN="$TOK"
    echo "{\"type\":\"system\",\"subtype\":\"oauth_recovery\",\"reason\":\"401_then_refresh_ok\",\"retrying_same_model\":true}"
    exec "$CLAUDE_BIN" "$@"
  fi
  # Refresh failed — fall through and emit the original 401. The
  # maintenance UI's expired-status alert is the human-tap fallback.
fi

# No fallback condition matched (or refresh failed): emit original output.
cat "$RUN_OUT"
[ -s "$RUN_ERR" ] && cat "$RUN_ERR" >&2
exit $PRIMARY_EXIT
