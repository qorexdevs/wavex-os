/** WAVEX_INFERENCE_MODE resolution.
 *  - "oauth" (default in dev): T2 calls spawn the wavex-claude-spawn.sh wrapper
 *    which resolves the operator's Claude Max OAuth credential from the macOS
 *    keychain and exposes it as ANTHROPIC_API_KEY for the wrapped claude CLI.
 *  - "apikey": T2 calls spawn the bare `claude` binary; ANTHROPIC_API_KEY must
 *    be present in process.env (e.g. set by the production deployment).
 *  - "hosted": T2 calls route to a Mac-mini inference-server via
 *    WAVEX_INFERENCE_HUB_URL. Used by customers who don't have their own
 *    Claude Max — the operator's Pool A serves them under their session
 *    token. The wrapper script at scripts/wrappers/claude-hosted-shim.mjs
 *    bridges tier-router's claude-CLI subprocess contract to that endpoint. */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export type InferenceMode = "oauth" | "apikey" | "hosted";

let envFileLoaded = false;

/** Load ~/.wavex-os/inference.env once per process. Keys already in
 *  process.env win — explicit shell exports always override the file.
 *  This is what the installer writes so reboots/re-runs of `pnpm dev`
 *  pick up the hosted-mode config without manual env-export each time. */
function loadInferenceEnvFile(): void {
  if (envFileLoaded) return;
  envFileLoaded = true;
  const path = join(homedir(), ".wavex-os", "inference.env");
  if (!existsSync(path)) return;
  try {
    for (const raw of readFileSync(path, "utf8").split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq < 1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    // Best-effort — never fail boot on a malformed file.
  }
}

export function getInferenceMode(): InferenceMode {
  loadInferenceEnvFile();
  const raw = (process.env.WAVEX_INFERENCE_MODE ?? "").toLowerCase();
  if (raw === "apikey" || raw === "api-key" || raw === "production") return "apikey";
  if (raw === "hosted") return "hosted";
  if (raw === "oauth" || raw === "dev") return "oauth";
  return process.env.NODE_ENV === "production" ? "apikey" : "oauth";
}
