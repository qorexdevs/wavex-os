/** WAVEX_INFERENCE_MODE resolution.
 *  - "oauth" (default in dev): T2 calls spawn the wavex-claude-spawn.sh wrapper
 *    which resolves the operator's Claude Max OAuth credential from the macOS
 *    keychain and exposes it as ANTHROPIC_API_KEY for the wrapped claude CLI.
 *  - "apikey": T2 calls spawn the bare `claude` binary; ANTHROPIC_API_KEY must
 *    be present in process.env (e.g. set by the production deployment).
 *  - "hosted" (future): point at a hosted wavex-server inference proxy. */

export type InferenceMode = "oauth" | "apikey" | "hosted";

export function getInferenceMode(): InferenceMode {
  const raw = (process.env.WAVEX_INFERENCE_MODE ?? "").toLowerCase();
  if (raw === "apikey" || raw === "api-key" || raw === "production") return "apikey";
  if (raw === "hosted") return "hosted";
  if (raw === "oauth" || raw === "dev") return "oauth";
  return process.env.NODE_ENV === "production" ? "apikey" : "oauth";
}
