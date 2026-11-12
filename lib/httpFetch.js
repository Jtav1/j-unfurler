import dns from "node:dns";
import net from "node:net";
import { Agent, fetch as undiciFetch } from "undici";
import { parseHttpUrl } from "./validateUrl.js";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;
const MAX_JSON_BYTES = 1024 * 1024;
const MAX_HTML_BYTES = 1024 * 1024;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const TIMEOUT_CODES = new Set(["UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT"]);

/** Several target sites 400/empty-shell a bare fetch without browser-like headers. */
export const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

/**
 * An upstream fetch that failed for a reason we can report to the caller as a structured
 * 502/504 rather than a crash: policy violations (disallowed host/redirect/address, oversized
 * or wrong-type body), timeouts, and plain network errors. Messages are ours, never upstream's.
 */
export class UnfurlFetchError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = "UnfurlFetchError";
    this.status = status;
  }
}

// Loopback, link-local (incl. cloud metadata), RFC1918, CGNAT, multicast, reserved, unspecified,
// ULA, and NAT64. net.BlockList also matches IPv4-mapped IPv6 forms against the ipv4 rules.
const BLOCKED_ADDRESSES = new net.BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
]) {
  BLOCKED_ADDRESSES.addSubnet(address, prefix, "ipv4");
}
for (const [address, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["fc00::", 7],
  ["fe80::", 10],
]) {
  BLOCKED_ADDRESSES.addSubnet(address, prefix, "ipv6");
}

/** @param {string} address @param {4|6} family @returns {boolean} */
function isBlockedAddress(address, family) {
  return BLOCKED_ADDRESSES.check(address, family === 6 ? "ipv6" : "ipv4");
}

/** dns.lookup replacement that refuses to connect to any private/special-use address. */
function guardedLookup(hostname, options, callback) {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err);
    const allowed = addresses.filter((entry) => !isBlockedAddress(entry.address, entry.family));
    if (allowed.length === 0) {
      return callback(new UnfurlFetchError("Upstream host resolves to a blocked address"));
    }
    if (options.all) return callback(null, allowed);
    return callback(null, allowed[0].address, allowed[0].family);
  });
}

const agent = new Agent({
  connect: { timeout: FETCH_TIMEOUT_MS, lookup: guardedLookup },
  headersTimeout: FETCH_TIMEOUT_MS,
  bodyTimeout: FETCH_TIMEOUT_MS,
});

/**
 * Rejects a target before any socket is opened. The allowlist is the primary check; the
 * literal-IP check exists because net.connect skips `lookup` for IP literals entirely.
 * @param {URL} target
 * @param {Set<string>} allowedHosts
 */
function assertAllowedTarget(target, allowedHosts) {
  const host = target.hostname.toLowerCase();
  if (!allowedHosts.has(host)) throw new UnfurlFetchError("Upstream redirected to a host outside the allowlist");
  const literal = host.replace(/^\[|\]$/g, "");
  const family = net.isIP(literal);
  if (family !== 0 && isBlockedAddress(literal, family)) {
    throw new UnfurlFetchError("Upstream host resolves to a blocked address");
  }
}

/** Unwraps undici's `TypeError: fetch failed` into our error types. */
function normalizeFetchError(err) {
  if (err instanceof UnfurlFetchError) return err;
  if (err?.cause instanceof UnfurlFetchError) return err.cause;
  if (err?.name === "AbortError" || TIMEOUT_CODES.has(err?.cause?.code)) {
    return new UnfurlFetchError("Upstream request timed out", 504);
  }
  return new UnfurlFetchError("Upstream request failed");
}

/**
 * fetch() with an overall abort timeout that follows redirects manually, re-checking every hop
 * against `allowedHosts` (and the private-address block list) before requesting it.
 * `response.url` is the final hop's URL.
 * @param {string|URL} url
 * @param {object} options - fetch options plus a required `allowedHosts: Set<string>`
 * @returns {Promise<Response>}
 */
