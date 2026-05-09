#!/usr/bin/env bash
# wavex-os tier-router T2 spawn shim.
#
# tier-router's invokeClaudeCode runtime spawns the configured `claudeBin`
# with arguments like `-p <prompt> [--output-format json]`. Our OAuth
# keychain wrapper at scripts/wrappers/claude-anthropic-direct.sh expects
# `exec` as its first arg before claude-cli args. This shim bridges the two
# by prepending `exec`.
#
# Set OP_OMEGA_CLAUDE_BIN to this script's absolute path (or pass via
# tier-router's options.claudeBin) to route every T2 call through the
# operator's Claude Max OAuth keychain. In production where ANTHROPIC_API_KEY
# is set as an env var, the wrapper short-circuits and uses the env value
# directly, so this same shim works in both modes.

set -euo pipefail

HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
WRAPPER="${HERE}/wrappers/claude-anthropic-direct.sh"

if [ ! -x "${WRAPPER}" ]; then
  echo "wavex-claude-spawn: wrapper not found or not executable: ${WRAPPER}" >&2
  exit 127
fi

exec "${WRAPPER}" exec "$@"
