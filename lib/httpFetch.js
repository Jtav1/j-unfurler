const FETCH_TIMEOUT_MS = 10_000;

/** Several target sites 400/empty-shell a bare fetch without browser-like headers. */
export const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

/**
 * fetch() with an abort timeout, following redirects by default.
 * @param {string} url
 * @param {object} [options]
 * @returns {Promise<Response>}
 */
export async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { redirect: "follow", ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
