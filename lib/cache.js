import { LRUCache } from "lru-cache";
import { CACHE_MAX_ENTRIES, CACHE_TTL_SECONDS, REDIS_URL } from "../config.js";
import { getRedisClient } from "./redisClient.js";

/**
 * @typedef {object} UnfurlCache
 * @property {"memory"|"redis"} backend
 * @property {(key: string) => Promise<object|null>} get
 * @property {(key: string, value: object, ttlSeconds: number) => Promise<void>} set
 */

/** @returns {UnfurlCache} */
function createMemoryCache() {
  const store = new LRUCache({ max: CACHE_MAX_ENTRIES, ttl: CACHE_TTL_SECONDS * 1000 });
  return {
    backend: "memory",
    async get(key) {
      return store.get(key) ?? null;
    },
    async set(key, value, ttlSeconds) {
      store.set(key, value, { ttl: ttlSeconds * 1000 });
    },
  };
}

/** Redis failures are logged and treated as misses so an outage degrades to "no cache". */
function createRedisCache() {
  return {
    backend: "redis",
    async get(key) {
      const client = getRedisClient();
      if (!client?.isReady) return null;
      try {
        const raw = await client.get(key);
        return raw ? JSON.parse(raw) : null;
      } catch (err) {
        console.error("cache get failed:", err.message);
        return null;
      }
    },
    async set(key, value, ttlSeconds) {
      const client = getRedisClient();
      if (!client?.isReady) return;
      try {
        await client.set(key, JSON.stringify(value), { expiration: { type: "EX", value: ttlSeconds } });
      } catch (err) {
        console.error("cache set failed:", err.message);
      }
    },
  };
}

/** @type {UnfurlCache} */
export const cache = REDIS_URL ? createRedisCache() : createMemoryCache();
