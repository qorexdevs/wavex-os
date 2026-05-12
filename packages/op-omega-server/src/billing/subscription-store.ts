/**
 * Local subscription state — Phase F.1.
 *
 * Lives at ~/.wavex-os/subscription.json so the Liaison agent (F.4) and
 * Mission Control tier-badge can read it without round-tripping to
 * Supabase on every check. Hardened against stale data via a TTL refresh.
 *
 * File format (v1):
 *   {
 *     "v": 1,
 *     "user_id": "uuid",
 *     "subscription_id": "uuid",
 *     "tier": "founder" | "growth" | "custom",
 *     "status": "trialing" | "active" | "past_due" | "canceled" | ...,
 *     "current_period_end": "2026-06-11T...",
 *     "jwt": "...",                       // signed by api.wavex-os.com
 *     "jwt_expires_at": "2026-05-12T...", // refresh on stale
 *     "last_refreshed_at": "2026-05-11T..."
 *   }
 *
 * No PII beyond user_id (which is a UUID, not an email). All sensitive
 * write paths go through Supabase; this file is a read cache + JWT carrier.
 */
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export type SubscriptionTier = "founder" | "growth" | "custom";
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "paused";

export interface SubscriptionFile {
  v: 1;
  user_id: string;
  subscription_id: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  current_period_end: string;
  jwt: string;
  jwt_expires_at: string;
  last_refreshed_at: string;
}

function statePath(): string {
  const root = process.env.WAVEX_OS_STATE_DIR ?? join(homedir(), ".wavex-os");
  return join(root, "subscription.json");
}

/** Returns the cached subscription, or null if no file exists / file is malformed. */
export async function readLocalSubscription(): Promise<SubscriptionFile | null> {
  try {
    const raw = await fs.readFile(statePath(), "utf8");
    const parsed = JSON.parse(raw) as SubscriptionFile;
    if (parsed.v !== 1) return null;
    return parsed;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    return null;
  }
}

/** Write the subscription file atomically (write to .tmp, rename). */
export async function writeLocalSubscription(sub: SubscriptionFile): Promise<void> {
  const path = statePath();
  await fs.mkdir(join(path, ".."), { recursive: true });
  const tmp = `${path}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(sub, null, 2), { mode: 0o600 });
  await fs.rename(tmp, path);
}

/** Delete the file (called on confirmed cancellation). */
export async function deleteLocalSubscription(): Promise<void> {
  try {
    await fs.unlink(statePath());
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
}

/**
 * Active = not canceled/unpaid/incomplete. Trialing and active both count
 * as "user gets optimizer features".
 */
export function isActive(sub: SubscriptionFile | null): boolean {
  if (!sub) return false;
  return sub.status === "trialing" || sub.status === "active";
}

/** JWT TTL check. We refresh proactively when within 6h of expiry. */
export function jwtIsStale(sub: SubscriptionFile, marginMs = 6 * 60 * 60 * 1000): boolean {
  const exp = new Date(sub.jwt_expires_at).getTime();
  return Number.isNaN(exp) || Date.now() > exp - marginMs;
}

/** Returns the JWT iff present and not expired. */
export function activeJwt(sub: SubscriptionFile): string | null {
  if (jwtIsStale(sub, 0)) return null;
  return sub.jwt;
}
