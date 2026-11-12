const MAX_URL_LENGTH = 2048;
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Validates the request body carries a non-empty string `url`.
 * @param {object} body - express req.body
 * @returns {string|null} the trimmed url, or null if invalid
 */
export function extractUrl(body) {
  if (!body || typeof body.url !== "string") return null;
  const url = body.url.trim();
  return url.length > 0 ? url : null;
}

/**
 * Parses a URL and rejects anything that isn't a plain http(s) origin: non-http schemes,
 * embedded credentials, explicit ports, and over-long inputs. Strips the fragment.
 * @param {string} url
 * @returns {URL|null}
 */
export function parseHttpUrl(url) {
  if (typeof url !== "string" || url.length > MAX_URL_LENGTH) return null;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return null;
  if (parsed.username || parsed.password) return null;
  if (parsed.port) return null;
  parsed.hash = "";
  return parsed;
}

/**
 * Parses a URL string and checks its hostname is in the allowed set for a given site route
 * (so /api/unfurl/reddit can't be used to fetch an arbitrary twitter.com link, say).
 * @param {string} url
 * @param {Set<string>} allowedHosts
 * @returns {URL|null}
 */
export function parseAllowedUrl(url, allowedHosts) {
  const parsed = parseHttpUrl(url);
  if (!parsed || !allowedHosts.has(parsed.hostname.toLowerCase())) return null;
  return parsed;
}
