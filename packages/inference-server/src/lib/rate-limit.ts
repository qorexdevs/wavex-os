/**
 * Phase G.3.b — rate limiting + idempotency for Pool A.
 *
 * Uses Redis (via ioredis) when REDIS_URL is set; falls back to an
 * in-process Map for local dev. The fallback is NOT safe for production
 * (loses state on restart, no multi-process sync) but lets dev work
 * without spinning up Redis.
 */
import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

let redis: Redis | null = null;
let redisAvailable: boolean | null = null;
const memoryStore = new Map<string, { value: number; expiresAt: number }>();

async function getRedis(): Promise<Redis | null> {
  if (redisAvailable === false) return null;
  if (redis) return redis;
  try {
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    await redis.connect();
    redisAvailable = true;
    return redis;
  } catch {
    redisAvailable = false;
    return null;
  }
}

function memInc(key: string, ttlSec: number): number {
  const now = Date.now();
  const existing = memoryStore.get(key);
  if (existing && existing.expiresAt > now) {
    existing.value += 1;
    return existing.value;
  }
  memoryStore.set(key, { value: 1, expiresAt: now + ttlSec * 1000 });
  return 1;
}

function memGet(key: string): number {
  const now = Date.now();
  const e = memoryStore.get(key);
  if (!e || e.expiresAt <= now) return 0;
  return e.value;
}

/** Increment a counter and return its new value. TTL is applied on first set only. */
export async function incrementCounter(key: string, ttlSec: number): Promise<number> {
  const r = await getRedis();
  if (r) {
    const v = await r.incr(key);
    if (v === 1) await r.expire(key, ttlSec);
    return v;
  }
  return memInc(key, ttlSec);
}

export async function getCounter(key: string): Promise<number> {
  const r = await getRedis();
  if (r) {
    const v = await r.get(key);
    return v ? parseInt(v, 10) : 0;
  }
  return memGet(key);
}

/** Atomic "set if absent" — used for idempotency keys. Returns true if we just set it. */
export async function setIfAbsent(key: string, ttlSec: number): Promise<boolean> {
  const r = await getRedis();
  if (r) {
    const v = await r.set(key, "1", "EX", ttlSec, "NX");
    return v === "OK";
  }
  if (memGet(key) > 0) return false;
  memInc(key, ttlSec);
  return true;
}

const memSetStore = new Map<string, { values: Set<string>; expiresAt: number }>();

function memSetAdd(key: string, member: string, ttlSec: number): { added: boolean; size: number } {
  const now = Date.now();
  let entry = memSetStore.get(key);
  if (!entry || entry.expiresAt <= now) {
    entry = { values: new Set(), expiresAt: now + ttlSec * 1000 };
    memSetStore.set(key, entry);
  }
  const before = entry.values.size;
  entry.values.add(member);
  return { added: entry.values.size > before, size: entry.values.size };
}

function memSetSize(key: string): number {
  const now = Date.now();
  const e = memSetStore.get(key);
  if (!e || e.expiresAt <= now) return 0;
  return e.values.size;
}

/** Add `member` to the set at `key` with TTL. Returns whether the member
 *  was newly added and the resulting set size. This is the correct way to
 *  enforce "N distinct values per key per window" — `incrementCounter`
 *  over-counts because it bumps on every call, even repeated members.
 *
 *  Used by Pool A to enforce "N distinct install_ids per email per 30d":
 *  the same install_id calling session-mint twice should not consume two
 *  slots, only one. */
export async function setAdd(key: string, member: string, ttlSec: number): Promise<{ added: boolean; size: number }> {
  const r = await getRedis();
  if (r) {
    const beforeRaw = await r.scard(key);
    const before = typeof beforeRaw === "number" ? beforeRaw : parseInt(String(beforeRaw ?? "0"), 10);
    await r.sadd(key, member);
    const sizeRaw = await r.scard(key);
    const size = typeof sizeRaw === "number" ? sizeRaw : parseInt(String(sizeRaw ?? "0"), 10);
    if (before === 0 && size > 0) await r.expire(key, ttlSec);
    return { added: size > before, size };
  }
  return memSetAdd(key, member, ttlSec);
}

export async function setSize(key: string): Promise<number> {
  const r = await getRedis();
  if (r) {
    const v = await r.scard(key);
    return typeof v === "number" ? v : parseInt(String(v ?? "0"), 10);
  }
  return memSetSize(key);
}

/** Drop a counter or set entry. Used by admin routes to clear stale
 *  rate-limit state without restarting the server. Returns true if
 *  something was deleted. */
export async function dropKey(key: string): Promise<boolean> {
  const r = await getRedis();
  if (r) {
    const deleted = await r.del(key);
    return deleted > 0;
  }
  const a = memoryStore.delete(key);
  const b = memSetStore.delete(key);
  return a || b;
}

export async function getStatus(): Promise<{ backend: "redis" | "memory"; ready: boolean }> {
  const r = await getRedis();
  return r ? { backend: "redis", ready: true } : { backend: "memory", ready: false };
}
