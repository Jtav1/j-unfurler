import { CACHE_ERROR_TTL_SECONDS, CACHE_TTL_SECONDS, MAX_CONCURRENT_UNFURLS } from "../config.js";
import { cache } from "./cache.js";
import { UnfurlFetchError } from "./httpFetch.js";

let inFlight = 0;

/**
 * Runs a site unfurler through the shared cache and global concurrency cap, and maps upstream
 * fetch failures to structured 502/504 bodies. Every route goes through here.
 * @param {{site: string, unfurl: Function}} entry
 * @param {URL} parsedUrl
 * @param {string} requestingService
 * @returns {Promise<{status: number, body: object, cached: boolean}>}
 */
export async function runUnfurl({ site, unfurl }, parsedUrl, requestingService) {
  const key = `unfurl:${site}:${parsedUrl.toString()}`;

  const hit = await cache.get(key);
  if (hit) {
    const body = hit.body.ok ? { ...hit.body, requestingService } : hit.body;
    return { status: hit.status, body, cached: true };
  }

  if (inFlight >= MAX_CONCURRENT_UNFURLS) {
    return { status: 503, body: { ok: false, error: "Busy, try again later" }, cached: false };
  }

  inFlight++;
  let result;
  try {
    result = await unfurl(parsedUrl, requestingService);
  } catch (err) {
    if (!(err instanceof UnfurlFetchError)) throw err;
    result = { status: err.status, body: { ok: false, error: err.message } };
  } finally {
    inFlight--;
  }

  await cache.set(key, result, result.body.ok ? CACHE_TTL_SECONDS : CACHE_ERROR_TTL_SECONDS);
  return { ...result, cached: false };
}
