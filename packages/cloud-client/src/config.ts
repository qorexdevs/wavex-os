/**
 * Where the WaveX OS Console + inference transport live + which env vars
 * steer the client.
 *
 * Two surfaces:
 *   - functionsUrl (Supabase Edge Functions): device-pairing flow ONLY
 *     (os-link-device, os-device-token, os-device-refresh). These are
 *     deployed and stable.
 *   - Supabase Realtime (pub/sub): post-pairing paid inference traffic.
 *     The customer publishes a request on
 *       `wavex-inference-request:<user_id>`
 *     and subscribes to
 *       `wavex-inference-response:<user_id>`.
 *     The operator's Mac wildcard-subscribes to the request channel and
 *     publishes the response. Both sides connect OUTWARD to Supabase, so
 *     there is no tunnel / no public hub URL / no NAT traversal.
 *   - hubUrl (HTTP, legacy): retained ONLY for `spend-intent.ts`, which
 *     still posts to a 503 stub. The inference path no longer uses it.
 *
 * Required:
 *   WAVEX_CLOUD_FUNCTIONS_URL   base URL for Supabase Edge Functions
 *   WAVEX_CONSOLE_URL           browser-facing URL the login flow opens
 *
 * Optional:
 *   WAVEX_SUPABASE_URL          override the embedded Supabase project URL
 *                                 (defaults to the production project that
 *                                  ships with cloud-client; safe to embed
 *                                  since it's the same URL the console UI
 *                                  uses publicly).
 *   WAVEX_SUPABASE_ANON_KEY     override the embedded Supabase anon key
 *                                 (the anon key is publicly-safe — RLS does
 *                                  the gating; we embed it so customer
 *                                  installs don't need any extra config to
 *                                  connect Realtime).
 *   WAVEX_INFERENCE_HUB_URL     legacy: still consulted by spend-intent
 *                                 for the HTTP stub. Inference no longer
 *                                 reads this.
 *   WAVEX_CLOUD_PUBLIC_KEY      legacy alias kept for back-compat with
 *                                 the pairing flow's optional `apikey`
 *                                 header.
 *   WAVEX_DEVICE_TOKEN_PATH     override the default
 *                                 ~/.wavex-os/device-token.json location
 *   WAVEX_CLOUD_HTTP_TIMEOUT_MS HTTP request timeout (default 30 s)
 *   WAVEX_INFERENCE_TIMEOUT_MS  Realtime inference round-trip timeout
 *                                 (default 60 s — matches contract)
 */
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface CloudConfig {
  functionsUrl: string;
  consoleUrl: string;
  /** Legacy HTTP base used by spend-intent only. Default empty string so
   *  call sites that still depend on it throw clearly. */
  hubUrl: string;
  /** Supabase project URL used by the Realtime inference transport. */
  supabaseUrl: string;
  /** Supabase anon (publishable) key — public-safe. */
  supabaseAnonKey: string;
  publicKey?: string;
  tokenPath: string;
  timeoutMs: number;
  /** Round-trip timeout for the Realtime inference call. */
  inferenceTimeoutMs: number;
}

const DEFAULT_FUNCTIONS_URL = "https://ngvtgraldybxdbgkihfj.supabase.co/functions/v1";
const DEFAULT_CONSOLE_URL = "https://wavexcard.com/os/link";
const DEFAULT_HUB_URL = "http://127.0.0.1:8787";
/**
 * The production wavex-os Supabase project. Same URL the onboarding-ui
 * embeds in its built bundle and the same project that mints device JWTs
 * via `os-device-token`. Public-safe.
 */
const DEFAULT_SUPABASE_URL = "https://ngvtgraldybxdbgkihfj.supabase.co";
/**
 * Anon (publishable) key for the same project. PUBLIC: this key only
 * grants unauthenticated access bounded by row-level-security and table
 * grants. It's the same value shipped to the browser by the pricing-page
 * sign-in flow (`onboarding-ui/.env`).
 */
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndnRncmFsZHlieGRiZ2tpaGZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MDg4MzMsImV4cCI6MjA3NDQ4NDgzM30.Xbm9AWZ3QYjkyzjFkuXAS1YR--VRd7fB-9eK14daQ8Q";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_INFERENCE_TIMEOUT_MS = 60_000;

function defaultTokenPath(): string {
  return join(homedir(), ".wavex-os", "device-token.json");
}

/** Best-effort load of ~/.wavex-os/inference.env so a customer install
 *  that wrote WAVEX_SUPABASE_* into the file doesn't need to re-export
 *  them in every shell. Process env wins over file values.
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
    supabaseUrl: process.env.WAVEX_SUPABASE_URL ?? DEFAULT_SUPABASE_URL,
    supabaseAnonKey: process.env.WAVEX_SUPABASE_ANON_KEY ?? DEFAULT_SUPABASE_ANON_KEY,
    publicKey: process.env.WAVEX_CLOUD_PUBLIC_KEY || undefined,
    tokenPath: process.env.WAVEX_DEVICE_TOKEN_PATH ?? defaultTokenPath(),
    timeoutMs: Number(process.env.WAVEX_CLOUD_HTTP_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS),
    inferenceTimeoutMs: Number(
      process.env.WAVEX_INFERENCE_TIMEOUT_MS ?? DEFAULT_INFERENCE_TIMEOUT_MS,
    ),
  };
}

/** Compose a fully-qualified edge-function URL (pairing flow only). */
export function fnUrl(cfg: CloudConfig, name: string): string {
  const base = cfg.functionsUrl.replace(/\/+$/, "");
  const path = name.replace(/^\/+/, "");
  return `${base}/${path}`;
}

/**
 * Compose a fully-qualified inference-hub URL.
 *
 * @deprecated The inference call path no longer goes through HTTP — see
 * `inference.ts`, which uses Supabase Realtime instead. This helper is
 * retained ONLY for `spend-intent.ts`, which still posts to a stub
 * endpoint. It will be removed when spend-intent is also ported to
 * Realtime.
 */
export function hubUrl(cfg: CloudConfig, path: string): string {
  const base = cfg.hubUrl.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
