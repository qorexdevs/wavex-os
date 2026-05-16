/**
 * Device pairing flow — programmatic surface used by `scripts/wavex-login.mjs`.
 *
 * Three steps, modeled on `gh auth login` / Claude Code OAuth device flow:
 *
 *   1. POST os-link-device                      → { user_code, device_code, expires_in }
 *   2. Open browser to <console>/link?code=<user_code>
 *      (user is already logged in to wavexcard.com/os; they click "Pair this device")
 *   3. Poll POST os-device-token { device_code } until the user claims
 *      → { access_token, refresh_token, access_token_expires_at, user_id, device_id }
 *
 * Token bundle then lands in ~/.wavex-os/device-token.json (chmod 600).
 */
import { writeBundle } from "./token-store.js";
import { loadConfig, fnUrl, type CloudConfig } from "./config.js";

/** Decode a JWT's `sub` claim without verifying. Returns undefined on any
 *  parse failure — caller falls back to "". Library-free, same approach the
 *  rest of cloud-client uses (see inference.ts:extractSub). */
function decodeJwtSub(accessToken: string): string | undefined {
  try {
    const parts = accessToken.split(".");
    if (parts.length !== 3) return undefined;
    const b64 = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 ? 4 - (b64.length % 4) : 0;
    const json = Buffer.from(b64 + "=".repeat(pad), "base64").toString("utf8");
    const payload = JSON.parse(json) as { sub?: unknown };
    return typeof payload.sub === "string" && payload.sub ? payload.sub : undefined;
  } catch {
    return undefined;
  }
}

export interface LinkDeviceResponse {
  user_code: string;
  device_code: string;
  expires_in: number;
  /** Polling cadence the server recommends (seconds). */
  interval?: number;
  /** Full URL to open in browser. Server may include this so the client
   *  doesn't have to construct it. */
  verification_url?: string;
}

export interface LoginEvents {
  onCode?: (info: { userCode: string; verificationUrl: string; expiresIn: number }) => void;
  onPoll?: (attempt: number) => void;
  onPaired?: (info: { user_id: string; device_id: string }) => void;
}

/** Start a pairing — returns the user-facing code + verification URL. */
export async function startPairing(cfg?: CloudConfig): Promise<LinkDeviceResponse> {
  const c = cfg ?? loadConfig();
  const url = fnUrl(c, "os-link-device");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), c.timeoutMs);
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (c.publicKey) headers["apikey"] = c.publicKey;

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`os-link-device failed: HTTP ${res.status} ${text.slice(0, 200)}`);
    }
    return (await res.json()) as LinkDeviceResponse;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Poll os-device-token until the user claims OR expiry. Returns the
 * token bundle on success; throws on expiry / cancellation.
 */
export async function pollForToken(
  deviceCode: string,
  options: {
    intervalMs?: number;
    maxAttempts?: number;
    events?: LoginEvents;
    cfg?: CloudConfig;
  } = {},
): Promise<{
  access_token: string;
  refresh_token: string;
  access_token_expires_at: number;
  user_id: string;
  device_id: string;
}> {
  const c = options.cfg ?? loadConfig();
  const interval = options.intervalMs ?? 2_000;
  const maxAttempts = options.maxAttempts ?? 150; // 5 min at 2s poll
  const url = fnUrl(c, "os-device-token");

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    options.events?.onPoll?.(attempt);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (c.publicKey) headers["apikey"] = c.publicKey;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), c.timeoutMs);
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ device_code: deviceCode }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (res.status === 202 || res.status === 425) {
      // 202 Accepted / 425 Too Early — user hasn't claimed yet. Keep polling.
      await new Promise((r) => setTimeout(r, interval));
      continue;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`os-device-token failed: HTTP ${res.status} ${text.slice(0, 200)}`);
    }
    // The edge fn always returns HTTP 200 and discriminates via the body:
    //   pending  →  { ok: false, error: "authorization_pending" }
    //   success  →  { ok: true,  access_token, refresh_token, ... }  (or unflagged shape)
    //   error    →  { ok: false, error: "<terminal-error>" }
    const body = (await res.json()) as
      | { ok: true; access_token: string; refresh_token: string;
          access_token_expires_at?: number; expires_in?: number;
          user_id: string; device_id: string }
      | { ok: false; error: string }
      | { access_token?: string; status?: string };

    // OAuth device-flow standard pending signals — keep polling.
    const errorCode = (body as { error?: string }).error;
    const statusField = (body as { status?: string }).status;
    if (
      errorCode === "authorization_pending" ||
      errorCode === "slow_down" ||
      statusField === "pending"
    ) {
      await new Promise((r) => setTimeout(r, interval));
      continue;
    }
    // Terminal errors — surface clearly instead of "malformed".
    if (errorCode) {
      throw new Error(`pairing_failed: ${errorCode}`);
    }
    const accessToken = (body as { access_token?: string }).access_token;
    if (!accessToken) {
      throw new Error("os-device-token returned a malformed body");
    }
    // Successful claim. The edge fn returns { expires_in: 3600 } (seconds)
    // rather than access_token_expires_at; compute the absolute timestamp here
    // so the on-disk bundle matches DeviceTokenBundle's schema.
    const b = body as {
      access_token: string; refresh_token: string;
      access_token_expires_at?: number; expires_in?: number;
      user_id?: string; device_id: string;
    };
    // os-device-token doesn't currently return a top-level user_id — pull it
    // from the JWT's `sub` claim (same pattern inference.ts uses). Keeps the
    // bundle's user_id populated so the success message + on-disk token both
    // carry the real id and downstream callers don't need to re-decode.
    const userId = b.user_id || decodeJwtSub(b.access_token) || "";
    const expiresAt = b.access_token_expires_at
      ?? Math.floor(Date.now() / 1000) + (b.expires_in ?? 3600);
    const result = {
      access_token: b.access_token,
      refresh_token: b.refresh_token,
      access_token_expires_at: expiresAt,
      user_id: userId,
      device_id: b.device_id,
    };
    options.events?.onPaired?.({ user_id: userId, device_id: b.device_id });
    return result;
  }
  throw new Error("pairing_timeout: user did not claim the device code in time");
}

/**
 * Full flow: start pairing → emit code to caller → poll → write bundle.
 *
 * Caller is responsible for opening the browser (the events callback
 * receives the URL). Done this way so the same function works in both
 * CLI and headless / GUI environments.
 */
export async function runLogin(events: LoginEvents = {}, cfg?: CloudConfig): Promise<void> {
  const c = cfg ?? loadConfig();
  const linked = await startPairing(c);
  const verificationUrl =
    linked.verification_url ?? `${c.consoleUrl}?code=${encodeURIComponent(linked.user_code)}`;
  events.onCode?.({
    userCode: linked.user_code,
    verificationUrl,
    expiresIn: linked.expires_in,
  });

  const bundle = await pollForToken(linked.device_code, {
    intervalMs: (linked.interval ?? 2) * 1_000,
    events,
    cfg: c,
  });

  await writeBundle(
    {
      access_token: bundle.access_token,
      refresh_token: bundle.refresh_token,
      access_token_expires_at: bundle.access_token_expires_at,
      obtained_at: Math.floor(Date.now() / 1000),
      user_id: bundle.user_id,
      device_id: bundle.device_id,
    },
    c,
  );
}
