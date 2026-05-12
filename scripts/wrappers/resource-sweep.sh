#!/usr/bin/env bash
# WaveX OS — platform-level resource sweep.
#
# Runs every 15min via launchd (com.wavex-os.resource-sweep).
# Independent of the agent fleet — fires even when fleet is paused.
#
# Job:
#   1. Read disk + RAM pressure.
#   2. If disk > 70%, run reproducible-artifact cleanup (paperclipai
#      worktree:cleanup --reproducible-only).
#   3. If disk > 80%, ALSO call /api/maintenance/spawn-throttle.
#   4. If disk > 90%, file a critical issue + Telegram alert.
#   5. POST snapshot to /api/maintenance/resource-snapshot for the System
#      Reliability agent's KPI history.
#
# NEVER runs raw rm -rf. NEVER touches Postgres directly. Hard-rules
# compliance per Paperclip CLI invariants.

set -uo pipefail

COMPANY_ID="${COMPANY_ID:-}"
API_BASE="${API_BASE:-http://127.0.0.1:3100}"
STATE_DIR="${STATE_DIR:-$HOME/.wavex-os/state}"
LOG="${STATE_DIR}/resource-sweep.log"

# Thresholds (tunable via env)
DISK_YELLOW_PCT="${DISK_YELLOW_PCT:-70}"
DISK_ORANGE_PCT="${DISK_ORANGE_PCT:-80}"
DISK_RED_PCT="${DISK_RED_PCT:-90}"
RAM_PRESSURE_YELLOW_MBPS="${RAM_PRESSURE_YELLOW_MBPS:-10}"
RAM_PRESSURE_ORANGE_MBPS="${RAM_PRESSURE_ORANGE_MBPS:-50}"

mkdir -p "$STATE_DIR"
ts() { date -u "+%Y-%m-%dT%H:%M:%SZ"; }
log() { printf '%s %s\n' "$(ts)" "$*" >> "$LOG"; }

# ── 1. Disk ────────────────────────────────────────────────────────────
disk_pct=$(df / | tail -1 | awk '{gsub("%",""); print $5+0}')
log "disk_pct=${disk_pct}"

# ── 2. RAM pressure (swap delta over 1s) ───────────────────────────────
ram_pressure=0
if command -v vm_stat >/dev/null; then
  swap_before=$(sysctl -n vm.swapusage 2>/dev/null | awk '{print $9}' | tr -d 'M' 2>/dev/null || echo 0)
  sleep 1
  swap_after=$(sysctl -n vm.swapusage 2>/dev/null | awk '{print $9}' | tr -d 'M' 2>/dev/null || echo 0)
  # Difference in MB/s of swap "used" change — approximation; sustained swap usage growth = pressure.
  ram_pressure=$(awk -v a="$swap_after" -v b="$swap_before" 'BEGIN{d=a-b; if (d<0) d=0; printf "%.1f", d}')
fi
log "ram_pressure_mbps=${ram_pressure}"

# ── 3. Action ladder (disk dominates) ──────────────────────────────────
actions=""
disk_freed_pct=0

if [ "$disk_pct" -ge "$DISK_RED_PCT" ]; then
  log "RED disk=${disk_pct}% — page operator + cleanup + throttle"
  # Reproducible cleanup via paperclipai CLI (NEVER raw rm -rf)
  if command -v npx >/dev/null; then
    cleanup_out=$(npx --no-install paperclipai worktree:cleanup --reproducible-only 2>&1 || true)
    log "cleanup: ${cleanup_out}"
  fi
  curl -sS -X POST -H 'Content-Type: application/json' \
    -d '{"enabled":true,"reason":"resource-sweep disk_pct >= 90"}' \
    "${API_BASE}/api/maintenance/spawn-throttle" >> "$LOG" 2>&1 || true
  curl -sS -X POST -H 'Content-Type: application/json' \
    -d "{\"severity\":\"red\",\"metric\":\"disk_pct\",\"value\":${disk_pct},\"companyId\":\"${COMPANY_ID}\"}" \
    "${API_BASE}/api/maintenance/page-operator" >> "$LOG" 2>&1 || true
  actions="cleanup,throttle,page"

