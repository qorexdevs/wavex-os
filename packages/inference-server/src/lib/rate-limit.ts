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

export async function getStatus(): Promise<{ backend: "redis" | "memory"; ready: boolean }> {
  const r = await getRedis();
  return r ? { backend: "redis", ready: true } : { backend: "memory", ready: false };
}
