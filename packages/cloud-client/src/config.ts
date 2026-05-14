/**
 * Where the WaveX OS Console lives + which env vars steer the client.
 *
 * Configurable so a CI run, a staging deploy, or a future self-hosted
 * console doesn't have to fork the code — just override the env.
 *
 * Required:
 *   WAVEX_CLOUD_FUNCTIONS_URL   base URL for Supabase Edge Functions, e.g.
 *                                 https://ngvtgraldybxdbgkihfj.supabase.co/functions/v1
 *   WAVEX_CONSOLE_URL           browser-facing URL the login flow opens,
 *                                 e.g. https://wavexcard.com/os/link
 *
 * Optional:
 *   WAVEX_CLOUD_PUBLIC_KEY      Supabase anon/publishable key — only needed
 *                                 if the edge functions require an apikey
 *                                 header in addition to the device JWT.
 *                                 (Most os-* functions don't.)
 *   WAVEX_DEVICE_TOKEN_PATH     override the default
 *                                 ~/.wavex-os/device-token.json location
 *   WAVEX_CLOUD_HTTP_TIMEOUT_MS request timeout (default 30 s)
 */
import { homedir } from "node:os";
import { join } from "node:path";

export interface CloudConfig {
  functionsUrl: string;
  consoleUrl: string;
  publicKey?: string;
  tokenPath: string;
  timeoutMs: number;
}

const DEFAULT_FUNCTIONS_URL = "https://ngvtgraldybxdbgkihfj.supabase.co/functions/v1";
const DEFAULT_CONSOLE_URL = "https://wavexcard.com/os/link";
const DEFAULT_TIMEOUT_MS = 30_000;

function defaultTokenPath(): string {
  return join(homedir(), ".wavex-os", "device-token.json");
}

export function loadConfig(): CloudConfig {
  return {
    functionsUrl: process.env.WAVEX_CLOUD_FUNCTIONS_URL ?? DEFAULT_FUNCTIONS_URL,
    consoleUrl: process.env.WAVEX_CONSOLE_URL ?? DEFAULT_CONSOLE_URL,
    publicKey: process.env.WAVEX_CLOUD_PUBLIC_KEY || undefined,
    tokenPath: process.env.WAVEX_DEVICE_TOKEN_PATH ?? defaultTokenPath(),
    timeoutMs: Number(process.env.WAVEX_CLOUD_HTTP_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS),
  };
}

/** Compose a fully-qualified edge-function URL. */
export function fnUrl(cfg: CloudConfig, name: string): string {
  // trim trailing slash on base, leading slash on name — defensively
  const base = cfg.functionsUrl.replace(/\/+$/, "");
  const path = name.replace(/^\/+/, "");
  return `${base}/${path}`;
}
