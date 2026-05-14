#!/bin/bash
# WaveX OS — launchd launcher for the local Paperclip dev server.
#
# Keeps the customer's Paperclip runtime (port 3100) supervised so the agent
# fleet survives logout / crash / reboot without the operator opening a
# terminal. Pairs with the LaunchAgent plist documented in
# docs/PAPERCLIP_AUTH_FIX.md.
#
# Env: sourced from $WAVEX_OS_STATE_DIR/state/.env (gitignored, operator-local).
set -euo pipefail

export HOME="${HOME:-$(eval echo "~$(id -un)")}"
export USER="${USER:-$(id -un)}"
export LOGNAME="${LOGNAME:-$USER}"
export PATH="/opt/homebrew/bin:/usr/local/bin:${HOME}/.local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

WAVEX_OS_STATE_DIR="${WAVEX_OS_STATE_DIR:-${HOME}/.wavex-os}"
ENV_FILE="${WAVEX_OS_STATE_DIR}/state/.env"
if [ -f "${ENV_FILE}" ]; then
  set -a
  # shellcheck disable=SC1090
  . "${ENV_FILE}"
  set +a
fi

REPO_DIR="${WAVEX_REPO_DIR:-${HOME}/wavex-os}"
cd "${REPO_DIR}"

exec pnpm --filter paperclip dev
