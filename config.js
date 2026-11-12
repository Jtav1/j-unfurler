import "dotenv/config";

/** Reads an ENABLE_* env var; any value other than the literal string "false" is treated as enabled. */
function isEnabled(envVar) {
  return process.env[envVar] !== "false";
}

/** Reads a positive integer env var, falling back to the default when unset or unparsable. */
function intEnv(envVar, fallback) {
  const parsed = Number.parseInt(process.env[envVar] ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const PORT = process.env.PORT || 3003;

/** Per-site unfurler toggles, keyed by route slug. */
export const SITES = {
  reddit: isEnabled("ENABLE_REDDIT"),
  facebook: isEnabled("ENABLE_FACEBOOK"),
  twitter: isEnabled("ENABLE_TWITTER"),
  instagram: isEnabled("ENABLE_INSTAGRAM"),
  tiktok: isEnabled("ENABLE_TIKTOK"),
  bsky: isEnabled("ENABLE_BSKY"),
};

/**
 * Express `trust proxy` value. A hop count (default 1 = Nginx Proxy Manager directly in front)
 * or a CIDR/IP list; never `true`, which would trust a spoofed X-Forwarded-For from anyone.
 */
export const TRUST_PROXY = (() => {
  const raw = (process.env.TRUST_PROXY ?? "1").trim();
  return /^\d+$/.test(raw) ? Number.parseInt(raw, 10) : raw;
})();

export const RATE_LIMIT_WINDOW_SECONDS = intEnv("RATE_LIMIT_WINDOW_SECONDS", 60);
export const RATE_LIMIT_MAX = intEnv("RATE_LIMIT_MAX", 30);
export const MAX_CONCURRENT_UNFURLS = intEnv("MAX_CONCURRENT_UNFURLS", 32);

export const CACHE_TTL_SECONDS = intEnv("CACHE_TTL_SECONDS", 600);
export const CACHE_ERROR_TTL_SECONDS = intEnv("CACHE_ERROR_TTL_SECONDS", 60);
export const CACHE_MAX_ENTRIES = intEnv("CACHE_MAX_ENTRIES", 1000);

/** Optional redis URL; when unset, the cache and rate limiter use in-process memory. */
export const REDIS_URL = process.env.REDIS_URL?.trim() || null;

/** Comma-separated allowed CORS origins; empty means no CORS headers are sent at all. */
export const CORS_ORIGINS = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
