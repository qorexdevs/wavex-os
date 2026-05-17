#!/usr/bin/env bash
# wavex-os tier-router T2 spawn shim.
#
# tier-router's invokeClaudeCode runtime spawns the configured `claudeBin`
# with arguments like `-p <prompt> [--output-format json]`. We pass through
# to the local `claude` CLI (or whichever binary WAVEX_CLAUDE_BIN points at).
#
# Credential resolution:
#   - dev mode (ANTHROPIC_API_KEY unset OR a known stub): we DO NOT inject
#     anything. claude CLI uses its own OAuth keychain flow — this is what
#     `claude -p "say ok"` does interactively, and it works for Max plans
#     because claude CLI handles the OAuth bearer/refresh exchange itself.
#     Forcing the OAuth token into ANTHROPIC_API_KEY (as the legacy wrapper
#     does) makes claude treat it as a raw API key and fail with
#     "Invalid API key · Fix external API key".
#   - production / api-key mode (ANTHROPIC_API_KEY set to a real `sk-ant-…`
#     key): we leave it alone — claude CLI uses it directly.
#
# WAVEX_CLAUDE_VERBOSE=1 prints the chosen mode to stderr.

set -euo pipefail

CLAUDE_BIN="${WAVEX_CLAUDE_BIN:-claude}"

if ! command -v "${CLAUDE_BIN}" >/dev/null 2>&1; then
  echo "wavex-claude-spawn: claude CLI not found on PATH (\$WAVEX_CLAUDE_BIN=${CLAUDE_BIN})" >&2
  exit 127
fi

# Detect whether the env-supplied key is a real API key or a stub/empty.
# Real Anthropic API keys start with "sk-ant-". Anything else (empty, a
# keychain bearer, a placeholder) gets cleared so claude uses OAuth.
KEY="${ANTHROPIC_API_KEY:-}"
if [ -z "${KEY}" ] || [[ "${KEY}" != sk-ant-* ]]; then
  unset ANTHROPIC_API_KEY
  if [ "${WAVEX_CLAUDE_VERBOSE:-0}" = "1" ]; then
    echo "[wavex-claude-spawn] mode=oauth (claude CLI keychain)" >&2
  fi
else
  if [ "${WAVEX_CLAUDE_VERBOSE:-0}" = "1" ]; then
    echo "[wavex-claude-spawn] mode=apikey (ANTHROPIC_API_KEY)" >&2
  fi
fi

# Allow read-only tools by default so the deep-dive enrichment in Pillar 1
# (and any future T2 call that needs to fetch context) actually works in
# non-interactive `-p` mode. Without this, claude denies tool use silently
# and returns "The WebFetch needs your approval" prose instead of fetching.
#
# Whitelist is intentionally read-only: WebFetch + WebSearch + Read + Grep
# + Glob + Bash for safe shell probes. No Edit/Write/etc. — T2 must not
# mutate state. Override with WAVEX_CLAUDE_ALLOWED_TOOLS to expand/restrict.
ALLOWED_TOOLS="${WAVEX_CLAUDE_ALLOWED_TOOLS:-WebFetch,WebSearch,Read,Grep,Glob,Bash}"

# ── Token usage capture (always-on when --output-format json) ─────────────
# Claude CLI's JSON output includes a `usage` block with input/output/cache
# tokens. The vendored tier-router parses it but discards token counts at
# the route boundary, so this shim is the only stable point to record them.
# We append one JSONL event per call to ~/.wavex-os/state/t2-events.jsonl
# and a node-side helper attributes events to (companyId, phase) by time
# window. See packages/wavex-os-server/src/lib/token-accounting.ts.
JSON_MODE=0
prev_arg=""
for arg in "$@"; do
  if [ "${prev_arg}" = "--output-format" ] && [ "${arg}" = "json" ]; then
    JSON_MODE=1
    break
  fi
  prev_arg="${arg}"
done

now_ms() {
  /usr/bin/perl -MTime::HiRes=time -e 'printf("%d", time*1000)' 2>/dev/null || echo "0"
}

write_token_event() {
  # $1=stdout-temp-file, $2=started_ms, $3=ended_ms, $4=exit_code
  local outfile="$1" started="$2" ended="$3" exit_code="$4"
  local events_dir="${WAVEX_OS_STATE_DIR:-${HOME}/.wavex-os}/state"
  mkdir -p "${events_dir}"
  /usr/bin/env node --eval "
    (() => {
      const fs = require('node:fs');
      let parsed;
      try { parsed = JSON.parse(fs.readFileSync('${outfile}', 'utf8')); } catch { return; }
      const u = parsed.usage || {};
      const ev = {
        ts_iso: new Date(${ended}).toISOString(),
        pid: process.pid,
        started_ms: ${started},
        ended_ms: ${ended},
        duration_ms: ${ended} - ${started},
        input_tokens: u.input_tokens | 0,
        output_tokens: u.output_tokens | 0,
        cached_input_tokens: u.cache_read_input_tokens | 0,
        cost_usd: parsed.total_cost_usd || 0,
        exit_code: ${exit_code},
      };
      fs.appendFileSync('${events_dir}/t2-events.jsonl', JSON.stringify(ev) + '\\n');
    })();
  " 2>/dev/null || true
}

