#!/usr/bin/env bash
# Demo pre-flight — run this RIGHT BEFORE a live demo to confirm every
# layer is green. Exits non-zero on any failure so you know to debug.
#
#   bash scripts/demo-preflight.sh
#
# Checks:
#   1. wavex UI on :5173
#   2. wavex mock-core API on :3101
#   3. paperclip API on :3100 (real Paperclip, not false-positive)
#   4. paperclip UI on :5174
#   5. claude CLI auth works (single fast probe)
#   6. wavex companies DB is empty (fresh state for demo)
#   7. paperclip companies are empty (fresh handoff target)
#   8. WAVEX_E2E_T2 environment hint
#
# Output is color-coded so issues jump out.

set -u
GREEN='\033[0;32m'
RED='\033[0;31m'
YEL='\033[0;33m'
NC='\033[0m'

fails=0
warn=0
check() {
  local label="$1" actual="$2" expected="$3"
  if [ "$actual" = "$expected" ]; then
    printf "  ${GREEN}✓${NC} %-40s %s\n" "$label" "$actual"
  else
    printf "  ${RED}✗${NC} %-40s actual: %s · expected: %s\n" "$label" "$actual" "$expected"
    fails=$((fails + 1))
  fi
}
warn_check() {
  local label="$1" actual="$2" expected="$3" hint="$4"
  if [ "$actual" = "$expected" ]; then
    printf "  ${GREEN}✓${NC} %-40s %s\n" "$label" "$actual"
  else
    printf "  ${YEL}⚠${NC} %-40s actual: %s · %s\n" "$label" "$actual" "$hint"
    warn=$((warn + 1))
  fi
}

echo "── service ports ──"
check "wavex UI (5173)"             "$(curl -s -o /dev/null -w %{http_code} --max-time 2 http://localhost:5173/         2>/dev/null)" "200"
check "wavex API (3101)"            "$(curl -s -o /dev/null -w %{http_code} --max-time 2 http://127.0.0.1:3101/api/companies 2>/dev/null)" "200"
check "paperclip API (3100)"        "$(curl -s -o /dev/null -w %{http_code} --max-time 2 http://127.0.0.1:3100/api/health 2>/dev/null)" "200"
check "paperclip UI (5174)"         "$(curl -s -o /dev/null -w %{http_code} --max-time 2 http://localhost:5174/         2>/dev/null)" "200"

echo
echo "── paperclip identity (not a false-positive on wavex's mock-core) ──"
pclip_mode=$(curl -s --max-time 2 http://127.0.0.1:3100/api/health 2>/dev/null | node --eval 'let s=""; process.stdin.on("data",c=>s+=c); process.stdin.on("end",()=>{try{const j=JSON.parse(s);console.log(j.deploymentMode||"")}catch{console.log("")}})')
check "deploymentMode field present" "${pclip_mode:-MISSING}" "local_trusted"

echo
echo "── claude CLI ──"
echo -n "  probing claude (10s timeout)... "
probe=$(/Users/dylanriedweg/wavex-os/scripts/wavex-claude-spawn.sh -p "say only the word ok" --output-format json 2>/dev/null | node --eval 'let s=""; process.stdin.on("data",c=>s+=c); process.stdin.on("end",()=>{try{const j=JSON.parse(s);console.log(j.result?.trim()||"EMPTY")}catch{console.log("PARSE_ERR")}})')
if [ "$probe" = "ok" ] || [ "$probe" = "Ok" ] || [ "$probe" = "OK" ]; then
  printf "${GREEN}✓${NC} '%s' (auth working)\n" "$probe"
else
  printf "${RED}✗${NC} probe returned: '%s'\n" "$probe"
  fails=$((fails + 1))
fi

echo
echo "── data state (empty = fresh demo) ──"
wavex_co_count=$(curl -s --max-time 2 http://127.0.0.1:3101/api/companies 2>/dev/null | node --eval 'let s=""; process.stdin.on("data",c=>s+=c); process.stdin.on("end",()=>{try{console.log(JSON.parse(s).companies?.length||0)}catch{console.log("?")}})')
pclip_co_count=$(curl -s --max-time 2 http://127.0.0.1:3100/api/companies 2>/dev/null | node --eval 'let s=""; process.stdin.on("data",c=>s+=c); process.stdin.on("end",()=>{try{const j=JSON.parse(s);console.log((Array.isArray(j)?j:j.companies||[]).length)}catch{console.log("?")}})')
warn_check "wavex companies"        "$wavex_co_count" "0" "rest will appear in onboarding picker"
warn_check "paperclip companies"    "$pclip_co_count" "0" "rest will appear in paperclip dashboard"

echo
if [ "$fails" -eq 0 ] && [ "$warn" -eq 0 ]; then
  printf "${GREEN}✓ all checks passed — demo ready${NC}\n"
  exit 0
elif [ "$fails" -eq 0 ]; then
  printf "${YEL}⚠ $warn warning(s) but no failures — demo will work, may show stale companies${NC}\n"
  exit 0
else
  printf "${RED}✗ $fails failure(s) — fix before demoing${NC}\n"
  exit 1
fi
