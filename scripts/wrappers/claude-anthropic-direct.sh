#!/usr/bin/env bash
# WaveX OS — Claude Max OAuth wrapper
#
# Resolves a Claude Max OAuth token from the user's local credential store
# and exports it as ANTHROPIC_API_KEY for the wrapped Claude CLI invocation.
# Token never leaves the user's machine.
#
# Usage:
#   wavex-claude probe                       # check that creds exist + are usable; print { plan, ok }
#   wavex-claude exec <claude-cli-args...>   # run claude CLI with creds
#   wavex-claude --help
#
# Environment overrides (precedence: env > keychain > stub):
#   ANTHROPIC_API_KEY      — direct override; if set, used as-is
#   WAVEX_CLAUDE_STUB=1    — return synthetic creds (for tests / pre-Phase-E demos)
#
# Phase E: macOS keychain only. Linux/Windows land in Phase F.

set -euo pipefail

CLAUDE_BIN="${WAVEX_CLAUDE_BIN:-claude}"
KEYCHAIN_SERVICE="${WAVEX_CLAUDE_KEYCHAIN_SERVICE:-Claude Code-credentials}"

c_red()   { printf '\033[31m%s\033[0m' "$*"; }
c_green() { printf '\033[32m%s\033[0m' "$*"; }
c_dim()   { printf '\033[2m%s\033[0m' "$*"; }

die() { echo "$(c_red "wavex-claude error:") $*" >&2; exit 1; }

probe_macos_keychain() {
  # Returns 0 if creds found and prints them on stdout
  command -v security >/dev/null 2>&1 || return 1
  security find-generic-password -s "${KEYCHAIN_SERVICE}" -w 2>/dev/null
}

resolve_credential() {
  # Precedence: env override > stub > keychain
  if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
    printf '%s' "${ANTHROPIC_API_KEY}"
    echo "env" >&3
    return 0
  fi

  if [ "${WAVEX_CLAUDE_STUB:-0}" = "1" ]; then
    # Synthetic — never used for real inference, only for plumbing tests
    printf '%s' "sk-ant-stub-WAVEX-OS-PHASE-E"
    echo "stub" >&3
    return 0
  fi

  case "$(uname -s)" in
    Darwin)
      local cred
      if cred=$(probe_macos_keychain); then
        printf '%s' "${cred}"
        echo "keychain-macos" >&3
        return 0
      fi
      return 1
      ;;
    Linux)
      # Phase F: implement secret-tool / libsecret lookup
      return 1
      ;;
    *)
      return 1
      ;;
  esac
}

cmd_probe() {
  local cred source
  exec 3>/tmp/wavex-claude-probe-source.$$
  if cred=$(resolve_credential 2>/dev/null); then
    source=$(cat /tmp/wavex-claude-probe-source.$$)
    rm -f /tmp/wavex-claude-probe-source.$$
    # Don't echo the cred — only its source + presence
    cat <<EOF
{
  "ok": true,
  "source": "${source}",
  "plan": "claude_max_detected",
  "note": "Token resolved from ${source}. Not transmitted to any remote service."
}
EOF
    return 0
  fi
  rm -f /tmp/wavex-claude-probe-source.$$
  cat <<EOF
{
  "ok": false,
  "source": "none",
  "note": "No Claude Max credential found. Sign in with the Claude desktop app or set ANTHROPIC_API_KEY, then retry."
}
EOF
  return 2
}

cmd_exec() {
  if ! command -v "${CLAUDE_BIN}" >/dev/null 2>&1; then
    die "claude CLI not found on PATH (\$WAVEX_CLAUDE_BIN=${CLAUDE_BIN}). Install from claude.ai/code."
  fi

  local cred source
  exec 3>/tmp/wavex-claude-exec-source.$$
  if ! cred=$(resolve_credential 2>/dev/null); then
    rm -f /tmp/wavex-claude-exec-source.$$
    die "no Claude credential found — cannot execute"
  fi
  source=$(cat /tmp/wavex-claude-exec-source.$$ 2>/dev/null || echo "?")
  rm -f /tmp/wavex-claude-exec-source.$$

  if [ "${WAVEX_CLAUDE_VERBOSE:-0}" = "1" ]; then
    echo "$(c_dim "[wavex-claude] using credential from ${source}")" >&2
  fi

  ANTHROPIC_API_KEY="${cred}" exec "${CLAUDE_BIN}" "$@"
}

cmd_help() {
  cat <<'EOF'
wavex-claude — Claude Max OAuth wrapper

Subcommands:
  probe                  Check that credentials are available; print JSON status.
  exec <args...>         Run claude CLI with credentials injected.
  --help, -h             Show this message.

Environment overrides:
  ANTHROPIC_API_KEY      Direct override (used as-is when set).
  WAVEX_CLAUDE_STUB=1    Return synthetic creds (testing only).
  WAVEX_CLAUDE_BIN       Path to claude CLI (default: "claude" on PATH).
  WAVEX_CLAUDE_VERBOSE=1 Log credential source to stderr on each exec.

Examples:
  wavex-claude probe
  wavex-claude exec --version
  WAVEX_CLAUDE_VERBOSE=1 wavex-claude exec /agent run my-agent
EOF
}

main() {
  case "${1:-help}" in
    probe)         shift; cmd_probe "$@" ;;
    exec)          shift; cmd_exec "$@" ;;
    -h|--help|help) cmd_help ;;
    *)             die "unknown subcommand: $1 (try --help)" ;;
  esac
}

main "$@"