# ── Inference progress tracking (dev/transparency) ────────────────────────
# When WAVEX_INFERENCE_TRACK=1, write start/heartbeat/complete events to a
# state file the UI can poll for real-time T2 progress. Replaces the fake
# timer-based progress indicator with truth.
TRACK="${WAVEX_INFERENCE_TRACK:-0}"
if [ "${TRACK}" = "1" ]; then
  STATE_DIR="${WAVEX_OS_STATE_DIR:-${HOME}/.wavex-os}/state"
  STATUS_FILE="${STATE_DIR}/inference-current.json"
  mkdir -p "${STATE_DIR}"
  STARTED_MS=$(now_ms)

  # In JSON mode we capture stdout to a temp file so we can parse the usage
  # block after claude exits. The temp file is then catted to stdout on the
  # way out, so callers see the same bytes they would have received.
  if [ "${JSON_MODE}" = "1" ]; then
    STDOUT_TMP=$(/usr/bin/mktemp -t wavex-claude.XXXXXX)
    trap 'rm -f "${STDOUT_TMP}"' EXIT
    "${CLAUDE_BIN}" --allowedTools "${ALLOWED_TOOLS}" "$@" > "${STDOUT_TMP}" &
  else
    "${CLAUDE_BIN}" --allowedTools "${ALLOWED_TOOLS}" "$@" &
  fi
  CLAUDE_PID=$!

  # Background heartbeat — updates status every 2s while claude is alive.
  (
    while kill -0 "${CLAUDE_PID}" 2>/dev/null; do
      NOW_MS=$(/usr/bin/perl -MTime::HiRes=time -e 'printf("%d", time*1000)' 2>/dev/null || echo "0")
      ELAPSED=$((NOW_MS - STARTED_MS))
      printf '{"started_at_ms":%d,"pid":%d,"alive":true,"elapsed_ms":%d,"completed":false,"updated_at_ms":%d}\n' \
        "${STARTED_MS}" "${CLAUDE_PID}" "${ELAPSED}" "${NOW_MS}" > "${STATUS_FILE}.tmp" \
        && mv -f "${STATUS_FILE}.tmp" "${STATUS_FILE}"
      sleep 2
    done
  ) &
  HEARTBEAT_PID=$!

  # Wait for claude to exit
  wait "${CLAUDE_PID}"
  EXIT_CODE=$?

  # Stop heartbeat
  kill "${HEARTBEAT_PID}" 2>/dev/null || true

  # Write final completion status
  END_MS=$(now_ms)
  ELAPSED=$((END_MS - STARTED_MS))
  printf '{"started_at_ms":%d,"pid":%d,"alive":false,"elapsed_ms":%d,"completed":true,"exit_code":%d,"updated_at_ms":%d}\n' \
    "${STARTED_MS}" "${CLAUDE_PID}" "${ELAPSED}" "${EXIT_CODE}" "${END_MS}" > "${STATUS_FILE}"

  # JSON mode: forward captured stdout + record token usage event.
  if [ "${JSON_MODE}" = "1" ]; then
    /bin/cat "${STDOUT_TMP}"
    if [ "${EXIT_CODE}" = "0" ]; then
      write_token_event "${STDOUT_TMP}" "${STARTED_MS}" "${END_MS}" "${EXIT_CODE}"
    fi
  fi

  exit "${EXIT_CODE}"
fi

# Default path (no progress tracking). In JSON mode we still capture stdout
# so token usage events are recorded; otherwise straight exec.
if [ "${JSON_MODE}" = "1" ]; then
  STDOUT_TMP=$(/usr/bin/mktemp -t wavex-claude.XXXXXX)
  trap 'rm -f "${STDOUT_TMP}"' EXIT
  STARTED_MS=$(now_ms)
  "${CLAUDE_BIN}" --allowedTools "${ALLOWED_TOOLS}" "$@" > "${STDOUT_TMP}"
  EXIT_CODE=$?
  END_MS=$(now_ms)
  /bin/cat "${STDOUT_TMP}"
  if [ "${EXIT_CODE}" = "0" ]; then
    write_token_event "${STDOUT_TMP}" "${STARTED_MS}" "${END_MS}" "${EXIT_CODE}"
  fi
  exit "${EXIT_CODE}"
fi

exec "${CLAUDE_BIN}" --allowedTools "${ALLOWED_TOOLS}" "$@"
