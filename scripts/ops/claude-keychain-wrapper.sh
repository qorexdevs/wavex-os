#!/bin/bash
# WaveX OS — claude auth wrapper for Paperclip claude_local agents.
#
# ROOT CAUSE (2026-05-14, isolated on a live demo):
#   claude v2.1.x — when CLAUDE_CONFIG_DIR is EXPLICITLY set, claude reads
#   credentials from <dir>/.credentials.json and does NOT fall back to the
#   macOS login keychain. On a keychain-auth box that file doesn't exist,
#   so claude reports "Not logged in · Please run /login".
#   Paperclip's claude_local adapter set CLAUDE_CONFIG_DIR on every agent
#   spawn -> every incepted agent failed auth.
#
#   Proof:  env -i HOME USER LOGNAME PATH claude                    -> OK
#           env -i HOME USER LOGNAME PATH CLAUDE_CONFIG_DIR claude  -> "Not logged in"
#
# FIX (this wrapper):
#   - unset CLAUDE_CONFIG_DIR  -> claude defaults to ~/.claude + keychain
#   - drop a set-but-empty ANTHROPIC_API_KEY (also pushes claude off keychain)
#   - ensure USER / LOGNAME / HOME are present (claude needs them to locate
#     the login keychain when spawned from a non-login context like launchd)
#
# claude binary resolution: $WAVEX_CLAUDE_BIN if set, else `claude` on PATH.
set -euo pipefail

unset CLAUDE_CONFIG_DIR
[ -z "${ANTHROPIC_API_KEY:-}" ] && unset ANTHROPIC_API_KEY || true

export USER="${USER:-$(id -un)}"
export LOGNAME="${LOGNAME:-$USER}"
export HOME="${HOME:-$(eval echo "~${USER}")}"

exec "${WAVEX_CLAUDE_BIN:-claude}" "$@"
