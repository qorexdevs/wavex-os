# wavex-os one-liner installer for Windows.
#
# Usage (PowerShell):
#   iwr -useb https://raw.githubusercontent.com/aimerdoux/wavex-os/main/install.ps1 | iex
#
# What it does:
#   1. Verifies Node 20+, pnpm 8+, git. Installs anything missing via winget.
#   2. Clones the repo into $HOME\wavex-os (or $env:WAVEX_OS_DIR).
#   3. Runs `pnpm install`.
#   4. Starts `pnpm dev` in a new window and opens http://localhost:5173.
#
# Env overrides:
#   $env:WAVEX_OS_DIR        — where to clone (default: $HOME\wavex-os)
#   $env:ANTHROPIC_API_KEY   — Pool A inference key (optional; falls back to T1 stubs)
#   $env:WAVEX_INFERENCE_MODE = "apikey" if ANTHROPIC_API_KEY is set
$ErrorActionPreference = "Stop"

$WavexOsDir = if ($env:WAVEX_OS_DIR) { $env:WAVEX_OS_DIR } else { Join-Path $HOME "wavex-os" }
$RepoUrl    = if ($env:REPO_URL)     { $env:REPO_URL }     else { "https://github.com/aimerdoux/wavex-os.git" }

function Write-Bold($msg) { Write-Host $msg -ForegroundColor White -BackgroundColor DarkBlue }
function Write-Ok($msg)   { Write-Host "  $([char]0x2713) $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  ! $msg" -ForegroundColor Yellow }
function Write-Note($msg) { Write-Host "  $msg" }
function Stop-Die($msg)   { Write-Host "  $([char]0x2717) $msg" -ForegroundColor Red; exit 1 }

Write-Bold "wavex-os installer"

# ── 1. Check prereqs ─────────────────────────────────────────────────────
Write-Bold "[1/4] Checking prereqs"
$missing = @()

if (Get-Command git -ErrorAction SilentlyContinue) { Write-Ok "git installed" } else { $missing += "git" }

if (Get-Command node -ErrorAction SilentlyContinue) {
  $nodeVer = (node --version) -replace "v","" -replace "\..*",""
  if ([int]$nodeVer -ge 20) { Write-Ok "node $(node --version)" }
  else { Write-Warn "node $(node --version) is too old; need v20+"; $missing += "node" }
} else { $missing += "node" }

if (Get-Command pnpm -ErrorAction SilentlyContinue) { Write-Ok "pnpm $(pnpm --version)" } else { $missing += "pnpm" }

# ── 2. Install missing ───────────────────────────────────────────────────
if ($missing.Count -gt 0) {
  Write-Bold "[2/4] Installing missing tools: $($missing -join ', ')"
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Stop-Die "winget not found. Install 'App Installer' from the Microsoft Store first, then re-run this script."
  }
  foreach ($tool in $missing) {
    switch ($tool) {
      "git"  { winget install -e --id Git.Git --silent }
      "node" { winget install -e --id OpenJS.NodeJS.LTS --silent }
      "pnpm" {
        # Ensure node is on PATH before npm
        $env:Path = [Environment]::GetEnvironmentVariable("Path","User") + ";" + [Environment]::GetEnvironmentVariable("Path","Machine")
        npm install -g pnpm@8
      }
    }
  }
  # Reload PATH so new binaries are visible in this session
  $env:Path = [Environment]::GetEnvironmentVariable("Path","User") + ";" + [Environment]::GetEnvironmentVariable("Path","Machine")
  Write-Ok "tools installed"
} else {
  Write-Bold "[2/4] All prereqs already present"
}

# ── 3. Clone + install ───────────────────────────────────────────────────
Write-Bold "[3/4] Cloning + installing"
if (Test-Path $WavexOsDir) {
  Write-Note "$WavexOsDir exists - pulling latest"
  Set-Location $WavexOsDir
  git pull --ff-only
} else {
  git clone $RepoUrl $WavexOsDir
  Set-Location $WavexOsDir
}
Write-Ok "cloned to $WavexOsDir"

Write-Note "pnpm install (this can take 3-8 min on first run)..."
pnpm install
Write-Ok "deps installed"

# ── 4. Configure inference + start dev server ────────────────────────────
Write-Bold "[4/4] Configuring inference + starting dev server"

# Default: route Pool A through the WaveX-hosted inference hub. Customers
# don't need their own Claude Max - the operator's subscription serves
# their onboarding inference. Override by editing %USERPROFILE%\.wavex-os\inference.env.
$HubUrl = if ($env:WAVEX_INFERENCE_HUB_URL) { $env:WAVEX_INFERENCE_HUB_URL } else { "https://catalogue-sea-such-manchester.trycloudflare.com" }
$InferenceDir = Join-Path $HOME ".wavex-os"
$InferenceEnv = Join-Path $InferenceDir "inference.env"
if (-not (Test-Path $InferenceDir)) { New-Item -ItemType Directory -Path $InferenceDir | Out-Null }
if (-not (Test-Path $InferenceEnv)) {
@"
# wavex-os Pool A inference config (written by install.ps1).
# Edit to change hub URL or switch to local-OAuth/api-key mode.
WAVEX_INFERENCE_MODE=hosted
WAVEX_INFERENCE_HUB_URL=$HubUrl
"@ | Set-Content -Path $InferenceEnv -Encoding UTF8
  Write-Ok "wrote $InferenceEnv (hosted mode, hub=$HubUrl)"
} else {
  Write-Ok "$InferenceEnv already present - keeping existing config"
}

Write-Note "Vite UI on http://localhost:5173"
Write-Note "mock-core API on http://localhost:3101"
Write-Note ""
Write-Note "Press Ctrl+C to stop. Re-run with: cd $WavexOsDir; pnpm dev"
Write-Note ""

# Open browser once Vite is up (background)
Start-Job -ScriptBlock {
  for ($i = 0; $i -lt 60; $i++) {
    try {
      $r = Invoke-WebRequest -Uri "http://localhost:5173" -UseBasicParsing -TimeoutSec 1 -ErrorAction Stop
      Start-Process "http://localhost:5173"
      return
    } catch {
      Start-Sleep -Seconds 1
    }
  }
} | Out-Null

pnpm dev