export async function fetchWithTimeout(url, { allowedHosts, dispatcher = agent, ...options }) {
  if (!(allowedHosts instanceof Set)) throw new TypeError("fetchWithTimeout requires allowedHosts");

  let current = typeof url === "string" ? parseHttpUrl(url) : url;
  if (!current) throw new UnfurlFetchError("Upstream URL is not a plain http(s) URL");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let method = options.method ?? "GET";
  let body = options.body;

  try {
    for (let hop = 0; ; hop++) {
      assertAllowedTarget(current, allowedHosts);

      let response;
      try {
        response = await undiciFetch(current, {
          ...options,
          method,
          body,
          redirect: "manual",
          dispatcher,
          signal: controller.signal,
        });
      } catch (err) {
        throw normalizeFetchError(err);
      }

      const location = response.headers.get("location");
      if (!REDIRECT_STATUSES.has(response.status) || !location) return response;

      await response.body?.cancel();
      if (hop >= MAX_REDIRECTS) throw new UnfurlFetchError("Upstream redirected too many times");

      let next;
      try {
        next = parseHttpUrl(new URL(location, current).toString());
      } catch {
        next = null;
      }
      if (!next) throw new UnfurlFetchError("Upstream redirected to an invalid URL");

      if (response.status === 303 || ((response.status === 301 || response.status === 302) && method !== "GET" && method !== "HEAD")) {
        method = "GET";
        body = undefined;
      }
      current = next;
    }
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Reads a body as UTF-8 up to `maxBytes`, cancelling the stream once exceeded.
 * @param {Response} response
 * @param {number} maxBytes
 * @returns {Promise<{text: string, truncated: boolean}>}
 */
async function readBodyCapped(response, maxBytes) {
  if (!response.body) return { text: "", truncated: false };
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body.cancel();
    return { text: "", truncated: true };
  }

  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  let truncated = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        chunks.push(value.subarray(0, value.byteLength - (received - maxBytes)));
        truncated = true;
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
  } catch (err) {
    throw normalizeFetchError(err);
  }
  return { text: Buffer.concat(chunks).toString("utf8"), truncated };
}

/**
 * Fetches and parses a JSON response of at most 1 MB. `data` is null when the response is not ok.
 * @param {string|URL} url
 * @param {object} options - see fetchWithTimeout
 * @returns {Promise<{response: Response, data: any}>}
 */
export async function fetchJson(url, options) {
  const response = await fetchWithTimeout(url, options);
  if (!response.ok) {
    await response.body?.cancel();
    return { response, data: null };
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!/\bjson\b/i.test(contentType)) {
    await response.body?.cancel();
    throw new UnfurlFetchError("Upstream returned a non-JSON response");
  }
  const { text, truncated } = await readBodyCapped(response, MAX_JSON_BYTES);
  if (truncated) throw new UnfurlFetchError("Upstream response too large");
  try {
    return { response, data: JSON.parse(text) };
  } catch {
    throw new UnfurlFetchError("Upstream returned malformed JSON");
  }
}

/**
 * Fetches an HTML response, reading at most 1 MB (enough for <head>; truncation is tolerated).
 * `html` is "" when the response is not ok.
 * @param {string|URL} url
 * @param {object} options - see fetchWithTimeout
 * @returns {Promise<{response: Response, html: string}>}
 */
export async function fetchHtml(url, options) {
  const response = await fetchWithTimeout(url, options);
  if (!response.ok) {
    await response.body?.cancel();
    return { response, html: "" };
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!/\btext\/html\b|\bapplication\/xhtml\+xml\b/i.test(contentType)) {
    await response.body?.cancel();
    throw new UnfurlFetchError("Upstream returned a non-HTML response");
  }
  const { text } = await readBodyCapped(response, MAX_HTML_BYTES);
  return { response, html: text };
}
