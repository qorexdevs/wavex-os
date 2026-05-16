# WaveX OS — Windows Scheduled Task installer for the local-ops daemon.
#
# Creates a per-user Scheduled Task that runs scripts/wavex-local-ops-cycle.mjs
# every 5 minutes via node. Safe to re-run: deletes the existing task first.
#
# Usage (from repo root):
#   powershell -ExecutionPolicy Bypass -File scripts/install-local-ops-windows.ps1
#
# Uninstall:
#   schtasks /Delete /TN "WaveX-OS Local Ops" /F

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$script   = Join-Path $repoRoot "scripts\wavex-local-ops-cycle.mjs"
$taskName = "WaveX-OS Local Ops"

if (-not (Test-Path $script)) {
    throw "Daemon script not found at $script"
}

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) {
    throw "node not found in PATH. Install Node.js 22+ first."
}

# Drop any existing instance.
schtasks /Delete /TN "$taskName" /F 2>$null | Out-Null

$action    = New-ScheduledTaskAction -Execute $node -Argument "`"$script`""
$trigger   = New-ScheduledTaskTrigger -Once -At (Get-Date) `
                -RepetitionInterval (New-TimeSpan -Minutes 5) `
                -RepetitionDuration ([TimeSpan]::MaxValue)
$settings  = New-ScheduledTaskSettingsSet `
                -AllowStartIfOnBatteries `
                -DontStopIfGoingOnBatteries `
                -StartWhenAvailable `
                -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive

$env_var = "WAVEX_OS_REPO_ROOT=$repoRoot"
[Environment]::SetEnvironmentVariable("WAVEX_OS_REPO_ROOT", $repoRoot, "User")

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "WaveX OS self-healing daemon. Runs every 5 min." | Out-Null

Write-Host "Installed scheduled task: $taskName"
Write-Host "Repo root: $repoRoot"
Write-Host "Script:    $script"
Write-Host ""
Write-Host "Run now: schtasks /Run /TN `"$taskName`""
Write-Host "Status:  schtasks /Query /TN `"$taskName`" /V /FO LIST"
