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
 * Parses a URL string and checks its hostname is in the allowed set for a given site route
 * (so /api/unfurl/reddit can't be used to fetch an arbitrary twitter.com link, say).
 * @param {string} url
 * @param {Set<string>} allowedHosts
 * @returns {URL|null}
 */
export function parseAllowedUrl(url, allowedHosts) {
  try {
    const parsed = new URL(url);
    if (!allowedHosts.has(parsed.hostname.toLowerCase())) return null;
    return parsed;
  } catch {
    return null;
  }
}
