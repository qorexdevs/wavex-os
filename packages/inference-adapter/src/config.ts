/** Resolves the bin path tier-router should spawn for T2 invocations and
 *  returns a TierRouterOptions-shaped config that callers can spread into
 *  the route() options. */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { getInferenceMode } from "./mode.js";

const here = dirname(fileURLToPath(import.meta.url));

/** Walk up from this file to the wavex-os repo root by locating the
 *  workspace marker (pnpm-workspace.yaml). */
function findRepoRoot(): string {
  let dir = here;
  for (let i = 0; i < 12; i++) {
    if (existsSync(resolve(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("inference-adapter: failed to locate wavex-os repo root from " + here);
}

let cachedRoot: string | undefined;
function repoRoot(): string {
  if (!cachedRoot) cachedRoot = findRepoRoot();
  return cachedRoot;
}

export function getClaudeBin(): string {
  const mode = getInferenceMode();
  if (mode === "oauth") {
    return resolve(repoRoot(), "scripts/wavex-claude-spawn.sh");
  }
  if (mode === "apikey") {
    return process.env.OP_OMEGA_CLAUDE_BIN ?? "claude";
  }
  // Hosted mode: tier-router's `claude -p` subprocess contract is satisfied
  // by a Node shim that proxies to the Mac mini's inference-server Pool A
  // endpoint via WAVEX_INFERENCE_HUB_URL. This is the path customers who
  // don't have their own Claude Max take — flat-rate inference via the
  // operator's subscription, no local credentials required.
  return resolve(repoRoot(), "scripts/wrappers/claude-hosted-shim.mjs");
}

export interface InferenceConfig {
  mode: ReturnType<typeof getInferenceMode>;
  claudeBin: string;
}

export function getInferenceConfig(): InferenceConfig {
  return {
    mode: getInferenceMode(),
    claudeBin: getClaudeBin(),
  };
}

/** Apply the inference config to process.env so any code-path that consults
 *  OP_OMEGA_CLAUDE_BIN (notably the vendored tier-router worker entry) picks
 *  up the right bin without explicit option-passing. Idempotent.
 *
 *  Also enables WAVEX_INFERENCE_TRACK by default so the wrapper writes
 *  start/heartbeat/complete events the UI can poll for real T2 progress.
 *  Disable explicitly with WAVEX_INFERENCE_TRACK=0. */
export function applyInferenceEnv(): InferenceConfig {
  const cfg = getInferenceConfig();
  process.env.OP_OMEGA_CLAUDE_BIN = cfg.claudeBin;
  if (process.env.WAVEX_INFERENCE_TRACK === undefined && cfg.mode === "oauth") {
    process.env.WAVEX_INFERENCE_TRACK = "1";
  }
  return cfg;
}
