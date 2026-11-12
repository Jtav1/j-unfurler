import { createClient } from "redis";
import { REDIS_URL } from "../config.js";

const READY_WAIT_MS = 5_000;

let client = null;

/**
 * Starts the shared redis connection when REDIS_URL is set. Waits briefly for it to be ready so
 * the rate-limit store can initialize cleanly, but never blocks startup for longer than that:
 * the client keeps reconnecting in the background and callers check `isReady` before using it.
 * @returns {Promise<import("redis").RedisClientType|null>}
 */
export async function connectRedis() {
  if (!REDIS_URL || client) return client;
  client = createClient({
    url: REDIS_URL,
    disableOfflineQueue: true,
    socket: { reconnectStrategy: (retries) => Math.min(retries * 200, 5_000) },
  });
  client.on("error", (err) => console.error("redis error:", err.message));
  client.on("ready", () => console.log("redis connected"));

  const connected = client.connect().catch((err) => console.error("redis initial connect failed:", err.message));
  const deadline = new Promise((resolve) => setTimeout(resolve, READY_WAIT_MS).unref());
  await Promise.race([connected, deadline]);
  if (!client.isReady) console.warn(`redis not ready after ${READY_WAIT_MS}ms; starting without it`);
  return client;
}

/** @returns {import("redis").RedisClientType|null} */
export function getRedisClient() {
  return client;
}

/** @returns {"n/a"|"connected"|"disconnected"} */
export function redisStatus() {
  if (!client) return "n/a";
  return client.isReady ? "connected" : "disconnected";
}
