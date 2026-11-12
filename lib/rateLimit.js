import { rateLimit } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_SECONDS, REDIS_URL } from "../config.js";
import { getRedisClient } from "./redisClient.js";

/**
 * Per-client-IP limiter for /api/*. Relies on `trust proxy` being set so req.ip is the
 * X-Forwarded-For client, not the proxy. A redis outage lets requests through
 * (passOnStoreError) rather than failing them.
 * @returns {import("express").RequestHandler}
 */
export function createRateLimiter() {
  return rateLimit({
    windowMs: RATE_LIMIT_WINDOW_SECONDS * 1000,
    limit: RATE_LIMIT_MAX,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    passOnStoreError: true,
    handler: (_req, res) => res.status(429).json({ ok: false, error: "Too many requests" }),
    ...(REDIS_URL && {
      store: new RedisStore({
        prefix: "unfurl:rl:",
        sendCommand: (...args) => getRedisClient().sendCommand(args),
      }),
    }),
  });
}