elif [ "$disk_pct" -ge "$DISK_ORANGE_PCT" ]; then
  log "ORANGE disk=${disk_pct}% — cleanup + throttle"
  if command -v npx >/dev/null; then
    cleanup_out=$(npx --no-install paperclipai worktree:cleanup --reproducible-only 2>&1 || true)
    log "cleanup: ${cleanup_out}"
  fi
  curl -sS -X POST -H 'Content-Type: application/json' \
    -d "{\"enabled\":true,\"reason\":\"resource-sweep disk_pct=${disk_pct}\"}" \
    "${API_BASE}/api/maintenance/spawn-throttle" >> "$LOG" 2>&1 || true
  actions="cleanup,throttle"

elif [ "$disk_pct" -ge "$DISK_YELLOW_PCT" ]; then
  log "YELLOW disk=${disk_pct}% — cleanup only"
  if command -v npx >/dev/null; then
    cleanup_out=$(npx --no-install paperclipai worktree:cleanup --reproducible-only 2>&1 || true)
    log "cleanup: ${cleanup_out}"
  fi
  actions="cleanup"
fi

# Re-measure after cleanup
disk_pct_after=$(df / | tail -1 | awk '{gsub("%",""); print $5+0}')
disk_freed_pct=$(( disk_pct - disk_pct_after ))

# ── 4. RAM ladder ──────────────────────────────────────────────────────
ram_pressure_int=$(printf '%.0f' "$ram_pressure")
if [ "$ram_pressure_int" -ge "$RAM_PRESSURE_ORANGE_MBPS" ]; then
  log "ORANGE ram_pressure=${ram_pressure} MB/s — throttle + auto-pause spinners"
  curl -sS -X POST -H 'Content-Type: application/json' \
    -d "{\"enabled\":true,\"reason\":\"resource-sweep ram_pressure=${ram_pressure}\"}" \
    "${API_BASE}/api/maintenance/spawn-throttle" >> "$LOG" 2>&1 || true
  curl -sS -X POST -H 'Content-Type: application/json' \
    -d "{\"companyId\":\"${COMPANY_ID}\",\"dryRun\":false}" \
    "${API_BASE}/api/maintenance/auto-pause-spinners" >> "$LOG" 2>&1 || true
  actions="${actions},ram-throttle,pause-spinners"
elif [ "$ram_pressure_int" -ge "$RAM_PRESSURE_YELLOW_MBPS" ]; then
  log "YELLOW ram_pressure=${ram_pressure} MB/s — pause spinners"
  curl -sS -X POST -H 'Content-Type: application/json' \
    -d "{\"companyId\":\"${COMPANY_ID}\",\"dryRun\":false}" \
    "${API_BASE}/api/maintenance/auto-pause-spinners" >> "$LOG" 2>&1 || true
  actions="${actions},pause-spinners"
fi

# ── 5. Post snapshot to System Reliability agent ────────────────────────
curl -sS -X POST -H 'Content-Type: application/json' \
  -d "{\"companyId\":\"${COMPANY_ID}\",\"disk_pct\":${disk_pct},\"disk_pct_after\":${disk_pct_after},\"disk_freed_pct\":${disk_freed_pct},\"ram_pressure_mbps\":${ram_pressure},\"actions\":\"${actions}\",\"ts\":\"$(ts)\"}" \
  "${API_BASE}/api/maintenance/resource-snapshot" >> "$LOG" 2>&1 || true

log "done disk=${disk_pct}% -> ${disk_pct_after}% (freed=${disk_freed_pct}pp) ram=${ram_pressure} actions=${actions:-none}"
exit 0
