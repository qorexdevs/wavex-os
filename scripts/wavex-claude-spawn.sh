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

# Inject --allowedTools BEFORE the rest of the args (which include `-p <prompt>`).
exec "${CLAUDE_BIN}" --allowedTools "${ALLOWED_TOOLS}" "$@"
