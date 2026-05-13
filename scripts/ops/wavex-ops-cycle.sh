#!/usr/bin/env bash
# WaveX OS — operator-side ops cycle wrapper.
#
# Loaded by launchd (com.wavex-os.ops-cycle). Sources env, runs the cycle
# script, never fails the launchd job (cycle script handles its own
# errors and always exits 0).

set -uo pipefail

STATE_DIR="${STATE_DIR:-$HOME/.wavex-os/state}"
ENV_FILE="$STATE_DIR/.env"
REPO_ROOT="${REPO_ROOT:-$HOME/wavex-os}"
CYCLE_SCRIPT="${CYCLE_SCRIPT:-$REPO_ROOT/scripts/ops/wavex-ops-cycle.mjs}"
LOG="$STATE_DIR/wavex-ops-cycle.log"

# Source .env if present so SUPABASE_URL, telegram creds etc. land in env.
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

# Resolve node — prefer the one in $PATH, fall back to homebrew/system locations
NODE_BIN="$(command -v node 2>/dev/null \
  || ls /opt/homebrew/bin/node /usr/local/bin/node 2>/dev/null | head -1)"
if [ -z "$NODE_BIN" ]; then
  echo "[$(date -u +%FT%TZ)] wavex-ops-cycle: node not found in PATH" >> "$LOG"
  exit 0
fi

if [ ! -f "$CYCLE_SCRIPT" ]; then
  echo "[$(date -u +%FT%TZ)] wavex-ops-cycle: cycle script missing at $CYCLE_SCRIPT" >> "$LOG"
  exit 0
fi

# Run the cycle. It exits 0 even on internal errors (writes them to events).
"$NODE_BIN" "$CYCLE_SCRIPT" 2>&1 | tee -a "$LOG"

exit 0
