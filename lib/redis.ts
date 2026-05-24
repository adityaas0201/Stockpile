import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedis() {
  if (!process.env.REDIS_URL) {
    console.warn("REDIS_URL not set — distributed locking disabled");
    return null;
  }
  const r = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    lazyConnect: false,
  });
  r.on("error", (e) => console.error("Redis error:", e.message));
  return r;
}

export const redis = globalForRedis.redis ?? createRedis();

if (process.env.NODE_ENV !== "production" && redis) {
  globalForRedis.redis = redis;
}

/**
 * Acquire a Redis SET NX PX lock.
 * Returns the token on success, null on failure.
 */
export async function acquireLock(
  key: string,
  ttlMs = 5000
): Promise<string | null> {
  if (!redis) return "noop"; // fallback: allow (DB will enforce)
  const token = `${Date.now()}-${Math.random()}`;
  const result = await redis.set(key, token, "PX", ttlMs, "NX");
  return result === "OK" ? token : null;
}

/**
 * Release a lock only if we still own it (compare-and-delete via Lua).
 */
export async function releaseLock(key: string, token: string): Promise<void> {
  if (!redis || token === "noop") return;
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  await redis.eval(script, 1, key, token);
}
