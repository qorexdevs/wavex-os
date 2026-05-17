/** Wavex-os filesystem layout bridge.
 *
 *  Wavex-os's plugin writes session state under
 *    `${PAPERCLIP_DATA_DIR}/instances/default/companies/<id>/onboarding/`.
 *
 *  Wavex-os contract (per CLAUDE.md) is `~/.wavex-os/instances/<id>/`.
 *  We reconcile by:
 *    1. Pointing PAPERCLIP_DATA_DIR at `~/.wavex-os` so the plugin writes
 *       inside the wavex root.
 *    2. Mirroring the projection files (agents.json, kpi-registry.json,
 *       wavex-os.config.json) one directory shallower so the dashboard can
 *       read from `~/.wavex-os/instances/<id>/...` directly. */
import { homedir } from "node:os";
import { join } from "node:path";

export function getWavexDataRoot(): string {
  return process.env.WAVEX_OS_STATE_DIR ?? join(homedir(), ".wavex-os");
}

/** Ensure the plugin's sessionPaths() resolves under wavex root. Idempotent. */
export function applyStateBridge(): void {
  if (!process.env.PAPERCLIP_DATA_DIR) {
    process.env.PAPERCLIP_DATA_DIR = getWavexDataRoot();
  }
}

export function getInstanceDir(companyId: string): string {
  return join(getWavexDataRoot(), "instances", companyId);
}

export function getOnboardingDir(companyId: string): string {
  // Mirrors the plugin's sessionPaths().onboardingDir
  return join(getWavexDataRoot(), "instances", "default", "companies", companyId, "onboarding");
}
