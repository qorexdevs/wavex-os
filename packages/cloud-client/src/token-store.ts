/**
 * Read/write/refresh the local device token bundle.
 *
 * After `wavex-os login` completes the pairing flow, the resulting
 * access + refresh tokens land in `~/.wavex-os/device-token.json` with
 * owner-only perms (chmod 600). Every subsequent cloud call goes
 * through `getValidAccessToken()`, which:
 *
 *   - reads the file
 *   - if access-token expires in < 60 s, calls os-device-refresh
 *   - writes the rotated bundle back
 *   - returns the access token
 *
 * Refresh is single-flight per-process via a Promise cache so a burst
 * of cloud calls doesn't fire N refreshes simultaneously.
 */
import { promises as fs } from "node:fs";
import { dirname } from "node:path";
import { verifyDeviceJwt } from "@wavex-os/auth-shim";
import { loadConfig, fnUrl, type CloudConfig } from "./config.js";

export interface DeviceTokenBundle {
  /** HS256 JWT issued by os-device-token / os-device-refresh. */
  access_token: string;
  /** Opaque refresh token (cloud-side SHA-256 hashed for lookup). */
  refresh_token: string;
  /** Unix seconds — when the access_token expires. Mirrors JWT exp. */
  access_token_expires_at: number;
  /** When the bundle was written locally. Informational. */
  obtained_at: number;
  /** Which user_id the bundle is bound to. From JWT sub. */
  user_id: string;
  /** Which device row the bundle is bound to. From JWT device_id. */
  device_id: string;
}

const REFRESH_THRESHOLD_SEC = 60;

let inflightRefresh: Promise<DeviceTokenBundle> | null = null;

export async function readBundle(cfg?: CloudConfig): Promise<DeviceTokenBundle | null> {
  const c = cfg ?? loadConfig();
  try {
    const raw = await fs.readFile(c.tokenPath, "utf8");
    return JSON.parse(raw) as DeviceTokenBundle;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function writeBundle(bundle: DeviceTokenBundle, cfg?: CloudConfig): Promise<void> {
  const c = cfg ?? loadConfig();
  await fs.mkdir(dirname(c.tokenPath), { recursive: true });
  await fs.writeFile(c.tokenPath, JSON.stringify(bundle, null, 2) + "\n", {
    mode: 0o600,
  });
}

export async function deleteBundle(cfg?: CloudConfig): Promise<void> {
  const c = cfg ?? loadConfig();
  try {
    await fs.unlink(c.tokenPath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

/**
 * Inspect a stored bundle without making any network call. Useful for
 * the `wavex-os doctor` CLI to surface "paired as <user>, expires in N
 * min" without disturbing the refresh flow.
 *
 * Returns the JWT verify result OR { ok: false, reason: "no_bundle" }
 * if no file is on disk.
 */
export async function introspectBundle(
  cfg?: CloudConfig,
): Promise<{ ok: boolean; reason?: string; bundle?: DeviceTokenBundle }> {
  const bundle = await readBundle(cfg);
  if (!bundle) return { ok: false, reason: "no_bundle" };
  const v = verifyDeviceJwt(bundle.access_token);
  if (!v.ok) return { ok: false, reason: v.reason, bundle };
  return { ok: true, bundle };
}

/**
 * Get a valid access token, refreshing if necessary. Throws if no
 * bundle exists (caller should prompt for `wavex-os login`).
 */
export async function getValidAccessToken(cfg?: CloudConfig): Promise<string> {
  const c = cfg ?? loadConfig();
  let bundle = await readBundle(c);
  if (!bundle) {
    throw new Error("no_paired_device: run `wavex-os login` to pair this machine");
  }

  const now = Math.floor(Date.now() / 1000);
  if (bundle.access_token_expires_at - now > REFRESH_THRESHOLD_SEC) {
    return bundle.access_token;
  }

  // Single-flight refresh — concurrent callers all await the same promise
  if (!inflightRefresh) {
    inflightRefresh = (async () => {
      try {
        const refreshed = await callRefresh(c, bundle!.refresh_token);
        await writeBundle(refreshed, c);
        return refreshed;
      } finally {
        inflightRefresh = null;
      }
    })();
  }
  bundle = await inflightRefresh;
  return bundle.access_token;
}

async function callRefresh(cfg: CloudConfig, refreshToken: string): Promise<DeviceTokenBundle> {
  const url = fnUrl(cfg, "os-device-refresh");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (cfg.publicKey) headers["apikey"] = cfg.publicKey;
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ refresh_token: refreshToken }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`refresh_failed: HTTP ${res.status} ${text.slice(0, 200)}`);
    }
    type RefreshResponse = {
      access_token: string;
      refresh_token: string;
      access_token_expires_at: number;
      user_id: string;
      device_id: string;
    };
    const body = (await res.json()) as RefreshResponse;
    if (!body.access_token || !body.refresh_token || !body.access_token_expires_at) {
      throw new Error("refresh_failed: malformed response from os-device-refresh");
    }
    return {
      access_token: body.access_token,
      refresh_token: body.refresh_token,
      access_token_expires_at: body.access_token_expires_at,
      obtained_at: Math.floor(Date.now() / 1000),
      user_id: body.user_id,
      device_id: body.device_id,
    };
  } finally {
    clearTimeout(timer);
  }
}
