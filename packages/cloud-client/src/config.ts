/**
 * Where the WaveX OS Console + inference hub live + which env vars steer
 * the client.
 *
 * Two surfaces:
 *   - functionsUrl (Supabase Edge Functions): device-pairing flow ONLY
 *     (os-link-device, os-device-token, os-device-refresh). These are
 *     deployed and stable.
 *   - hubUrl (Mac-mini inference-server, exposed via Cloudflare Tunnel):
 *     post-pairing paid traffic — /v1/os/inference, /v1/os/spend-intent.
 *     Previously these went through Supabase Edge Functions that were
 *     never deployed (`os-inference`, `os-spend-intent`); the refactor
 *     points them at the hub instead.
 *
 * Required:
 *   WAVEX_CLOUD_FUNCTIONS_URL   base URL for Supabase Edge Functions
 *   WAVEX_CONSOLE_URL           browser-facing URL the login flow opens
 *   WAVEX_INFERENCE_HUB_URL     base URL for the operator's inference-server
 *                                (e.g. https://catalogue-sea-such-...trycloudflare.com
 *                                 or the eventual https://api.wavexcard.com)
 *
 * Optional:
 *   WAVEX_CLOUD_PUBLIC_KEY      Supabase anon/publishable key — only needed
 *                                 if the edge functions require an apikey
 *                                 header in addition to the device JWT.
 *   WAVEX_DEVICE_TOKEN_PATH     override the default
 *                                 ~/.wavex-os/device-token.json location
 *   WAVEX_CLOUD_HTTP_TIMEOUT_MS request timeout (default 30 s)
 */
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface CloudConfig {
  functionsUrl: string;
  consoleUrl: string;
  hubUrl: string;
  publicKey?: string;
  tokenPath: string;
  timeoutMs: number;
}

const DEFAULT_FUNCTIONS_URL = "https://ngvtgraldybxdbgkihfj.supabase.co/functions/v1";
const DEFAULT_CONSOLE_URL = "https://wavexcard.com/os/link";
const DEFAULT_HUB_URL = "http://127.0.0.1:8787";
const DEFAULT_TIMEOUT_MS = 30_000;

function defaultTokenPath(): string {
  return join(homedir(), ".wavex-os", "device-token.json");
}

/** Best-effort load of ~/.wavex-os/inference.env so a customer install that
 *  used the installer to write WAVEX_INFERENCE_HUB_URL into the file
 *  doesn't need to re-export it in every shell. Process env wins over file.
 */
let envFileChecked = false;
function loadInferenceEnvFile(): void {
  if (envFileChecked) return;
  envFileChecked = true;
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
    // best-effort
  }
}

export function loadConfig(): CloudConfig {
  loadInferenceEnvFile();
  return {
    functionsUrl: process.env.WAVEX_CLOUD_FUNCTIONS_URL ?? DEFAULT_FUNCTIONS_URL,
    consoleUrl: process.env.WAVEX_CONSOLE_URL ?? DEFAULT_CONSOLE_URL,
    hubUrl: process.env.WAVEX_INFERENCE_HUB_URL ?? DEFAULT_HUB_URL,
    publicKey: process.env.WAVEX_CLOUD_PUBLIC_KEY || undefined,
    tokenPath: process.env.WAVEX_DEVICE_TOKEN_PATH ?? defaultTokenPath(),
    timeoutMs: Number(process.env.WAVEX_CLOUD_HTTP_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS),
  };
}

/** Compose a fully-qualified edge-function URL (pairing flow only). */
export function fnUrl(cfg: CloudConfig, name: string): string {
  const base = cfg.functionsUrl.replace(/\/+$/, "");
  const path = name.replace(/^\/+/, "");
  return `${base}/${path}`;
}

/** Compose a fully-qualified inference-hub URL (post-pairing paid traffic). */
export function hubUrl(cfg: CloudConfig, path: string): string {
  const base = cfg.hubUrl.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
