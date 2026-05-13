#!/usr/bin/env bash
# wavex-os one-liner installer for macOS + Linux.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/aimerdoux/wavex-os/main/install.sh | bash
#
# What it does:
#   1. Checks Node 20+, pnpm 8+, git. Installs anything missing via Homebrew
#      (macOS) or apt (Debian/Ubuntu). On other distros, prints the missing
#      command and exits 1.
#   2. Clones the repo into $HOME/wavex-os (or $WAVEX_OS_DIR).
#   3. Runs `pnpm install`.
#   4. Starts `pnpm dev` and opens http://localhost:5173 in the default browser.
#
# Env overrides:
#   WAVEX_OS_DIR        — where to clone (default: $HOME/wavex-os)
#   ANTHROPIC_API_KEY   — Pool A inference key (optional; falls back to T1 stubs)
#   WAVEX_INFERENCE_MODE — "apikey" if ANTHROPIC_API_KEY is set, else unset
set -euo pipefail

WAVEX_OS_DIR="${WAVEX_OS_DIR:-$HOME/wavex-os}"
REPO_URL="${REPO_URL:-https://github.com/aimerdoux/wavex-os.git}"

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
note() { printf '  %s\n' "$1"; }
warn() { printf '\033[33m  ! %s\033[0m\n' "$1"; }
ok()   { printf '\033[32m  ✓ %s\033[0m\n' "$1"; }
die()  { printf '\033[31m  ✗ %s\033[0m\n' "$1" >&2; exit 1; }

bold "wavex-os installer"

OS="$(uname -s)"
if [ "$OS" = "Darwin" ]; then
  INSTALL_NODE="brew install node@20"
  INSTALL_PNPM="brew install pnpm"
  INSTALL_GIT="brew install git"
  PKG_MANAGER="brew"
elif [ "$OS" = "Linux" ]; then
  if command -v apt-get >/dev/null 2>&1; then
    INSTALL_NODE="curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
    INSTALL_PNPM="npm install -g pnpm@8"
    INSTALL_GIT="sudo apt-get install -y git"
    PKG_MANAGER="apt"
  else
    PKG_MANAGER="manual"
  fi
else
  die "Unsupported OS: $OS. Try the manual install at https://github.com/aimerdoux/wavex-os"
fi

bold "[1/4] Checking prereqs"
need_install=()
command -v git  >/dev/null 2>&1 && ok "git installed"  || need_install+=("git")
command -v node >/dev/null 2>&1 && {
  node_major="$(node --version | sed 's/v//;s/\..*//')"
  if [ "$node_major" -ge 20 ]; then ok "node $(node --version)"
  else warn "node $(node --version) is too old; need v20+"; need_install+=("node"); fi
} || need_install+=("node")
command -v pnpm >/dev/null 2>&1 && ok "pnpm $(pnpm --version)" || need_install+=("pnpm")

if [ "${#need_install[@]}" -gt 0 ]; then
  bold "[2/4] Installing missing tools: ${need_install[*]}"
  if [ "$PKG_MANAGER" = "brew" ] && ! command -v brew >/dev/null 2>&1; then
    note "Installing Homebrew first…"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  fi
  for tool in "${need_install[@]}"; do
    case "$tool" in
      git)  eval "$INSTALL_GIT"  ;;
      node) eval "$INSTALL_NODE" ;;
      pnpm) eval "$INSTALL_PNPM" ;;
    esac
  done
  ok "tools installed"
else
  bold "[2/4] All prereqs already present"
fi

bold "[3/4] Cloning + installing"
if [ -d "$WAVEX_OS_DIR" ]; then
  note "$WAVEX_OS_DIR exists — pulling latest"
  cd "$WAVEX_OS_DIR"
  git pull --ff-only
else
  git clone "$REPO_URL" "$WAVEX_OS_DIR"
  cd "$WAVEX_OS_DIR"
fi
ok "cloned to $WAVEX_OS_DIR"

note "pnpm install (this can take 3–8 min on first run)…"
pnpm install
ok "deps installed"

note "building vendored op-omega plugins (~30 s)…"
pnpm -r --filter "./vendor/op-omega/*" build
ok "vendored plugins built"

bold "[4/4] Configuring inference + starting dev server"

# Default: route Pool A (wizard's T2 enrichment) through the WaveX-hosted
# inference hub. Customers don't need their own Claude Max — the operator's
# subscription serves their onboarding inference under a session token.
# Override by editing ~/.wavex-os/inference.env or exporting env vars.
HUB_URL="${WAVEX_INFERENCE_HUB_URL:-https://catalogue-sea-such-manchester.trycloudflare.com}"
INFERENCE_ENV="$HOME/.wavex-os/inference.env"
mkdir -p "$(dirname "$INFERENCE_ENV")"
if [ ! -f "$INFERENCE_ENV" ]; then
  cat > "$INFERENCE_ENV" <<EOF
# wavex-os Pool A inference config (written by install.sh).
# Edit to change hub URL or switch to local-OAuth/api-key mode.
WAVEX_INFERENCE_MODE=hosted
WAVEX_INFERENCE_HUB_URL=$HUB_URL
EOF
  chmod 600 "$INFERENCE_ENV"
  ok "wrote $INFERENCE_ENV (hosted mode, hub=$HUB_URL)"
else
  ok "$INFERENCE_ENV already present — keeping existing config"
fi

note "Vite UI on http://localhost:5173"
note "mock-core API on http://localhost:3101"
note ""
note "Press Ctrl+C to stop. Re-run with: cd $WAVEX_OS_DIR && pnpm dev"
note ""

# Open browser in background once Vite is up
(
  for _ in $(seq 1 60); do
    if curl -sf --max-time 1 http://localhost:5173 >/dev/null 2>&1; then
      if   command -v open    >/dev/null 2>&1; then open    http://localhost:5173
      elif command -v xdg-open >/dev/null 2>&1; then xdg-open http://localhost:5173
      fi
      exit 0
    fi
    sleep 1
  done
) &

exec pnpm dev
